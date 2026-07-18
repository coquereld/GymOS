const path = require('path');
const express = require('express');
const { isValidDocKey, getDoc, setDoc } = require('./db');

const PORT = 4600;
const HOST = '127.0.0.1'; // local uniquement pour l'instant — pas d'accès réseau/téléphone
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

app.use(express.static(ROOT));

app.listen(PORT, HOST, () => {
  console.log(`GymOS server running at http://${HOST}:${PORT}/index.html`);
});
