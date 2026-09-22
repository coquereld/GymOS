const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const express = require('express');
const { isValidDocKey, getDoc, getDocVersion, setDoc, getUser } = require('./db');
const auth = require('./auth');

const PORT = 4600;
const HOST = '0.0.0.0'; // écoute sur toutes les interfaces (accès LAN depuis le téléphone, etc.)
const ROOT = path.join(__dirname, '..'); // racine du projet GymOS (fichiers statiques)

// Routes accessibles sans session valide : la page de login, ses assets, et le
// ping santé (sans donnée sensible) dont login.html a besoin pour vérifier que
// le serveur répond avant même d'afficher le formulaire.
const PUBLIC_PATHS = new Set(['/login.html', '/theme.css', '/db.js', '/gymos-utils.js', '/api/health']);

const app = express();
app.use(express.json({ limit: '5mb' }));

// Le process Node ne voit jamais de TLS directement : tailscale serve termine le
// HTTPS et proxy en clair vers 127.0.0.1:4600 en ajoutant x-forwarded-proto=https.
// Un accès direct par l'IP LAN (http://192.168.x.x:4600) n'a pas cet en-tête —
// on l'utilise pour ne marquer le cookie Secure que quand la requête est
// réellement passée par le tunnel HTTPS.
function isHttpsRequest(req) {
  return req.headers['x-forwarded-proto'] === 'https';
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function setSessionCookie(req, res, value) {
  const attrs = [`sid=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${30 * 24 * 60 * 60}`];
  if (isHttpsRequest(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req, res) {
  const attrs = ['sid=', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (isHttpsRequest(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

app.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path) || (req.path === '/api/login' && req.method === 'POST')) return next();
  const cookies = parseCookies(req);
  const username = auth.validateSessionCookie(cookies.sid);
  if (!username) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'authentification requise' });
    return res.redirect('/login.html');
  }
  req.username = username;
  next();
});

