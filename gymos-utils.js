// Utilitaires partagés GymOS : couleurs par groupe musculaire / type de séance,
// formatage et génération d'identifiants — utilisés par plusieurs pages.

const MC = {'Pectoraux':'#b90207','Abdominaux':'#8338bb','Bras':'#fa7b01','Avant-bras':'#f42d65','Cuisses (arrière)':'#974f1a','Cuisses (avant)':'#5a9d24','Cuisses (intérieur)':'#3fb5dc','Dos':'#0161be','Épaules':'#fbbd01','Fessiers':'#01969b','Mollets':'#a19e9f'};
const TC = {Push:'#fa7b01',Pull:'#0161be',Legs:'#5a9d24','Full Body':'#8338bb','Haut du corps':'#01969b','Bas du corps':'#974f1a',Cardio:'#b90207',Autre:'#9a9891'};

function grpc(g){ return MC[(g||'').split(',')[0].trim()]||'#9a9891'; }
function esc(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDateShort(iso){ return new Date(iso+'T00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }

// Bascule clair/sombre — attend des icônes SVG #thDark / #thLight dans la page.
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('muscle-xml-theme', t);
  const d = document.getElementById('thDark');  if (d) d.style.display = t==='dark'  ? 'block' : 'none';
  const l = document.getElementById('thLight'); if (l) l.style.display = t==='light' ? 'block' : 'none';
}
