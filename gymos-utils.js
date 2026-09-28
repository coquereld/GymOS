// Utilitaires partagés GymOS : couleurs par groupe musculaire / type de séance,
// formatage et génération d'identifiants — utilisés par plusieurs pages.

const MC = {'Pectoraux':'#b90207','Abdominaux':'#8338bb','Bras':'#fa7b01','Avant-bras':'#f42d65','Cuisses (arrière)':'#974f1a','Cuisses (avant)':'#5a9d24','Cuisses (intérieur)':'#3fb5dc','Dos':'#0161be','Épaules':'#fbbd01','Fessiers':'#01969b','Mollets':'#a19e9f'};
const TC = {Push:'#fa7b01',Pull:'#0161be',Legs:'#5a9d24','Full Body':'#8338bb','Haut du corps':'#01969b','Bas du corps':'#974f1a',Cardio:'#b90207',Autre:'#9a9891'};

function grpc(g){ return MC[(g||'').split(',')[0].trim()]||'#9a9891'; }
function esc(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtDateShort(iso){ return new Date(iso+'T00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }

// Envoie un fichier choisi localement (image ou vidéo) vers le serveur, qui
// l'écrit dans img/ ou mp4/ sous son propre nom — remplace le simple mémo du
// nom de fichier par un vrai transfert, pour ne plus avoir à le copier soi-
// même sur le serveur. Retourne le nom de fichier une fois l'envoi confirmé ;
// lève une erreur (avec message lisible) si l'envoi échoue.
async function uploadMedia(file, kind){
  const endpoint = (kind==='video' ? '/api/upload/video/' : '/api/upload/image/') + encodeURIComponent(file.name);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    let msg = "Échec de l'envoi du fichier (" + res.status + ')';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return file.name;
}

// Bascule clair/sombre — attend des icônes SVG #thDark / #thLight dans la page.
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('muscle-xml-theme', t);
  const d = document.getElementById('thDark');  if (d) d.style.display = t==='dark'  ? 'block' : 'none';
  const l = document.getElementById('thLight'); if (l) l.style.display = t==='light' ? 'block' : 'none';
}

// ══════════════════════════════════════════════════════════════
// REPÈRES DE POIDS (lbs → kg) PAR TYPE DE MATÉRIEL
// ══════════════════════════════════════════════════════════════
// Un exercice est classé selon un seul de ces 5 types (champ `type_repere_poids`).
const REPERE_POIDS_TYPES = ['Machine 1','Machine 2','Poulie 1','Disque','Haltères'];

const POIDS_MACHINE1 = [
  {lbs:10,kg:4.5},{lbs:20,kg:9},{lbs:30,kg:14},{lbs:40,kg:18},{lbs:50,kg:23},
  {lbs:60,kg:27},{lbs:70,kg:32},{lbs:80,kg:36},{lbs:90,kg:41},{lbs:100,kg:45},
  {lbs:110,kg:50},{lbs:120,kg:54},{lbs:130,kg:59},{lbs:140,kg:64},{lbs:150,kg:68},
  {lbs:160,kg:73},{lbs:170,kg:77},{lbs:180,kg:82},{lbs:190,kg:86},{lbs:200,kg:91},
];

const POIDS_MACHINE2 = [
  {lbs:40,kg:18},{lbs:60,kg:27},{lbs:80,kg:36},{lbs:100,kg:45},{lbs:120,kg:54},
  {lbs:140,kg:63},{lbs:160,kg:72},{lbs:180,kg:81},{lbs:200,kg:90},{lbs:220,kg:99},
  {lbs:240,kg:108},{lbs:260,kg:117},{lbs:280,kg:126},{lbs:300,kg:135},{lbs:320,kg:144},
  {lbs:340,kg:153},{lbs:360,kg:162},{lbs:380,kg:171},{lbs:400,kg:180},{lbs:420,kg:189},
];

// Poulie 1 : poids réel de référence (lbs/kg) + équivalent P1 Bis, c'est-à-dire
// tel qu'affiché sur une poulie mal étiquetée à la salle, quand il existe.
// La valeur réellement utilisée/enregistrée reste toujours le kg de P1 (jamais P1B).
const POIDS_POULIE1 = [
  {lbs:5,  kg:2.3,  p1bLbs:10,  p1bKg:4.5},
  {lbs:10, kg:4.5,  p1bLbs:25,  p1bKg:11},
  {lbs:15, kg:6.8,  p1bLbs:40,  p1bKg:18},
  {lbs:20, kg:9,    p1bLbs:55,  p1bKg:25},
  {lbs:25, kg:11.3, p1bLbs:70,  p1bKg:32},
  {lbs:30, kg:13.5, p1bLbs:70,  p1bKg:39},
  {lbs:35, kg:15.8, p1bLbs:115, p1bKg:52},
  {lbs:40, kg:18,   p1bLbs:130, p1bKg:59},
  {lbs:45, kg:20.3, p1bLbs:145, p1bKg:66},
  {lbs:50, kg:22.5, p1bLbs:160, p1bKg:73},
  {lbs:55, kg:24.8, p1bLbs:175, p1bKg:79},
  {lbs:60, kg:27,   p1bLbs:190, p1bKg:86},
  {lbs:65, kg:29.3, p1bLbs:205, p1bKg:93},
  {lbs:70, kg:31.5, p1bLbs:220, p1bKg:100},
  {lbs:75, kg:33.8, p1bLbs:235, p1bKg:107},
  {lbs:80, kg:36,   p1bLbs:250, p1bKg:113},
  {lbs:85, kg:38.3, p1bLbs:265, p1bKg:120},
  {lbs:90, kg:40.5, p1bLbs:280, p1bKg:127},
  {lbs:95, kg:42.8, p1bLbs:295, p1bKg:134},
  {lbs:100,kg:45,   p1bLbs:null,p1bKg:null},
];

// Disques combinables (kg), du plus lourd au plus léger — s'additionnent librement.
const POIDS_DISQUES = [20, 10, 5, 2.5, 1.25];

// Haltères : 1 à 10 kg (pas de 1 kg), puis 12 à 64 kg (pas de 2 kg).
const POIDS_HALTERES = (function(){
  const arr = [];
  for (let k=1; k<=10; k++) arr.push(k);
  for (let k=12; k<=64; k+=2) arr.push(k);
  return arr;
})();

// Construit le HTML des repères de poids pour un type donné, avec la valeur
// courante mise en surbrillance (types Machine 1/2, Poulie 1, Haltères).
// Chaque ligne cliquable porte data-kg (valeur à appliquer) et data-mode :
// 'set' remplace le champ, 'add' (type Disque) s'additionne à la valeur déjà saisie.
function renderPoidsLadderHtml(type, currentVal){
  const cur = parseFloat(currentVal);
  if (type === 'Disque') {
    return POIDS_DISQUES.map(kg =>
      `<div class="poids-row" data-kg="${kg}" data-mode="add"><div class="poids-row-main poids-row-solo"><span class="poids-kg">+ ${kg} kg</span></div></div>`
    ).join('');
  }
  if (type === 'Haltères') {
    return POIDS_HALTERES.map(kg => {
      const active = cur === kg;
      return `<div class="poids-row${active?' active':''}" data-kg="${kg}" data-mode="set"><div class="poids-row-main poids-row-solo"><span class="poids-kg">${kg} kg</span></div></div>`;
    }).join('');
  }
  const table = type==='Machine 1' ? POIDS_MACHINE1 : type==='Machine 2' ? POIDS_MACHINE2 : type==='Poulie 1' ? POIDS_POULIE1 : null;
  if (!table) return '<div class="poids-empty">Aucun repère de poids défini pour cet exercice.</div>';
  return table.map(w => {
    const active = cur === w.kg;
    const p1b = (w.p1bKg!=null) ? `<div class="poids-p1b-sub">Poulie mal étiquetée (P1B) : ${w.p1bLbs} lb / ${w.p1bKg} kg</div>` : '';
    return `<div class="poids-row${active?' active':''}" data-kg="${w.kg}" data-mode="set">
      <div class="poids-row-main"><span class="poids-lbs">${w.lbs} lbs</span><span class="poids-dot"></span><span class="poids-kg">${w.kg} kg</span></div>
      ${p1b}
    </div>`;
  }).join('');
}

// Wiring générique : délègue les clics sur les lignes d'un repère de poids vers
// un champ input cible. onAfter (optionnel) est rappelé après chaque clic —
// utile pour ré-afficher la liste et rafraîchir la ligne active.
function wirePoidsLadderClicks(listEl, inputEl, onAfter){
  listEl.querySelectorAll('.poids-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      const kg = parseFloat(row.dataset.kg);
      if (row.dataset.mode === 'add') {
        const base = parseFloat(inputEl.value) || 0;
        inputEl.value = Math.round((base+kg)*100)/100;
      } else {
        inputEl.value = kg;
      }
      // Déclenche 'input' pour que les listeners déjà branchés sur le champ
      // (sauvegarde de la séance en cours, etc.) réagissent normalement.
      inputEl.dispatchEvent(new Event('input', {bubbles:true}));
      if (onAfter) onAfter();
    });
  });
}
