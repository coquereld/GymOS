/**
 * GymOS — db.js v3 (serveur local)
 *
 * Remplace l'ancienne persistance File System Access API par des appels
 * HTTP (chemins relatifs) vers le serveur local GymOS (Express + SQLite,
 * voir server/), qui sert à la fois les pages et l'API — même origine,
 * donc ça fonctionne quel que soit le nom d'hôte utilisé pour charger la
 * page (localhost, 127.0.0.1, plus tard un nom Tailscale...).
 * Le serveur doit être lancé au préalable (start-gymos.bat).
 *
 * 2 états possibles :
 *   'connected'    → le serveur local répond, lecture/écriture actives
 *   'disconnected' → le serveur ne répond pas (pas lancé, ou coupé)
 *
 * API (signatures conservées pour ne pas changer les appels dans les pages) :
 *   await GymDB.init()                 → retourne l'état initial
 *   await GymDB.read(file, validator?) → lire un document (validator optionnel : (data)=>boolean)
 *         GymDB.write(file, data)      → écrire un document (fire & forget comme avant ;
 *                                         retourne maintenant une Promise<boolean> que le code
 *                                         existant peut continuer à ignorer, et qu'un appel
 *                                         plus récent peut `await` pour connaître le vrai résultat)
 *   GymDB.getState()                   → 'connected' | 'disconnected'
 *   GymDB.isConnected()                → bool
 *   GymDB.onChange(cb)                 → callback(state) appelé à chaque changement
 *   GymDB.onConflict(cb)               → callback(filename) appelé quand une écriture est
 *                                         refusée car des données plus récentes existent sur
 *                                         le serveur (autre onglet/appareil) — sans écouteur
 *                                         enregistré, une alerte générique s'affiche à la place.
 *
 * Anti-écrasement : chaque lecture retient la version du document (en-tête
 * X-Doc-Version) ; chaque écriture l'envoie via X-Expected-Version. Le serveur
 * refuse (409) une écriture si le document a changé depuis cette lecture,
 * plutôt que d'écraser silencieusement des données plus récentes écrites
 * depuis un autre appareil pendant que cet onglet était resté ouvert.
 */
const GymDB = (() => {
  'use strict';

  // Les pages appellent toujours GymDB.read/write avec les anciens noms de
  // fichiers ('historique.json', etc.) — on les fait correspondre ici aux
  // doc_key de la table gymos_data, sans rien changer dans les 10 pages.
  const FILE_TO_DOC_KEY = {
    'historique.json': 'historique',
    'exercices.json': 'exercices',
    'exercices-objectifs.json': 'exercices_objectifs',
    'programmes.json': 'programmes',
    'corps.json': 'corps',
    'group-images.json': 'group_images',
    'nutrition.json': 'nutrition',
  };
  function toDocKey(filename) { return FILE_TO_DOC_KEY[filename] || filename; }

  let _state = 'disconnected';
  let _callbacks = [];
  let _conflictCallbacks = [];
  const _versions = {}; // docKey -> dernière version connue (X-Doc-Version)

  function _setState(s) {
    if (s === _state) return;
    _state = s;
    _callbacks.forEach(cb => { try { cb(s); } catch(e) {} });
  }

  function onChange(cb)    { _callbacks.push(cb); }
  function onConflict(cb)  { _conflictCallbacks.push(cb); }
  function isConnected()   { return _state === 'connected'; }
  function getState()      { return _state; }

  async function init() {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      _setState(r.ok ? 'connected' : 'disconnected');
    } catch(e) {
      _setState('disconnected');
    }
    return _state;
  }

  // ── Lecture ───────────────────────────────────────────────────────────────
  // validator optionnel : (data) => boolean — si fourni et que le retour est
  // false, les données sont traitées comme absentes (log + retourne null)
  async function read(filename, validator) {
    const docKey = toDocKey(filename);
    try {
      const r = await fetch(`/api/data/${docKey}`, { cache: 'no-store' });
      if (r.status === 404) { _setState('connected'); _versions[docKey] = null; return null; }
      if (!r.ok) { _setState('disconnected'); return null; }
      _setState('connected');
      const v = r.headers.get('X-Doc-Version');
      if (v) _versions[docKey] = v;
      const data = await r.json();
      if (validator && !validator(data)) {
        console.warn(`GymDB read(${filename}): forme invalide, données ignorées`);
        return null;
      }
      return data;
    } catch(e) {
      _setState('disconnected');
      console.warn(`GymDB read(${filename}):`, e.message);
      return null;
    }
  }

  // ── Écriture ──────────────────────────────────────────────────────────────
  // Reste fire-and-forget pour les appels existants (le retour peut être
  // ignoré sans rien changer à leur comportement), mais renvoie désormais une
  // Promise<boolean> qu'un appel plus récent peut `await` pour connaître le
  // vrai résultat avant d'afficher un message de succès.
  function write(filename, data) {
    const docKey = toDocKey(filename);
    return (async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (_versions[docKey]) headers['X-Expected-Version'] = _versions[docKey];
        const r = await fetch(`/api/data/${docKey}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
        });
        if (r.status === 409) {
          _setState('connected'); // le serveur répond bien, c'est un conflit, pas une panne
          console.error(`GymDB write(${filename}): conflit — des données plus récentes existent sur le serveur, écriture annulée pour ne pas les écraser.`);
          if (_conflictCallbacks.length) {
            _conflictCallbacks.forEach(cb => { try { cb(filename); } catch(e) {} });
          } else {
            alert(`Des données plus récentes existent pour « ${filename} » (modifiées depuis un autre appareil). Votre dernière modification n'a pas été enregistrée pour éviter de les écraser. Rechargez la page avant de continuer.`);
          }
          return false;
        }
        _setState(r.ok ? 'connected' : 'disconnected');
        if (r.ok) {
          const v = r.headers.get('X-Doc-Version');
          if (v) _versions[docKey] = v;
        } else {
          console.error(`GymDB write(${filename}): HTTP ${r.status}`);
        }
        return r.ok;
      } catch(e) {
        _setState('disconnected');
        console.error(`GymDB write(${filename}):`, e.message);
        return false;
      }
    })();
  }

  return { init, getState, isConnected, onChange, onConflict, read, write };
})();