app.post('/api/login', (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  const { allowed, retryAfterMs } = auth.checkLoginRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: 'trop de tentatives, réessayez plus tard', retryAfterMs });
  }
  const { username, password } = req.body || {};
  const user = typeof username === 'string' ? getUser(username) : null;
  if (!user || !auth.verifyPassword(password || '', user.password_hash)) {
    auth.recordLoginFailure(ip);
    return res.status(401).json({ error: 'identifiants invalides' });
  }
  auth.recordLoginSuccess(ip);
  const cookieValue = auth.createSession(user.username);
  setSessionCookie(req, res, cookieValue);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req);
  auth.destroySessionCookie(cookies.sid);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/data/:docKey', (req, res) => {
  const { docKey } = req.params;
  if (!isValidDocKey(docKey)) return res.status(400).json({ error: 'doc_key inconnu' });
  try {
    const data = getDoc(docKey);
    if (data === null) return res.status(404).json(null);
    const version = getDocVersion(docKey);
    if (version) res.setHeader('X-Doc-Version', version);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/data/:docKey', (req, res) => {
  const { docKey } = req.params;
  if (!isValidDocKey(docKey)) return res.status(400).json({ error: 'doc_key inconnu' });
  try {
    // Détection d'écrasement concurrent : un client qui a lu le document envoie
    // la version qu'il avait alors dans X-Expected-Version. Si le document a
    // changé depuis (autre onglet/appareil), on refuse l'écriture plutôt que
    // d'écraser silencieusement des données plus récentes. Un client qui n'a
    // pas cet en-tête (ex. restauration explicite d'une sauvegarde) n'est pas
    // soumis à ce contrôle — c'est un remplacement volontaire, pas une course.
    const expected = req.headers['x-expected-version'];
    if (expected) {
      const current = getDocVersion(docKey);
      if (current && current !== expected) {
        return res.status(409).json({ error: 'conflit : données plus récentes sur le serveur', currentVersion: current });
      }
    }
    const updatedAt = setDoc(docKey, req.body);
    res.setHeader('X-Doc-Version', updatedAt);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Proxy Open Food Facts — lookup d'un produit par code-barres (EAN/UPC).
// Le scan lui-même reste local (caméra + API navigateur) ; ce lookup ne sert
// qu'à préremplir les macros d'un produit jamais saisi localement.
app.get('/api/lookup-barcode/:code', async (req, res) => {
  const { code } = req.params;
  if (!/^\d{8,14}$/.test(code)) return res.status(400).json({ found: false, error: 'code invalide' });
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,image_url`);
    if (!r.ok) return res.json({ found: false });
    const data = await r.json();
    if (data.status !== 1 || !data.product) return res.json({ found: false });
    const n = data.product.nutriments || {};
    res.json({
      found: true,
      name: data.product.product_name || '',
      cal: n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0,
      prot: n['proteins_100g'] ?? 0,
      carb: n['carbohydrates_100g'] ?? 0,
      fat: n['fat_100g'] ?? 0,
      fibres: n['fiber_100g'] ?? 0,
      sucres: n['sugars_100g'] ?? 0,
      sodium: Math.round((n['sodium_100g'] ?? 0) * 1000),
      image: data.product.image_url || '',
    });
  } catch (e) {
    res.json({ found: false });
  }
});

// Proxy de récupération d'une page de recette externe — extrait le JSON-LD
// schema.org/Recipe si présent. Garde anti-SSRF : bloque les hôtes locaux/
// privés (IPv4 et IPv6) puisque l'URL est fournie par le client, et revalide
// chaque redirection HTTP une à une plutôt que de les suivre en aveugle (une
// page publique pourrait sinon rediriger vers une adresse interne).
function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, ''); // retire les crochets IPv6 ([::1] -> ::1)
  if (h === 'localhost') return true;
  const IPV4_PRIVATE_RE = /^(127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
  if (IPV4_PRIVATE_RE.test(h)) return true;
  if (h === '::1' || h === '::') return true; // boucle locale / adresse non spécifiée
  if (/^(fe80:|f[cd][0-9a-f]{2}:)/.test(h)) return true; // lien-local / adresse locale unique
  // IPv4 mappée en IPv6 (ex. ::ffff:127.0.0.1) — Node normalise toujours en
  // notation hexadécimale pure (::ffff:7f00:1), jamais en decimal pointé,
  // donc on reconvertit les deux derniers groupes de 16 bits en 4 octets.
  const mapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
    const ipv4 = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
    if (IPV4_PRIVATE_RE.test(ipv4)) return true;
  }
  return false;
}
function isBlockedUrl(parsed) {
  if (!/^https?:$/.test(parsed.protocol)) return true;
  return isBlockedHost(parsed.hostname);
}

function fetchFollowingSafeRedirects(startUrl, maxHops = 5) {
  return new Promise((resolve, reject) => {
    function attempt(urlObj, hopsLeft) {
      if (isBlockedUrl(urlObj)) return reject(new Error('hôte non autorisé'));
      const mod = urlObj.protocol === 'https:' ? https : http;
      const req = mod.get(urlObj, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GymOS/1.0)' } }, (r) => {
        const { statusCode, headers } = r;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          r.resume();
          if (hopsLeft <= 0) return reject(new Error('trop de redirections'));
          let next;
          try { next = new URL(headers.location, urlObj); } catch { return reject(new Error('redirection invalide')); }
          return attempt(next, hopsLeft - 1);
        }
        if (statusCode < 200 || statusCode >= 300) {
          r.resume();
          return reject(new Error(`page inaccessible (${statusCode})`));
        }
        let body = '';
        r.setEncoding('utf8');
        r.on('data', chunk => {
          body += chunk;
          if (body.length > 3_000_000) { req.destroy(); reject(new Error('page trop volumineuse')); }
        });
        r.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('délai dépassé')));
    }
    attempt(startUrl, maxHops);
  });
}

app.get('/api/fetch-recipe', async (req, res) => {
  const { url } = req.query;
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return res.status(400).json({ error: 'URL invalide' }); }
  if (isBlockedUrl(parsed)) return res.status(400).json({ error: 'hôte non autorisé' });
  try {
    const html = await fetchFollowingSafeRedirects(parsed);
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let recipe = null;
    for (const m of blocks) {
      let json;
      try { json = JSON.parse(m[1]); } catch { continue; }
      const candidates = Array.isArray(json) ? json : (json['@graph'] || [json]);
      recipe = candidates.find(c => {
        const t = c && c['@type'];
        return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
      });
      if (recipe) break;
    }
    if (!recipe) return res.json({ found: false });
    const ingredients = recipe.recipeIngredient || recipe.ingredients || [];
    let instructions = '';
    if (typeof recipe.recipeInstructions === 'string') instructions = recipe.recipeInstructions;
    else if (Array.isArray(recipe.recipeInstructions)) {
      instructions = recipe.recipeInstructions.map(s => (typeof s === 'string' ? s : s.text || '')).join('\n');
    }
    res.json({ found: true, name: recipe.name || '', ingredients, instructions });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Ne jamais exposer le dossier server/ via les fichiers statiques : il contient
// le secret de session (.session-secret) et la base SQLite complète (gymos.db),
// qu'un simple GET pourrait sinon télécharger tel quel pour n'importe quel
// utilisateur authentifié.
app.use('/server', (req, res) => res.status(404).end());

app.use(express.static(ROOT));

app.listen(PORT, HOST, () => {
  console.log(`GymOS server running at http://localhost:${PORT}/index.html`);
  // Affiche aussi les adresses LAN pour s'y connecter depuis un téléphone/autre appareil.
  const nets = os.networkInterfaces();
  Object.values(nets).flat().forEach(net => {
    if (net.family === 'IPv4' && !net.internal) {
      console.log(`  → accessible en LAN sur http://${net.address}:${PORT}/index.html`);
    }
  });
});
