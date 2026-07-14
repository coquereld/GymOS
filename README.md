# GymOS

Application web personnelle de suivi de musculation, nutrition et anatomie musculaire. 100% front-end : pas de serveur, pas de build, pas de dépendance à installer.

## Prérequis

- **Google Chrome ou Microsoft Edge** (récent). L'application utilise la [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) pour lire/écrire tes données directement dans un dossier local. Cette API n'est pas supportée par Firefox ni Safari — sur ces navigateurs, GymOS reste utilisable mais tes données restent uniquement en `localStorage` (pas de synchronisation entre navigateurs, perte possible si le cache est vidé).

## Lancer l'application

Aucune installation nécessaire : ouvre `login.html` (ou `index.html`) directement dans le navigateur, en double-cliquant sur le fichier ou via `Fichier > Ouvrir`.

Au premier lancement, sélectionne un dossier local (par exemple le dossier `Db/` fourni avec le projet) : c'est là que GymOS lira et écrira toutes tes données. Ce choix n'est fait qu'une seule fois — au retour, un simple clic suffit pour réautoriser l'accès (voir [db.js](db.js)).

## Structure du projet

```
GymOS/
├── login.html        — écran de connexion au dossier de données
├── index.html         — hub de navigation entre les modules
├── Dashboard.html      — tableau de bord (stats, volume, fréquence, progression)
├── Exercices.html       — bibliothèque d'exercices
├── Programme.html       — création de programmes d'entraînement
├── Seance.html          — exécution d'une séance en temps réel
├── Historique.html       — historique des séances + export Excel
├── Progression.html      — courbes de progression, 1RM, records personnels
├── Nutrition.html         — suivi nutritionnel journalier
├── Corps.html             — catalogue anatomique (muscles/groupes)
├── db.js                  — module partagé GymDB : lecture/écriture des données
├── test-db.html           — page de test autonome pour db.js
├── Db/                    — données applicatives (JSON), exemple de dossier de données
├── Export/                — exports/sauvegardes (ex: muscles-edited.xml)
└── img/                   — images de l'application (icônes, anatomie, exercices, aliments)
```

Chaque page `.html` est autonome (HTML + CSS + JS inline) et navigue vers les autres via `index.html`. Il n'y a pas de framework, pas de bundler : les fichiers sont édités directement.

## Données (dossier connecté via GymDB)

Le dossier que tu sélectionnes au login contient les fichiers JSON suivants (créés automatiquement à la première sauvegarde s'ils n'existent pas) :

| Fichier | Contenu |
|---|---|
| `corps.json` | Groupes musculaires, muscles, subdivisions anatomiques |
| `exercices.json` | Bibliothèque d'exercices |
| `exercices-objectifs.json` | Historique des objectifs/performances par exercice |
| `programmes.json` | Programmes d'entraînement |
| `historique.json` | Historique des séances effectuées |
| `nutrition.json` | Suivi nutritionnel journalier |

Les images (`img/`) sont livrées avec l'application elle-même — elles ne font pas partie du dossier de données.

## Module GymDB (db.js)

`db.js` expose un objet global `GymDB` utilisé par toutes les pages pour lire/écrire les fichiers JSON du dossier connecté :

```js
await GymDB.init()                    // état initial : 'connected' | 'needs-permission' | 'disconnected'
await GymDB.reconnect()               // réautoriser le dossier mémorisé (1 clic)
await GymDB.connect()                 // ouvrir le sélecteur de dossier
await GymDB.read(filename, validator?) // lire un JSON (validator optionnel : (data) => boolean)
GymDB.write(filename, data)           // écrire un JSON (asynchrone, fire & forget)
GymDB.getState()                      // état courant
GymDB.getFolderName()                 // nom du dossier connecté, ou null
GymDB.onChange(callback)              // callback(state) appelé à chaque changement d'état
```

Le paramètre `validator` de `read()` permet de rejeter des données de forme invalide (ex: `Array.isArray`) : si la validation échoue, `read()` se comporte comme si le fichier était absent (retourne `null`) plutôt que de propager des données corrompues.

## Tests

`test-db.html` est une page de test autonome (aucune dépendance) qui vérifie le comportement de `db.js` à l'aide de mocks en mémoire de la File System Access API et d'IndexedDB — aucune vraie donnée n'est lue ni écrite par ces tests automatisés. Une section manuelle optionnelle permet de tester avec un vrai dossier.

Ouvre simplement `test-db.html` dans le navigateur ; les résultats (✅/❌) s'affichent au chargement de la page.
