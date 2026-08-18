// Panneau de navigation partagé GymOS — injecté sur toutes les pages sauf login.html
document.body.insertAdjacentHTML('beforeend', `
<!-- ═══════════════ GYMOS NAV PANEL ═══════════════ -->
<div id="gymosNavPanel" style="display:none;position:fixed;inset:0;z-index:9999;align-items:flex-start;justify-content:flex-start">
  <div id="gymosNavBackdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(5px)"></div>
  <div style="position:relative;width:256px;height:100%;background:var(--color-surface,#f9f8f5);border-right:1px solid var(--color-border,#d4d1ca);box-shadow:12px 0 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow-y:auto;z-index:1">
    <!-- Logo + Fermer -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:1.1rem 1rem .9rem;border-bottom:1px solid var(--color-border,#d4d1ca);background:linear-gradient(135deg,var(--color-surface,#f9f8f5),var(--color-surface-offset,#f3f0ec))">
      <div style="display:flex;align-items:center;gap:.6rem">
        <div style="width:34px;height:34px;border-radius:.6rem;background:var(--color-primary-highlight,#cedcd8);display:grid;place-items:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#01696f" stroke-width="1.8" stroke-linecap="round"><path d="M6 18V8.5C6 6.57 7.57 5 9.5 5h.5v14H9.5A3.5 3.5 0 0 1 6 15.5"/><path d="M18 18V8.5C18 6.57 16.43 5 14.5 5H14v14h.5a3.5 3.5 0 0 0 3.5-3.5"/></svg>
        </div>
        <span style="font-weight:800;font-size:.95rem;color:var(--color-text,#28251d)">GymOS</span>
      </div>
      <button id="gymosNavClose" style="border:none;background:none;cursor:pointer;color:var(--color-text-muted,#6e6b64);font-size:1.3rem;line-height:1;padding:.2rem .5rem;border-radius:.35rem;transition:background .12s" onmouseenter="this.style.background='rgba(0,0,0,.06)'" onmouseleave="this.style.background='none'">×</button>
    </div>
    <!-- Recherche globale -->
    <div style="padding:.7rem 1rem .4rem">
      <div style="position:relative">
        <input id="gymosSearchInp" type="text" placeholder="Rechercher exercice, séance, recette… (/)"
          style="width:100%;padding:.5rem .7rem;border-radius:.5rem;border:1px solid var(--color-border,#d4d1ca);background:var(--color-surface-2,#fbfbf9);color:var(--color-text,#28251d);font:inherit;font-size:.76rem;outline:none">
      </div>
      <div id="gymosSearchResults" style="display:none;margin-top:.4rem;max-height:340px;overflow-y:auto;border:1px solid var(--color-border,#d4d1ca);border-radius:.5rem;background:var(--color-surface-2,#fbfbf9)"></div>
    </div>
    <!-- Items nav -->
    <nav id="gymosNavItems" style="padding:.6rem .5rem;display:flex;flex-direction:column;gap:.15rem;flex:1"></nav>
    <!-- Footer -->
    <div style="padding:.65rem 1rem;border-top:1px solid var(--color-border,#d4d1ca);font-size:.62rem;color:var(--color-text-faint,#9a9891);text-align:center;letter-spacing:.04em">GymOS — Gestion Musculation</div>
  </div>
</div>
`);

