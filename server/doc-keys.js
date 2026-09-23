// Clés de documents valides dans la table gymos_data, et correspondance
// avec les anciens fichiers Db/*.json (utilisé par migrate-from-json.js).
const DOC_KEYS = [
  'historique',
  'exercices',
  'exercices_objectifs',
  'programmes',
  'corps',
  'group_images',
  'nutrition',
  'agenda_notes',
];

const JSON_FILE_BY_DOC_KEY = {
  historique: 'historique.json',
  exercices: 'exercices.json',
  exercices_objectifs: 'exercices-objectifs.json',
  programmes: 'programmes.json',
  corps: 'corps.json',
  group_images: 'group-images.json',
  nutrition: 'nutrition.json',
};

// Forme JSON attendue au niveau racine pour chaque doc_key — sert uniquement
// à repérer une écriture manifestement corrompue (ex. restauration d'une
// sauvegarde mal formée) avant qu'elle n'écrase les données existantes.
// Les clés absentes d'ici (ex. agenda_notes, pas encore implémenté) ne sont
// pas contrôlées.
const DOC_SHAPE = {
  historique: 'array',
  exercices: 'object',
  exercices_objectifs: 'object',
  programmes: 'array',
  corps: 'object',
  group_images: 'object',
  nutrition: 'object',
};

module.exports = { DOC_KEYS, JSON_FILE_BY_DOC_KEY, DOC_SHAPE };
