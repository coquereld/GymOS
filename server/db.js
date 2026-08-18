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

db.exec(`
  CREATE TABLE IF NOT EXISTS gymos_users (
    username      TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS gymos_sessions (
    token      TEXT PRIMARY KEY,
    username   TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
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

function getUser(username) {
  return db.prepare('SELECT username, password_hash FROM gymos_users WHERE username = ?').get(username) || null;
}

function upsertUser(username, passwordHash) {
  db.prepare(`
    INSERT INTO gymos_users (username, password_hash, created_at)
    VALUES (@username, @passwordHash, @createdAt)
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash
  `).run({ username, passwordHash, createdAt: new Date().toISOString() });
}

function createSession(token, username, expiresAt) {
  db.prepare(`
    INSERT INTO gymos_sessions (token, username, expires_at, created_at)
    VALUES (@token, @username, @expiresAt, @createdAt)
  `).run({ token, username, expiresAt, createdAt: new Date().toISOString() });
}

function getSession(token) {
  return db.prepare('SELECT token, username, expires_at FROM gymos_sessions WHERE token = ?').get(token) || null;
}

function deleteSession(token) {
  db.prepare('DELETE FROM gymos_sessions WHERE token = ?').run(token);
}

function deleteExpiredSessions() {
  db.prepare('DELETE FROM gymos_sessions WHERE expires_at < ?').run(new Date().toISOString());
}

module.exports = {
  db, isValidDocKey, getDoc, setDoc,
  getUser, upsertUser,
  createSession, getSession, deleteSession, deleteExpiredSessions,
};
