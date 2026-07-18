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
 *         GymDB.write(file, data)      → écrire un document (async, fire & forget)
 *   GymDB.getState()                   → 'connected' | 'disconnected'
 *   GymDB.isConnected()                → bool
 *   GymDB.onChange(cb)                 → callback(state) appelé à chaque changement
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

  function _setState(s) {
    if (s === _state) return;
    _state = s;
    _callbacks.forEach(cb => { try { cb(s); } catch(e) {} });
  }

  function onChange(cb)  { _callbacks.push(cb); }
  function isConnected() { return _state === 'connected'; }
  function getState()    { return _state; }

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
      if (r.status === 404) { _setState('connected'); return null; }
      if (!r.ok) { _setState('disconnected'); return null; }
      _setState('connected');
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
  function write(filename, data) {
    const docKey = toDocKey(filename);
    (async () => {
      try {
        const r = await fetch(`/api/data/${docKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        _setState(r.ok ? 'connected' : 'disconnected');
        if (!r.ok) console.error(`GymDB write(${filename}): HTTP ${r.status}`);
      } catch(e) {
        _setState('disconnected');
        console.error(`GymDB write(${filename}):`, e.message);
      }
    })();
  }

  return { init, getState, isConnected, onChange, read, write };
})();
