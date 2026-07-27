const path = require('path');
const os = require('os');
const express = require('express');
const { isValidDocKey, getDoc, setDoc } = require('./db');

const PORT = 4600;
const HOST = '0.0.0.0'; // écoute sur toutes les interfaces (accès LAN depuis le téléphone, etc.)
const ROOT = path.join(__dirname, '..'); // racine du projet GymOS (fichiers statiques)

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/data/:docKey', (req, res) => {
  const { docKey } = req.params;
  if (!isValidDocKey(docKey)) return res.status(400).json({ error: 'doc_key inconnu' });
  const data = getDoc(docKey);
  if (data === null) return res.status(404).json(null);
  res.json(data);
});

app.put('/api/data/:docKey', (req, res) => {
  const { docKey } = req.params;
  if (!isValidDocKey(docKey)) return res.status(400).json({ error: 'doc_key inconnu' });
  try {
    setDoc(docKey, req.body);
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
// schema.org/Recipe si présent. Garde anti-SSRF basique : bloque les hôtes
// locaux/privés puisque l'URL est fournie par le client.
const BLOCKED_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;
app.get('/api/fetch-recipe', async (req, res) => {
  const { url } = req.query;
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return res.status(400).json({ error: 'URL invalide' }); }
  if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ error: 'URL invalide' });
  if (BLOCKED_HOST_RE.test(parsed.hostname)) return res.status(400).json({ error: 'hôte non autorisé' });
  try {
    const r = await fetch(parsed.href, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GymOS/1.0)' } });
    if (!r.ok) return res.status(502).json({ error: 'page inaccessible' });
    const html = await r.text();
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
    res.status(500).json({ error: e.message });
  }
});

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
