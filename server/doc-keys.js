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

module.exports = { DOC_KEYS, JSON_FILE_BY_DOC_KEY };