(function(){
  const PAGES=[
    {href:'index.html',     label:'Accueil',    emoji:'🏠', color:'#01696f'},
    {href:'Dashboard.html', label:'Dashboard',  emoji:'📊', color:'#01696f'},
    {href:'Corps.html',     label:'Corps',      emoji:'💪', color:'#b90207'},
    {href:'Exercices.html', label:'Exercices',  emoji:'🏋', color:'#fa7b01'},
    {href:'Programme.html', label:'Programme',  emoji:'📋', color:'#8338bb'},
    {href:'Seance.html',    label:'Séance',     emoji:'⏱', color:'#437a22'},
    {href:'Historique.html',label:'Historique', emoji:'📅', color:'#0161be'},
    {href:'Progression.html',label:'Progression',emoji:'📈',color:'#5a9d24'},
    {href:'Nutrition.html', label:'Nutrition',  emoji:'🥗', color:'#964219'},
    {href:'Parametres.html',label:'Paramètres', emoji:'⚙️', color:'#6e6b64'},
  ];
  const cur=(window.location.pathname.split('/').pop()||'index.html');
  const nav=document.getElementById('gymosNavItems');
  if(nav){
    PAGES.forEach(p=>{
      const isC=cur===p.href||(cur===''&&p.href==='index.html');
      const a=document.createElement('a');
      a.href=p.href;
      a.style.cssText=`display:flex;align-items:center;gap:.7rem;padding:.58rem .85rem;border-radius:.6rem;font-size:.82rem;font-weight:${isC?700:500};color:${isC?p.color:'var(--color-text,#28251d)'};background:${isC?p.color+'18':'transparent'};text-decoration:none;transition:background .12s,color .12s;border-left:3px solid ${isC?p.color:'transparent'}`;
      const em=document.createElement('span');em.textContent=p.emoji;em.style.cssText='font-size:1rem;width:22px;text-align:center;flex-shrink:0';
      const lb=document.createElement('span');lb.textContent=p.label;lb.style.flex='1';
      a.append(em,lb);
      if(isC){const d=document.createElement('span');d.style.cssText=`width:6px;height:6px;border-radius:50%;background:${p.color};flex-shrink:0`;a.appendChild(d);}
      a.addEventListener('mouseenter',()=>{if(!isC){a.style.background='var(--color-surface-offset,#f3f0ec)';}});
      a.addEventListener('mouseleave',()=>{if(!isC){a.style.background='transparent';}});
      nav.appendChild(a);
    });
  }
  function openNav(){document.getElementById('gymosNavPanel').style.display='flex';}
  function closeNav(){document.getElementById('gymosNavPanel').style.display='none'; clearSearch();}

  // ── Recherche globale (exercices, séances, recettes) ────────────────────
  // Chargement paresseux et indépendant de la page hôte : GymDB.read() ne
  // dépend pas d'un GymDB.init() préalable, donc ça fonctionne sur n'importe
  // quelle page, même si elle n'a jamais elle-même chargé ces documents.
  let _searchData = null;
  let _searchLoading = null;
  function loadSearchData(){
    if (_searchData) return Promise.resolve(_searchData);
    if (_searchLoading) return _searchLoading;
    _searchLoading = Promise.all([
      GymDB.read('exercices.json'),
      GymDB.read('historique.json'),
      GymDB.read('nutrition.json'),
    ]).then(([exoDoc, hist, nutri]) => {
      _searchData = {
        exos: (exoDoc && Array.isArray(exoDoc.rows)) ? exoDoc.rows : [],
        hist: Array.isArray(hist) ? hist : [],
        recipes: [
          ...(((nutri && nutri.recipes) || []).map(r => ({ ...r, _type: 'recipe' }))),
          ...(((nutri && nutri.smoothies) || []).map(r => ({ ...r, _type: 'smoothie' }))),
        ],
      };
      return _searchData;
    });
    return _searchLoading;
  }
  function escSearch(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function renderSearchResults(q){
    const box = document.getElementById('gymosSearchResults');
    if (!q || !_searchData) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const ql = q.toLowerCase();
    const exos = _searchData.exos.filter(e => (e.exercice||'').toLowerCase().includes(ql)).slice(0, 5);
    const seances = _searchData.hist.filter(h => (h.seanceNom||'').toLowerCase().includes(ql)).slice(0, 5);
    const recettes = _searchData.recipes.filter(r => (r.name||'').toLowerCase().includes(ql)).slice(0, 5);
    if (!exos.length && !seances.length && !recettes.length) {
      box.innerHTML = '<div style="padding:.6rem .7rem;font-size:.74rem;color:var(--color-text-faint,#9a9891);font-style:italic">Aucun résultat</div>';
      box.style.display = 'block';
      return;
    }
    const rowStyle = 'display:block;padding:.4rem .7rem;font-size:.78rem;color:var(--color-text,#28251d);cursor:pointer;text-decoration:none;border-radius:.35rem';
    function section(title, items, buildRow){
      if (!items.length) return '';
      return `<div style="padding:.5rem .7rem .15rem;font-size:.6rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-faint,#9a9891)">${title}</div>`
        + items.map(buildRow).join('');
    }
    box.innerHTML =
      section('Exercices', exos, e => `<a href="Exercices.html?q=${encodeURIComponent(e.exercice)}" style="${rowStyle}">🏋 ${escSearch(e.exercice)}<div style="font-size:.65rem;color:var(--color-text-faint,#9a9891)">${escSearch(e.groupe_musculaire||'')}</div></a>`)
      + section('Séances', seances, h => `<a href="Historique.html?id=${encodeURIComponent(h.id)}" style="${rowStyle}">📅 ${escSearch(h.seanceNom||'Séance')}<div style="font-size:.65rem;color:var(--color-text-faint,#9a9891)">${escSearch(h.date||'')}</div></a>`)
      + section('Recettes', recettes, r => `<a href="Nutrition.html?recipe=${encodeURIComponent(r.id)}&type=${r._type}" style="${rowStyle}">${r._type==='smoothie'?'🥤':'📖'} ${escSearch(r.name)}</a>`);
    box.style.display = 'block';
    box.querySelectorAll('a').forEach(a => {
      a.addEventListener('mouseenter', () => a.style.background = 'var(--color-surface-offset,#f3f0ec)');
      a.addEventListener('mouseleave', () => a.style.background = 'none');
    });
  }
  const gymosSearchInp = document.getElementById('gymosSearchInp');
  function clearSearch(){ if(gymosSearchInp) gymosSearchInp.value=''; const r=document.getElementById('gymosSearchResults'); if(r){r.style.display='none';r.innerHTML='';} }
  if (gymosSearchInp) {
    gymosSearchInp.addEventListener('focus', () => loadSearchData().then(() => renderSearchResults(gymosSearchInp.value.trim())));
    gymosSearchInp.addEventListener('input', () => loadSearchData().then(() => renderSearchResults(gymosSearchInp.value.trim())));
  }
  // Raccourci clavier global : "/" ou Ctrl/Cmd+K ouvre le panneau et place le focus
  // dans la recherche, sauf si l'utilisateur est déjà en train de saisir ailleurs.
  document.addEventListener('keydown', e => {
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
      e.preventDefault();
      openNav();
      setTimeout(() => gymosSearchInp && gymosSearchInp.focus(), 30);
    }
  });

  // Remplacer le homeBtn pour ouvrir le nav panel
  const hb=document.getElementById('homeBtn');
  if(hb){
    const nb=hb.cloneNode(true);
    hb.parentNode.replaceChild(nb,hb);
    nb.id='homeBtn';
    nb.title='Navigation';
    nb.addEventListener('click',e=>{e.stopPropagation();openNav();});
  }
  document.getElementById('gymosNavClose').addEventListener('click',closeNav);
  document.getElementById('gymosNavBackdrop').addEventListener('click',closeNav);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav();});
})();
