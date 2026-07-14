/**
 * GymOS — db.js v2
 *
 * 3 états possibles :
 *   'connected'        → dossier connecté, lecture/écriture actives
 *   'needs-permission' → dossier mémorisé, besoin d'1 clic pour réautoriser
 *   'disconnected'     → aucun dossier mémorisé, sélection nécessaire
 *
 * API :
 *   await GymDB.init()       → retourne l'état initial
 *   await GymDB.reconnect()  → réautoriser le dossier mémorisé (1 clic, pas de picker)
 *   await GymDB.connect()    → ouvrir le sélecteur de dossier
 *   await GymDB.read(file, validator?) → lire un JSON (validator optionnel : (data)=>boolean)
 *         GymDB.write(f, d)  → écrire un JSON (async, fire & forget)
 *   GymDB.getState()         → 'connected' | 'needs-permission' | 'disconnected'
 *   GymDB.getFolderName()    → nom du dossier ou null
 *   GymDB.onChange(cb)       → callback(state) appelé à chaque changement
 */
const GymDB = (() => {
  'use strict';

  const IDB_DB    = 'gymos-fsdb-v2';
  const IDB_STORE = 'handles';
  const IDB_KEY   = 'directory';

  let _dir            = null;   // handle actif
  let _pendingHandle  = null;   // handle mémorisé mais pas encore autorisé
  let _state          = 'disconnected';
  let _callbacks      = [];

  // ── IndexedDB ────────────────────────────────────────────────────────────
  function _idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(IDB_DB, 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
      r.onsuccess = e => res(e.target.result);
      r.onerror   = () => rej(r.error);
    });
  }
  async function _idbGet() {
    const db = await _idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r  = tx.objectStore(IDB_STORE).get(IDB_KEY);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror   = () => rej(r.error);
    });
  }
  async function _idbSet(val) {
    const db = await _idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, IDB_KEY);
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
  }
  async function _idbDel() {
    const db = await _idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
  }

  // ── Statut ────────────────────────────────────────────────────────────────
  function _setState(s) {
    _state = s;
    _callbacks.forEach(cb => { try { cb(s); } catch(e) {} });
  }

  function onChange(cb)    { _callbacks.push(cb); }
  function isSupported()   { return 'showDirectoryPicker' in window; }
  function isConnected()   { return _state === 'connected'; }
  function getState()      { return _state; }
  function getFolderName() { return (_dir || _pendingHandle)?.name ?? null; }

  // ── Init ─────────────────────────────────────────────────────────────────
  // Appelé au démarrage — PAS besoin de geste utilisateur
  // Si permission déjà accordée → connecte automatiquement
  // Sinon → état 'needs-permission' (1 clic suffira)
  async function init() {
    if (!isSupported()) { _setState('disconnected'); return 'disconnected'; }
    try {
      const handle = await _idbGet();
      if (!handle) { _setState('disconnected'); return 'disconnected'; }

      // Vérifier silencieusement la permission (sans popup)
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        _dir = handle;
        _pendingHandle = null;
        _setState('connected');
        return 'connected';
      }

      // Permission en attente → mémoriser le handle pour reconnect en 1 clic
      _pendingHandle = handle;
      _setState('needs-permission');
      return 'needs-permission';
    } catch(e) {
      _setState('disconnected');
      return 'disconnected';
    }
  }

  // ── Reconnect ─────────────────────────────────────────────────────────────
  // Réautoriser le dossier mémorisé — 1 clic utilisateur, PAS de sélecteur
  async function reconnect() {
    if (!isSupported()) return false;
    const handle = _pendingHandle || await _idbGet();
    if (!handle) return false;
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        _dir = handle;
        _pendingHandle = null;
        await _idbSet(handle);
        _setState('connected');
        return true;
      }
      return false;
    } catch(e) { return false; }
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  // Ouvrir le sélecteur de dossier (premier usage ou changement de dossier)
  async function connect() {
    if (!isSupported()) {
      alert('Votre navigateur ne supporte pas le stockage fichier.\nUtilisez Chrome ou Edge.');
      return false;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'gymos-db' });
      await _idbSet(handle);
      _dir = handle;
      _pendingHandle = null;
      _setState('connected');
      return true;
    } catch(e) {
      if (e.name !== 'AbortError') console.error('GymDB connect:', e);
      return false;
    }
  }

  // ── Lecture JSON ──────────────────────────────────────────────────────────
  // validator optionnel : (data) => boolean — si fourni et que le retour est
  // false, les données sont traitées comme absentes (log + retourne null)
  async function read(filename, validator) {
    if (!_dir) return null;
    try {
      const fh   = await _dir.getFileHandle(filename, { create: false });
      const file = await fh.getFile();
      const data = JSON.parse(await file.text());
      if (validator && !validator(data)) {
        console.warn(`GymDB read(${filename}): forme invalide, données ignorées`);
        return null;
      }
      return data;
    } catch(e) {
      if (e.name !== 'NotFoundError') console.warn(`GymDB read(${filename}):`, e.message);
      return null;
    }
  }

  // ── Écriture JSON ─────────────────────────────────────────────────────────
  function write(filename, data) {
    if (!_dir) return;
    (async () => {
      try {
        const fh = await _dir.getFileHandle(filename, { create: true });
        const wr = await fh.createWritable();
        await wr.write(JSON.stringify(data, null, 2));
        await wr.close();
      } catch(e) { console.error(`GymDB write(${filename}):`, e.message); }
    })();
  }

  async function disconnect() {
    _dir = null; _pendingHandle = null;
    await _idbDel();
    _setState('disconnected');
  }

  return { init, reconnect, connect, disconnect, isSupported, isConnected, getState, getFolderName, onChange, read, write };
})();
