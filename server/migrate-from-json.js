// Migration one-shot : lit les Db/*.json existants et les insère dans gymos.db.
// À exécuter une seule fois (node migrate-from-json.js), avant de basculer db.js
// sur le nouveau serveur. Les fichiers Db/*.json ne sont pas supprimés.
const fs = require('fs');
const path = require('path');
const { setDoc, getDoc } = require('./db');
const { JSON_FILE_BY_DOC_KEY } = require('./doc-keys');

const DB_DIR = path.join(__dirname, '..', 'Db');

let migrated = 0, skipped = 0;

for (const [docKey, filename] of Object.entries(JSON_FILE_BY_DOC_KEY)) {
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP  ${docKey} — ${filename} introuvable`);
    skipped++;
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`ERREUR ${docKey} — JSON invalide dans ${filename}: ${e.message}`);
    skipped++;
    continue;
  }
  setDoc(docKey, data);
  const check = getDoc(docKey);
  const ok = JSON.stringify(check) === JSON.stringify(data);
  console.log(`${ok ? 'OK   ' : 'ECART'} ${docKey} <- ${filename} (${fs.statSync(filePath).size} octets)`);
  migrated++;
}

console.log(`\nTerminé : ${migrated} document(s) migré(s), ${skipped} ignoré(s).`);
