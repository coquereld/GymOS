# GymOS

Application web personnelle de suivi de musculation, nutrition et anatomie musculaire. Frontend 100% vanilla (HTML/CSS/JS, pas de build), backend local minimal (Node.js + Express + SQLite) pour la persistance des données.

## Prérequis

- **Node.js** (LTS, 22.5+ recommandé — fournit le module `node:sqlite` utilisé par le serveur, aucune dépendance native à compiler).
- Un navigateur récent (Chrome, Edge, Firefox... peu importe : la persistance passe désormais par le serveur local, plus par une API spécifique au navigateur).

## Lancer l'application

1. Double-clique sur **`start-gymos.bat`** à la racine du projet. Ça lance le serveur local (fenêtre "GymOS Server", à laisser ouverte) et ouvre automatiquement le navigateur sur `http://localhost:4600/login.html`.
2. Une fois connecté, les pages sont accessibles directement en local, ex. `http://localhost:4600/Dashboard.html`.

Pour arrêter le serveur : fermer la fenêtre "GymOS Server", ou `Ctrl+C` dedans.

Au premier lancement (ou après une remise à zéro), le serveur crée automatiquement `server/gymos.db` (SQLite) — vide au départ. Le script `server/migrate-from-json.js` permet d'importer une fois les anciens fichiers `Db/*.json` s'ils existent encore (`cd server && node migrate-from-json.js`).

## Structure du projet

```
GymOS/
├── login.html        — écran de connexion (vérifie que le serveur local répond)
├── index.html         — hub de navigation entre les modules
├── Dashboard.html      — tableau de bord (stats, volume, fréquence, progression)
├── Exercices.html       — bibliothèque d'exercices
├── Programme.html       — création de programmes d'entraînement
├── Seance.html          — exécution d'une séance en temps réel
├── Historique.html       — historique des séances + export/import Excel/JSON
├── Progression.html      — courbes de progression, 1RM, records personnels
├── Nutrition.html         — suivi nutritionnel journalier + export/import JSON
├── Corps.html             — catalogue anatomique (muscles/groupes)
├── db.js                  — module partagé GymDB : lecture/écriture via l'API du serveur local
├── server/                — backend Node.js (Express + SQLite)
│   ├── index.js             — serveur HTTP : sert les pages statiques + l'API /api/data/:docKey
│   ├── db.js                 — accès SQLite (table gymos_data)
│   ├── doc-keys.js            — liste des documents valides + correspondance avec les anciens noms de fichiers
│   ├── migrate-from-json.js   — migration one-shot depuis Db/*.json
│   └── gymos.db                — base SQLite (créée au premier lancement, non versionnée)
├── start-gymos.bat        — lance le serveur + ouvre le navigateur
├── Db/                    — anciens fichiers JSON (conservés comme sauvegarde hors-ligne, plus lus par l'app)
├── Export/                — exports/sauvegardes (ex: muscles-edited.xml)
└── img/                   — images de l'application (icônes, anatomie, exercices, aliments)
```

Chaque page `.html` reste autonome (HTML + CSS + JS inline) et navigue vers les autres via `index.html`. Il n'y a pas de framework, pas de bundler côté frontend.

## Données

Toutes les données vivent dans une seule base SQLite (`server/gymos.db`), une ligne par document dans la table `gymos_data(doc_key, data, updated_at)` :

| `doc_key` | Contenu |
|---|---|
| `corps` | Groupes musculaires, muscles, subdivisions anatomiques |
| `exercices` | Bibliothèque d'exercices |
| `exercices_objectifs` | Historique des objectifs/performances par exercice |
| `programmes` | Programmes d'entraînement |
| `historique` | Historique des séances effectuées |
| `nutrition` | Suivi nutritionnel journalier |
| `group_images` | Configuration des images d'anatomie |

Les images (`img/`) sont livrées avec l'application elle-même — elles ne font pas partie de la base de données.

**Sauvegarde** : le fichier `server/gymos.db` est la source de vérité. Pour sauvegarder tes données, copie simplement ce fichier ailleurs (l'app doit être fermée, ou au moins ne pas être en train d'écrire, pour une copie propre).

## Module GymDB (db.js)

`db.js` expose un objet global `GymDB` utilisé par toutes les pages pour lire/écrire les données via l'API du serveur local :

```js
await GymDB.init()                     // vérifie que le serveur répond : 'connected' | 'disconnected'
await GymDB.read(filename, validator?) // lire un document (validator optionnel : (data) => boolean)
GymDB.write(filename, data)            // écrire un document (asynchrone, fire & forget)
GymDB.getState()                       // état courant
GymDB.isConnected()                    // bool
GymDB.onChange(callback)               // callback(state) appelé à chaque changement d'état
```

Les pages continuent d'appeler `read`/`write` avec les anciens noms de fichiers (`'historique.json'`, `'nutrition.json'`, ...) — `db.js` fait la correspondance en interne avec les `doc_key` de la base (voir `server/doc-keys.js`). Le paramètre `validator` de `read()` permet de rejeter des données de forme invalide : si la validation échoue, `read()` se comporte comme si le document était absent (retourne `null`).

## Limites actuelles / évolutions prévues

- Le serveur n'écoute que sur `127.0.0.1` (localhost) : accessible uniquement depuis ce PC, pas encore depuis le téléphone ni un autre appareil du réseau.
- Accès distant (téléphone, salle de sport) prévu dans un lot ultérieur, via Tailscale ou Cloudflare Tunnel — pas de port à ouvrir sur le routeur (piste écartée pour raisons de sécurité).
- Migration prévue vers une VM Windows Server 2025 : il suffira de copier le dossier `server/` (code + `gymos.db`) sur la nouvelle machine et de relancer `npm install && node index.js`.
