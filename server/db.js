const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { DOC_KEYS } = require('./doc-keys');

const db = new DatabaseSync(path.join(__dirname, 'gymos.db'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS gymos_data (
    doc_key    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

function isValidDocKey(key) {
  return DOC_KEYS.includes(key);
}

function getDoc(docKey) {
  const row = db.prepare('SELECT data FROM gymos_data WHERE doc_key = ?').get(docKey);
  if (!row) return null;
  return JSON.parse(row.data);
}

function setDoc(docKey, data) {
  db.prepare(`
    INSERT INTO gymos_data (doc_key, data, updated_at)
    VALUES (@docKey, @data, @updatedAt)
    ON CONFLICT(doc_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run({ docKey, data: JSON.stringify(data), updatedAt: new Date().toISOString() });
}

module.exports = { db, isValidDocKey, getDoc, setDoc };
