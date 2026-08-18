const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const SESSION_SECRET_PATH = path.join(__dirname, '.session-secret');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function loadOrCreateSessionSecret() {
  if (fs.existsSync(SESSION_SECRET_PATH)) {
    return fs.readFileSync(SESSION_SECRET_PATH, 'utf8').trim();
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SESSION_SECRET_PATH, secret, { mode: 0o600 });
  return secret;
}

const SESSION_SECRET = loadOrCreateSessionSecret();

// ── Mots de passe ────────────────────────────────────────────────────────────
// Format stocké : scrypt$<saltHex>$<hashHex>
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// ── Sessions ──────────────────────────────────────────────────────────────────
// Cookie = "<tokenHex>.<hmacHex>" : le token opaque sert de clé de recherche en
// base (source de vérité), le HMAC détecte toute altération côté client avant
// même d'interroger la base.
function signToken(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.createSession(token, username, expiresAt);
  return `${token}.${signToken(token)}`;
}

function validateSessionCookie(cookieValue) {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot === -1) return null;
  const token = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expectedSig = signToken(token);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  const session = db.getSession(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.deleteSession(token);
    return null;
  }
  return session.username;
}

function destroySessionCookie(cookieValue) {
  if (!cookieValue) return;
  const dot = cookieValue.lastIndexOf('.');
  if (dot === -1) return;
  db.deleteSession(cookieValue.slice(0, dot));
}

// ── Rate-limiting des tentatives de login (par IP, en mémoire) ───────────────
const loginAttempts = new Map(); // ip -> { count, windowStart }

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    return { allowed: true };
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterMs = LOGIN_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }
  return { allowed: true };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count++;
  }
}

function recordLoginSuccess(ip) {
  loginAttempts.delete(ip);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  validateSessionCookie,
  destroySessionCookie,
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
};
