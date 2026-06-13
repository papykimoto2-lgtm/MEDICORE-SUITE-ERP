// ═══════════════════════════════════════════════════════════════════
// MediCore ERP — Navigation & Interconnexion SYSCOHADA
// Zone OHADA · FCFA · SYSCOHADA Révisé 2017
// ═══════════════════════════════════════════════════════════════════

const MEDICORE_NAV = {
  version: '2.0',
  etablissement: 'CHU MediCore',
  zone: 'OHADA — FCFA',
  exercice: '2025',

  // ── Structure des modules — ordre "marche en avant" (parcours patient) ──
  // Flux clinique sans retour : admission → examens → soins → facturation,
  // puis support back-office, puis pilotage.
  modules: [
    {
      groupe: '1 · Parcours patient',
      icon: '⚕️',
      items: [
        { id: 'dpi',             label: 'Dossier Patient (DPI)', icon: '📋', file: 'dpi.html',             syscohada: '411/706',     statut: 'actif',  alertes: 1, etape: 'Admission' },
        { id: 'laboratoire',     label: 'Laboratoire',           icon: '🔬', file: 'laboratoire.html',     syscohada: '706/411',     statut: 'alerte', alertes: 1, etape: 'Examens' },
        { id: 'imagerie',        label: 'Imagerie Médicale',     icon: '🩻', file: 'imagerie.html',        syscohada: '706/PACS',    statut: 'actif',  alertes: 1, etape: 'Examens' },
        { id: 'bloc_operatoire', label: 'Bloc Opératoire',       icon: '🏥', file: 'bloc_operatoire.html', syscohada: '706/DMI',     statut: 'actif',  alertes: 0, etape: 'Soins' },
        { id: 'pharmacie_pui',   label: 'Pharmacie (PUI)',       icon: '💊', file: 'pharmacie_pui.html',   syscohada: '602/371/411', statut: 'alerte', alertes: 2, etape: 'Soins' },
        { id: 'facturation',     label: 'Facturation',           icon: '🧾', file: 'facturation.html',     syscohada: '411/706/707', statut: 'actif',  alertes: 2, etape: 'Sortie' },
      ]
    },
    {
      groupe: '2 · Finance & support',
      icon: '💼',
      items: [
        { id: 'comptabilite_generale',    label: 'Comptabilité Générale',    icon: '📊', file: 'comptabilite_generale.html',    syscohada: 'Classe 1-8',   statut: 'actif', alertes: 0 },
        { id: 'comptabilite_analytique',  label: 'Compta. Analytique',       icon: '📈', file: 'comptabilite_analytique.html',  syscohada: 'Classe 9',     statut: 'actif', alertes: 0 },
        { id: 'tresorerie',               label: 'Trésorerie',               icon: '💰', file: 'tresorerie.html',               syscohada: '51/52/53',     statut: 'actif', alertes: 0 },
        { id: 'immobilisations',          label: 'Immobilisations',          icon: '🏗️', file: 'immobilisations.html',          syscohada: '2x/28x/681',   statut: 'actif', alertes: 0 },
        { id: 'achats_logistique',        label: 'Achats & Logistique',      icon: '🛒', file: 'achats_logistique.html',        syscohada: '401/601/602',  statut: 'actif', alertes: 1 },
        { id: 'rh_paie',                  label: 'RH & Paie',                icon: '👥', file: 'rh_paie.html',                  syscohada: '641/644/645',  statut: 'actif', alertes: 1 },
      ]
    },
    {
      groupe: '3 · Pilotage & BI',
      icon: '📋',
      items: [
        { id: 'tableaux_de_bord', label: 'Tableaux de bord', icon: '📋', file: 'tableaux_de_bord.html', syscohada: 'Stats/BI', statut: 'actif', alertes: 0 },
      ]
    },
    {
      groupe: '4 · Administration',
      icon: '⚙️',
      items: [
        { id: 'parametrage', label: 'Paramétrage', icon: '⚙️', file: 'parametrage.html', syscohada: 'Config', statut: 'actif', alertes: 0 },
      ]
    }
  ],

  // ── Comptes SYSCOHADA clés ─────────────────────────────────────────
  comptesSYSCOHADA: {
    '101': 'Capital',
    '106': 'Réserves',
    '164': 'Emprunts établissements crédit',
    '211': 'Terrains',
    '213': 'Constructions',
    '224': 'Matériel médical & technique',
    '226': 'Matériel informatique',
    '228': 'Mobilier de bureau',
    '244': 'Matériel de transport',
    '281': 'Amort. immobilisations incorp.',
    '284': 'Amort. matériel & outillage',
    '371': 'Stocks médicaments',
    '372': 'Stocks consommables médicaux',
    '401': 'Fournisseurs',
    '404': 'Fournisseurs immobilisations',
    '411': 'Clients / Patients',
    '421': 'Personnel — Rémunérations dues',
    '431': 'Sécurité sociale & organismes',
    '437': 'Autres organismes sociaux',
    '441': 'État — Subventions à recevoir',
    '511': 'Banque BGFIBANK',
    '512': 'Banque ECOBANK',
    '513': 'Banque BNI CI',
    '530': 'Caisse principale',
    '601': 'Achats matières premières',
    '602': 'Achats produits pharmaceutiques',
    '604': 'Achats études & prestations',
    '606': 'Achats non stockés',
    '641': 'Rémunérations personnel médical',
    '644': 'Rémunérations personnel non-médical',
    '645': 'Charges sécurité sociale',
    '681': 'Dotations aux amortissements',
    '706': 'Prestations soins — CNAM-CI',
    '707': 'Ventes produits (rétrocession)',
    '731': 'Subventions exploitation',
    '741': 'Dotations globales financement',
    '901': 'Charges analytiques personnel',
    '902': 'Charges analytiques médicaments',
    '971': 'Produits analytiques soins',
  },

  // ── KPIs globaux partagés ─────────────────────────────────────────
  kpisGlobaux: {
    resultatExercice: 0,
    tresorerie: 0,
    tol: 0,
    dms: 0,
    sejoursActifs: 0,
    consulMois: 0,
    alertesActives: 0,
  },

  // ── Liens croisés entre modules ───────────────────────────────────
  liensModules: {
    facturation: ['comptabilite_generale', 'tresorerie', 'comptabilite_analytique'],
    comptabilite_generale: ['tresorerie', 'immobilisations', 'facturation'],
    comptabilite_analytique: ['comptabilite_generale', 'tableaux_de_bord'],
    tresorerie: ['comptabilite_generale', 'facturation'],
    immobilisations: ['comptabilite_generale', 'comptabilite_analytique'],
    pharmacie_pui: ['facturation', 'comptabilite_analytique', 'bloc_operatoire'],
    laboratoire: ['facturation', 'tableaux_de_bord'],
    bloc_operatoire: ['pharmacie_pui', 'facturation', 'comptabilite_analytique'],
    dpi: ['pharmacie_pui', 'laboratoire', 'bloc_operatoire', 'facturation'],
    imagerie: ['dpi', 'facturation', 'bloc_operatoire', 'tableaux_de_bord'],
    tableaux_de_bord: ['comptabilite_analytique', 'facturation', 'tresorerie'],
    achats_logistique: ['comptabilite_generale', 'tresorerie', 'pharmacie_pui', 'immobilisations'],
    rh_paie: ['comptabilite_generale', 'tresorerie', 'comptabilite_analytique', 'tableaux_de_bord'],
  }
};

// ── Générateur de sidebar ──────────────────────────────────────────────────────
function buildSidebar(moduleActif) {
  const totalAlertes = MEDICORE_NAV.modules
    .flatMap(g => g.items)
    .reduce((s, i) => s + (i.alertes || 0), 0);

  let html = `
    <div class="sidebar-logo">
      <a href="index.html" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:rgba(255,255,255,.15);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🏥</div>
        <div>
          <span style="font-family:'DM Serif Display',serif;font-size:17px;display:block;line-height:1.1">MediCore ERP</span>
          <small style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:1px">Zone OHADA · FCFA</small>
        </div>
      </a>
    </div>

    <a href="index.html" class="nav-home ${moduleActif === 'index' ? 'active' : ''}">
      <span class="icon">🏠</span> Accueil
      ${totalAlertes > 0 ? `<span class="nav-badge">${totalAlertes}</span>` : ''}
    </a>`;

  MEDICORE_NAV.modules.forEach(groupe => {
    html += `<div class="sidebar-section">${groupe.icon} ${groupe.groupe}</div>`;
    groupe.items.forEach(item => {
      const isActive = item.id === moduleActif;
      const alertBadge = item.alertes > 0 ? `<span class="nav-badge ${item.statut === 'alerte' ? 'red' : ''}">${item.alertes}</span>` : '';
      html += `
        <a class="nav-item ${isActive ? 'active' : ''}" href="${item.file}" title="${item.label} — Compte ${item.syscohada}">
          <span class="icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${alertBadge}
        </a>`;
    });
  });

  html += `
    <div class="sidebar-section">⚙️ Paramètres</div>
    <a class="nav-item" href="#" onclick="showSYSCOHADA();return false"><span class="icon">📖</span><span class="nav-label">Plan comptable</span></a>
    <a class="nav-item" href="#" onclick="showAbout();return false"><span class="icon">ℹ️</span><span class="nav-label">À propos</span></a>
    <div class="sidebar-footer">
      <div style="font-size:11px;opacity:.6;margin-bottom:4px">SYSCOHADA Révisé 2017</div>
      <div style="font-size:11px;opacity:.5">v2.0 · Exercice ${MEDICORE_NAV.exercice}</div>
    </div>`;

  return html;
}

// ── Styles sidebar injectés dynamiquement ─────────────────────────────────────
function injectSidebarStyles() {
  if (document.getElementById('medicore-nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'medicore-nav-styles';
  style.textContent = `
    .sidebar { width:242px;background:var(--accent);color:#fff;display:flex;flex-direction:column;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent; }
    .sidebar-logo { padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,.12); }
    .sidebar-section { padding:14px 12px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:1.4px;opacity:.45;font-weight:700; }
    .nav-home { display:flex;align-items:center;gap:10px;padding:9px 14px;margin:6px 8px 2px;border-radius:6px;cursor:pointer;font-size:13px;opacity:.8;transition:all .15s;color:#fff;text-decoration:none;font-weight:500; }
    .nav-home:hover { background:rgba(255,255,255,.12);opacity:1; }
    .nav-home.active { background:rgba(255,255,255,.2);opacity:1; }
    .nav-item { display:flex;align-items:center;gap:9px;padding:8px 14px;border-radius:6px;margin:1px 8px;cursor:pointer;font-size:13px;opacity:.72;transition:all .15s;color:#fff;text-decoration:none; }
    .nav-item:hover { background:rgba(255,255,255,.1);opacity:1; }
    .nav-item.active { background:rgba(255,255,255,.2);opacity:1;font-weight:600; }
    .nav-item .icon { font-size:15px;width:19px;text-align:center;flex-shrink:0; }
    .nav-label { flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .nav-badge { background:rgba(255,255,255,.25);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;flex-shrink:0; }
    .nav-badge.red { background:var(--red);color:#fff; }
    .sidebar-footer { margin-top:auto;padding:14px 16px;border-top:1px solid rgba(255,255,255,.12);font-size:11.5px;opacity:.55; }

    /* Topbar communes */
    .topbar { background:var(--surface);border-bottom:1px solid var(--border);padding:12px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
    .topbar-left { display:flex;align-items:center;gap:16px; }
    .topbar-breadcrumb { display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-muted); }
    .topbar-breadcrumb a { color:var(--text-muted);text-decoration:none; }
    .topbar-breadcrumb a:hover { color:var(--accent); }
    .topbar-breadcrumb .sep { opacity:.4; }
    .topbar-breadcrumb .current { color:var(--accent);font-weight:600; }
    .topbar-title h1 { font-family:'DM Serif Display',serif;font-size:21px;color:var(--accent);line-height:1.1; }
    .topbar-title p { font-size:12px;color:var(--text-muted);margin-top:2px; }
    .topbar-actions { display:flex;gap:8px;align-items:center;flex-shrink:0; }

    /* Liens croisés */
    .cross-links { display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;background:var(--accent-light);border-bottom:1px solid var(--border); }
    .cross-link { display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:var(--surface);border:1px solid var(--border);border-radius:5px;font-size:12px;color:var(--accent);text-decoration:none;transition:all .15s; }
    .cross-link:hover { background:var(--accent);color:#fff;border-color:var(--accent); }
    .cross-link-label { font-size:10px;color:var(--text-muted);margin-right:4px; }

    /* Modal plan comptable */
    .syscohada-modal { display:none;position:fixed;inset:0;background:rgba(10,20,30,.5);backdrop-filter:blur(4px);z-index:200;align-items:center;justify-content:center; }
    .syscohada-modal.open { display:flex; }
    .syscohada-box { background:var(--surface);border-radius:12px;width:700px;max-width:95vw;max-height:88vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.2); }
    .syscohada-header { padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center; }
    .syscohada-title { font-family:'DM Serif Display',serif;font-size:19px;color:var(--accent); }
    .syscohada-search { width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13.5px;margin:14px 0 10px;outline:none; }
    .syscohada-search:focus { border-color:var(--accent); }
    .syscohada-row { display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px; }
    .syscohada-row:last-child { border-bottom:none; }
    .syscohada-code { font-family:monospace;font-weight:700;color:var(--accent);width:50px;flex-shrink:0; }
    .syscohada-lib { flex:1;color:var(--text); }
  `;
  document.head.appendChild(style);
}

// ── Injection automatique sidebar + topbar ────────────────────────────────────
function initNav(moduleActif, moduleLabel, moduleDesc, breadcrumb) {
  injectSidebarStyles();

  // Sidebar
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.innerHTML = buildSidebar(moduleActif);

  // Breadcrumb + topbar
  const topbarLeft = document.querySelector('.topbar-left');
  if (topbarLeft && breadcrumb) {
    let bcHtml = `<div class="topbar-breadcrumb">
      <a href="index.html">🏠 Accueil</a>`;
    breadcrumb.forEach((bc, i) => {
      bcHtml += `<span class="sep">›</span>`;
      if (i < breadcrumb.length - 1) bcHtml += `<a href="${bc.file}">${bc.label}</a>`;
      else bcHtml += `<span class="current">${bc.label}</span>`;
    });
    bcHtml += `</div>`;
    topbarLeft.insertAdjacentHTML('afterbegin', bcHtml);
  }

  // Liens croisés
  const liensMod = MEDICORE_NAV.liensModules[moduleActif] || [];
  if (liensMod.length > 0) {
    const allItems = MEDICORE_NAV.modules.flatMap(g => g.items);
    const crossHtml = `<div class="cross-links">
      <span class="cross-link-label">🔗 Modules liés :</span>
      ${liensMod.map(id => {
        const mod = allItems.find(m => m.id === id);
        return mod ? `<a class="cross-link" href="${mod.file}">${mod.icon} ${mod.label} <small style="opacity:.6;font-size:10px">${mod.syscohada}</small></a>` : '';
      }).join('')}
    </div>`;
    const content = document.querySelector('.content');
    if (content) content.insertAdjacentHTML('beforebegin', crossHtml);
  }

  // Modal plan comptable (une seule instance)
  if (!document.getElementById('syscohada-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
    <div class="syscohada-modal" id="syscohada-modal">
      <div class="syscohada-box">
        <div class="syscohada-header">
          <div class="syscohada-title">📖 Plan comptable SYSCOHADA</div>
          <button onclick="document.getElementById('syscohada-modal').classList.remove('open')" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--text-muted)">✕</button>
        </div>
        <div style="padding:0 24px 20px">
          <input class="syscohada-search" type="text" placeholder="Rechercher un compte…" oninput="filterSYSCOHADA(this.value)" id="syscohada-search">
          <div id="syscohada-list">${Object.entries(MEDICORE_NAV.comptesSYSCOHADA).map(([k,v])=>
            `<div class="syscohada-row" data-compte="${k}" data-lib="${v.toLowerCase()}">
              <span class="syscohada-code">${k}</span>
              <span class="syscohada-lib">${v}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`);

    // Fermer en cliquant l'overlay — getElementById sécurisé
    const sysModal = document.getElementById('syscohada-modal');
    if (sysModal) {
      sysModal.addEventListener('click', e => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
      });
    }
  }
}

function showSYSCOHADA() {
  const m = document.getElementById('syscohada-modal');
  const s = document.getElementById('syscohada-search');
  if (m) m.classList.add('open');
  if (s) s.focus();
}

function filterSYSCOHADA(q) {
  const rows = document.querySelectorAll('#syscohada-list .syscohada-row');
  const s = q.toLowerCase();
  rows.forEach(r => {
    r.style.display = (r.dataset.compte.includes(s) || r.dataset.lib.includes(s)) ? '' : 'none';
  });
}

function showAbout() {
  alert(`MediCore ERP v2.0\n\nÉtablissement : ${MEDICORE_NAV.etablissement}\nZone : ${MEDICORE_NAV.zone}\nRéférentiel : SYSCOHADA Révisé 2017\nExercice : ${MEDICORE_NAV.exercice}\n\n16 modules interconnectés`);
}

// ── Utilitaires partagés ──────────────────────────────────────────────────────
window.fmtFCFA = v => Math.round(v||0).toLocaleString('fr-FR') + ' FCFA';
window.fmtM    = v => (v/1000000).toFixed(1) + ' M FCFA';
window.fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

window.showToast = function(msg, type='') {
  let tc = document.getElementById('toast-container');
  if (!tc) { tc = document.createElement('div'); tc.id='toast-container'; tc.style.cssText='position:fixed;top:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:999'; document.body.appendChild(tc); }
  const colors = { success:'#1e7a4e', error:'#b92b2b', warn:'#b05b00' };
  const t = document.createElement('div');
  t.style.cssText = `background:${colors[type]||'#1c1c1c'};color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.15);animation:toastIn .25s ease,toastOut .3s ease 2.5s forwards;font-family:'DM Sans',sans-serif`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

// Auto-injecter les keyframes toast si pas encore présents
if (!document.getElementById('toast-kf')) {
  const kf = document.createElement('style');
  kf.id = 'toast-kf';
  kf.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}@keyframes toastOut{to{opacity:0;transform:translateX(30px)}}';
  document.head.appendChild(kf);
}

// ── Topbar unifié ──────────────────────────────────────────────────────────────
function buildTopbar(moduleId, moduleLabel, moduleDesc, comptesSYSCOHADA) {
  const allItems = MEDICORE_NAV.modules.flatMap(g => g.items);
  const mod = allItems.find(m => m.id === moduleId);
  const alertes = MEDICORE_NAV.kpisGlobaux.alertesActives;

  const topbarEl = document.querySelector('.topbar');
  if (!topbarEl) return;

  // Breadcrumb
  const bcHtml = `
    <div class="topbar-left">
      <div class="topbar-breadcrumb">
        <a href="index.html">🏠</a>
        <span class="sep">›</span>
        <span style="color:var(--text-muted)">${mod ? MEDICORE_NAV.modules.find(g=>g.items.includes(mod))?.groupe || '' : ''}</span>
        <span class="sep">›</span>
        <span class="current">${moduleLabel}</span>
      </div>
    </div>`;

  // Insérer breadcrumb avant le title
  const titleDiv = topbarEl.querySelector('.topbar-title');
  if (titleDiv && !topbarEl.querySelector('.topbar-breadcrumb')) {
    titleDiv.insertAdjacentHTML('beforebegin', bcHtml);
  }

  // Ajouter compte SYSCOHADA badge dans le titre
  if (comptesSYSCOHADA && titleDiv) {
    const existing = titleDiv.querySelector('.syscohada-topbar-badge');
    if (!existing) {
      const badge = document.createElement('span');
      badge.className = 'syscohada-topbar-badge';
      badge.style.cssText = 'display:inline-block;background:var(--accent2-light);color:var(--accent2);font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;margin-left:8px;vertical-align:middle;border:1px solid rgba(200,112,42,.3);cursor:pointer';
      badge.textContent = comptesSYSCOHADA;
      badge.title = 'Comptes SYSCOHADA concernés — cliquez pour le plan comptable';
      badge.onclick = showSYSCOHADA;
      const h1 = titleDiv.querySelector('h1');
      if (h1) h1.appendChild(badge);
    }
  }

  // Bouton plan comptable dans actions
  const actionsDiv = topbarEl.querySelector('.topbar-actions');
  if (actionsDiv && !actionsDiv.querySelector('.btn-syscohada')) {
    const btnSys = document.createElement('button');
    btnSys.className = 'btn btn-secondary btn-syscohada';
    btnSys.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:12.5px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);transition:all .15s';
    btnSys.innerHTML = '📖 Plan comptable';
    btnSys.onclick = showSYSCOHADA;
    actionsDiv.insertBefore(btnSys, actionsDiv.firstChild);
  }

  // Indicateur alertes dans topbar
  if (alertes > 0 && actionsDiv && !actionsDiv.querySelector('.btn-alertes')) {
    const btnAl = document.createElement('a');
    btnAl.className = 'btn-alertes';
    btnAl.href = 'index.html';
    btnAl.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:6px;background:var(--red-bg);color:var(--red);border:1px solid #f3b4b4;font-size:12.5px;font-weight:500;text-decoration:none';
    btnAl.innerHTML = `🔔 ${alertes}`;
    btnAl.title = `${alertes} alerte(s) active(s)`;
    actionsDiv.insertBefore(btnAl, actionsDiv.firstChild);
  }
}

// ── Liens croisés améliorés ────────────────────────────────────────────────────
function buildCrossLinks(moduleId) {
  const liensMod = MEDICORE_NAV.liensModules[moduleId] || [];
  if (!liensMod.length) return;

  const allItems = MEDICORE_NAV.modules.flatMap(g => g.items);
  const existing = document.querySelector('.cross-links');
  if (existing) return;

  const crossDiv = document.createElement('div');
  crossDiv.className = 'cross-links';
  crossDiv.innerHTML = `
    <span class="cross-link-label">🔗 Flux SYSCOHADA :</span>
    ${liensMod.map(id => {
      const mod = allItems.find(m => m.id === id);
      if (!mod) return '';
      return `<a class="cross-link" href="${mod.file}" title="Compte ${mod.syscohada}">
        ${mod.icon} ${mod.label}
        <span style="font-size:10px;opacity:.6;margin-left:3px">${mod.syscohada}</span>
      </a>`;
    }).join('')}`;

  const content = document.querySelector('.content');
  if (content) content.parentNode.insertBefore(crossDiv, content);
}

// ── Override de initNav pour inclure topbar ────────────────────────────────────
const _origInitNav = initNav;
window.initNav = function(moduleId, moduleLabel, moduleDesc, breadcrumb) {
  _origInitNav(moduleId, moduleLabel, moduleDesc, breadcrumb);
  buildTopbar(moduleId, moduleLabel, moduleDesc,
    MEDICORE_NAV.modules.flatMap(g=>g.items).find(m=>m.id===moduleId)?.syscohada
  );
  buildCrossLinks(moduleId);
};

// ══════════════════════════════════════════════════════════════════════════════
// RESPONSIVE MOBILE — Hamburger + Drawer + mobile.css injection
// ══════════════════════════════════════════════════════════════════════════════

function injectMobileCSS() {
  // Ne pas injecter si déjà présent (lien statique dans le HTML ou injection précédente)
  if (document.querySelector('link[href="mobile.css"]') ||
      document.getElementById('medicore-mobile-css')) return;
  const link = document.createElement('link');
  link.id = 'medicore-mobile-css';
  link.rel = 'stylesheet';
  link.href = 'mobile.css';
  document.head.appendChild(link);
}

function buildHamburger() {
  if (document.getElementById('hamburger-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'hamburger-btn';
  btn.className = 'hamburger-btn';
  btn.setAttribute('aria-label', 'Menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `<span><i></i><i></i><i></i></span>`;
  btn.addEventListener('click', toggleDrawer);

  // Injecter en premier dans .topbar-left
  const topbarLeft = document.querySelector('.topbar-left');
  if (topbarLeft) {
    topbarLeft.insertBefore(btn, topbarLeft.firstChild);
  } else {
    // Fallback : avant le titre
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.insertBefore(btn, topbar.firstChild);
  }
}

function buildSidebarOverlay() {
  if (document.getElementById('sidebar-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  overlay.className = 'sidebar-overlay';
  overlay.addEventListener('click', closeDrawer);
  document.body.appendChild(overlay);
}

function toggleDrawer() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  const isOpen = sidebar && sidebar.classList.contains('open');
  if (isOpen) closeDrawer();
  else openDrawer();
}

function openDrawer() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('open');
  if (btn) { btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  document.body.style.overflow = '';
}

// Fermer le drawer quand on clique un lien nav (mobile)
function bindNavLinks() {
  document.querySelectorAll('.nav-item, .nav-home').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) closeDrawer();
    });
  });
}

// Fermer sur Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
});

// Fermer si on redimensionne vers desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) closeDrawer();
});

// ── Override initNav pour inclure mobile ──────────────────────────────────────
const _origInitNavMobile = window.initNav;
window.initNav = function(moduleId, moduleLabel, moduleDesc, breadcrumb) {
  injectMobileCSS();
  _origInitNavMobile(moduleId, moduleLabel, moduleDesc, breadcrumb);
  buildHamburger();
  buildSidebarOverlay();
  setTimeout(bindNavLinks, 100);
};

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT ACTIF — Suivi "marche en avant" par QR code
// Le patient identifié à l'admission est porté de module en module via un QR
// (bracelet) et un identifiant permanent (IPP). Stockage local offline-first.
// ══════════════════════════════════════════════════════════════════════════════

// Identifiant Permanent Patient dérivé du n° de dossier
function ippFromDossier(id){
  return 'IPP-' + String(id).replace(/\D/g,'').slice(-6).padStart(6,'0');
}

const MEDICORE_PATIENT = {
  KEY: 'medicore_patient_actif',

  get(){ try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch(e){ return null; } },
  set(p){
    if(!p) return;
    if(!p.ipp) p.ipp = ippFromDossier(p.id || p.dossier || '');
    try { localStorage.setItem(this.KEY, JSON.stringify(p)); } catch(e){}
    this.renderChip();
  },
  clear(){ try { localStorage.removeItem(this.KEY); } catch(e){} this.renderChip(); },

  // Contenu encodé dans le QR (scannable par smartphone)
  payload(p){
    const base = (location.origin && location.origin.indexOf('http')===0)
      ? location.origin + location.pathname.replace(/[^/]+$/, '') : '';
    return base + 'dpi.html?patient=' + encodeURIComponent(p.id||p.dossier||'') +
           '  [IPP ' + (p.ipp||ippFromDossier(p.id||'')) + ' - ' + (p.nom||'') + ']';
  },

  // SVG QR (nécessite qr.js / qrcode.js ; dégrade proprement sinon)
  qrSVG(text, cell){
    if(typeof qrcode === 'undefined'){
      return '<div style="font-size:10px;color:#b92b2b;text-align:center">QR<br>indisponible</div>';
    }
    try {
      const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
      return qr.createSvgTag({ cellSize: cell||4, margin: 2, scalable: true });
    } catch(e){ return '<div style="font-size:10px;color:#b92b2b">QR err</div>'; }
  },

  // Chip persistante dans la topbar (présente sur toutes les pages)
  renderChip(){
    const topbar = document.querySelector('.topbar');
    if(!topbar) return;
    let chip = document.getElementById('patient-actif-chip');
    const p = this.get();
    if(!p){ if(chip) chip.remove(); return; }
    if(!chip){
      chip = document.createElement('div');
      chip.id = 'patient-actif-chip';
      chip.style.cssText = 'display:flex;align-items:center;gap:10px;margin-left:auto;'+
        'background:#e8f0f7;border:1px solid #1a4b6e33;border-radius:30px;'+
        'padding:5px 8px 5px 14px;font-size:12.5px;color:#1a4b6e;cursor:pointer';
      topbar.appendChild(chip);
    }
    chip.innerHTML =
      '<span style="font-size:15px">🪪</span>'+
      '<div style="line-height:1.2"><div style="font-weight:600">'+ (p.nom||'Patient') +'</div>'+
      '<div style="font-size:10.5px;opacity:.7">'+ (p.ipp||'') + (p.lit&&p.lit!=='—'?' · Lit '+p.lit:'') +'</div></div>'+
      '<button title="Afficher le QR" onclick="event.stopPropagation();MEDICORE_PATIENT.showQR()" '+
        'style="border:none;background:#1a4b6e;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px">▦</button>'+
      '<button title="Retirer le patient actif" onclick="event.stopPropagation();MEDICORE_PATIENT.clear()" '+
        'style="border:none;background:none;color:#1a4b6e99;cursor:pointer;font-size:15px">✕</button>';
    chip.onclick = ()=>{ location.href = 'dpi.html?patient=' + encodeURIComponent(p.id||p.dossier||''); };
  },

  // Modale QR (affichage + impression bracelet)
  showQR(){
    const p = this.get(); if(!p) return;
    let ov = document.getElementById('patient-qr-overlay');
    if(ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'patient-qr-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    ov.onclick = e=>{ if(e.target===ov) ov.remove(); };
    ov.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:24px;width:330px;text-align:center;font-family:DM Sans,sans-serif">'+
        '<div style="font-family:DM Serif Display,serif;font-size:18px;color:#1a4b6e;margin-bottom:4px">QR patient</div>'+
        '<div style="font-size:12px;color:#6b6b6b;margin-bottom:14px">Identito-vigilance — '+ (p.ipp||'') +'</div>'+
        '<div style="display:flex;justify-content:center;margin-bottom:12px">'+ this.qrSVG(this.payload(p),5) +'</div>'+
        '<div style="font-weight:600;font-size:15px">'+ (p.nom||'') +'</div>'+
        '<div style="font-size:12px;color:#6b6b6b;margin-bottom:16px">Dossier '+ (p.id||p.dossier||'') + (p.service?' · '+p.service:'') +'</div>'+
        '<div style="display:flex;gap:8px">'+
          '<button onclick="MEDICORE_PATIENT.printBracelet()" style="flex:1;padding:9px;border:none;border-radius:8px;background:#1a4b6e;color:#fff;cursor:pointer;font-weight:500">🖨 Imprimer le bracelet</button>'+
          '<button onclick="document.getElementById(\'patient-qr-overlay\').remove()" style="padding:9px 14px;border:1px solid #e2dfd8;border-radius:8px;background:#fff;cursor:pointer">Fermer</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
  },

  // Bracelet imprimable (fenêtre dédiée)
  printBracelet(){
    const p = this.get(); if(!p) return;
    const svg = this.qrSVG(this.payload(p), 4);
    const w = window.open('', '_blank', 'width=520,height=320');
    w.document.write(
      '<html><head><title>Bracelet '+(p.ipp||'')+'</title><style>'+
      'body{font-family:Arial,sans-serif;margin:0;padding:14px}'+
      '.bracelet{border:2px solid #1a4b6e;border-radius:10px;display:flex;gap:14px;align-items:center;padding:12px 16px;max-width:480px}'+
      '.qr{width:120px;flex-shrink:0}.qr svg{width:120px;height:120px}'+
      '.info div{margin:2px 0;font-size:13px}.nom{font-size:17px;font-weight:bold;color:#1a4b6e}'+
      '.alerte{color:#b92b2b;font-weight:bold}@media print{button{display:none}}'+
      '</style></head><body>'+
      '<div class="bracelet"><div class="qr">'+svg+'</div>'+
      '<div class="info"><div class="nom">'+(p.nom||'')+'</div>'+
      '<div><b>IPP :</b> '+(p.ipp||'')+'</div>'+
      '<div><b>Dossier :</b> '+(p.id||p.dossier||'')+'</div>'+
      (p.ddn?'<div><b>Né(e) le :</b> '+p.ddn+'</div>':'')+
      (p.service?'<div><b>Service :</b> '+p.service+'</div>':'')+
      (p.lit&&p.lit!=='—'?'<div><b>Lit :</b> '+p.lit+'</div>':'')+
      (p.allergies?'<div class="alerte">⚠ Allergie : '+p.allergies+'</div>':'')+
      '</div></div>'+
      '<button onclick="window.print()" style="margin-top:14px;padding:8px 16px;border:none;border-radius:6px;background:#1a4b6e;color:#fff;cursor:pointer">🖨 Imprimer</button>'+
      '</body></html>');
    w.document.close();
  }
};

// Au chargement : lire ?patient=ID (scan QR / lien) et afficher la chip
document.addEventListener('DOMContentLoaded', function(){
  try {
    const q = new URLSearchParams(location.search).get('patient');
    if(q){
      const cur = MEDICORE_PATIENT.get();
      if(!cur || (cur.id||cur.dossier) !== q){
        // Contexte minimal ; DPI enrichira si le dossier est connu
        if(typeof window.patients !== 'undefined' && Array.isArray(window.patients)){
          const found = window.patients.find(x=>x.id===q);
          if(found) MEDICORE_PATIENT.set(Object.assign({}, found));
          else MEDICORE_PATIENT.set({ id:q, nom:'Dossier '+q });
        } else {
          MEDICORE_PATIENT.set({ id:q, nom:'Dossier '+q });
        }
      }
    }
  } catch(e){}
  setTimeout(()=>MEDICORE_PATIENT.renderChip(), 150);
});

// ══════════════════════════════════════════════════════════════════════════════
// MEDICORE_BUS — Canal inter-modules (localStorage, offline-first)
// Permet aux modules d'échanger des événements sans backend :
//   prescriptions en attente PUI, résultats labo disponibles,
//   sorties à facturer, alertes stock, etc.
// ══════════════════════════════════════════════════════════════════════════════
const MEDICORE_BUS = {
  KEY: 'medicore_bus',
  MAX: 100, // limite circulaire

  // Lire tous les événements
  all(){ try{ return JSON.parse(localStorage.getItem(this.KEY))||[]; }catch(e){ return []; } },

  // Publier un événement
  // type : 'PRESCRIPTION_ATTENTE_PUI' | 'LABO_RESULTATS_PRETS' | 'SORTIE_A_FACTURER' |
  //        'STOCK_ALERTE' | 'IMMO_ACQUISE' | 'COMPTA_ECRITURE' | etc.
  publish(type, payload){
    const events = this.all();
    events.push({
      id: Date.now()+'-'+Math.random().toString(36).slice(2,7),
      type, payload,
      ts: new Date().toISOString(),
      lu: false,
      source: location.pathname.split('/').pop().replace('.html','')
    });
    // Garder les MAX derniers
    if(events.length > this.MAX) events.splice(0, events.length - this.MAX);
    try{ localStorage.setItem(this.KEY, JSON.stringify(events)); }catch(e){}
    this._updateBadges();
  },

  // Marquer comme lu (par type ou id)
  markRead(type){
    const events = this.all().map(e => e.type===type ? {...e, lu:true} : e);
    try{ localStorage.setItem(this.KEY, JSON.stringify(events)); }catch(e){}
    this._updateBadges();
  },

  // Compter les non lus par type
  count(type){ return this.all().filter(e=>!e.lu && e.type===type).length; },

  // Obtenir les N derniers d'un type
  get(type, n){ return this.all().filter(e=>e.type===type).slice(-( n||20)); },

  // Mettre à jour les badges de la sidebar selon le bus
  _updateBadges(){
    const BADGE_MAP = {
      'pharmacie_pui':   ['PRESCRIPTION_ATTENTE_PUI','STOCK_ALERTE'],
      'laboratoire':     ['LABO_DEMANDE_URGENTE'],
      'facturation':     ['SORTIE_A_FACTURER'],
      'dpi':             ['LABO_RESULTATS_PRETS','IMAGERIE_CR_PRET'],
      'achats_logistique':['STOCK_ALERTE'],
    };
    Object.entries(BADGE_MAP).forEach(([modId, types]) => {
      const count = types.reduce((s,t) => s + this.count(t), 0);
      // Mettre à jour le badge dans la nav
      const link = document.querySelector(`.nav-item[href="${modId}.html"] .nav-badge`);
      if(link && count > 0){ link.textContent = count; link.style.display=''; }
    });
  },

  // Nettoyer les événements lus de plus de 7 jours
  purge(){
    const cutoff = Date.now() - 7*86400000;
    const kept = this.all().filter(e => !e.lu || new Date(e.ts).getTime() > cutoff);
    try{ localStorage.setItem(this.KEY, JSON.stringify(kept)); }catch(e){}
  }
};

// ── Liens profonds inter-modules (navigation contextuelle) ─────────────────────
// Chaque fonction construit une URL avec le contexte du patient actif + action
const MEDICORE_GOTO = {

  // DPI → Laboratoire : créer une demande pour le patient actif
  labo(raison){
    const p = MEDICORE_PATIENT.get();
    const url = 'laboratoire.html' + (p ? '?patient='+encodeURIComponent(p.id||p.dossier||'')+'&raison='+encodeURIComponent(raison||'') : '');
    window.location.href = url;
  },

  // DPI → Imagerie : créer une demande pour le patient actif
  imagerie(type, indication){
    const p = MEDICORE_PATIENT.get();
    const url = 'imagerie.html' + (p ? '?patient='+encodeURIComponent(p.id||p.dossier||'')+'&type='+encodeURIComponent(type||'')+'&indication='+encodeURIComponent(indication||'') : '');
    window.location.href = url;
  },

  // DPI / Bloc → Pharmacie : valider prescription
  pharmacie(prescId){
    const p = MEDICORE_PATIENT.get();
    const url = 'pharmacie_pui.html' + (p ? '?patient='+encodeURIComponent(p.id||p.dossier||'')+(prescId?'&presc='+encodeURIComponent(prescId):'') : '');
    window.location.href = url;
  },

  // DPI (sortie) → Facturation : pré-remplir la facture
  facturation(sejour){
    const p = MEDICORE_PATIENT.get();
    const params = p ? '?patient='+encodeURIComponent(p.id||p.dossier||'')+'&nom='+encodeURIComponent(p.nom||'')+'&ipp='+encodeURIComponent(p.ipp||'')+(sejour?'&sejour='+encodeURIComponent(sejour):'') : '';
    window.location.href = 'facturation.html'+params;
  },

  // Pharmacie → Achats : créer un BC pour un produit en rupture
  achats(produit, urgence){
    const url = 'achats_logistique.html?action=bc&produit='+encodeURIComponent(produit||'')+'&urgence='+encodeURIComponent(urgence||'Normale');
    window.location.href = url;
  },

  // Tout module → DPI : retour au dossier du patient actif
  dpi(){
    const p = MEDICORE_PATIENT.get();
    window.location.href = p ? 'dpi.html?patient='+encodeURIComponent(p.id||p.dossier||'') : 'dpi.html';
  },

  // Tout module → Tableaux de bord
  pilotage(onglet){
    window.location.href = 'tableaux_de_bord.html'+(onglet?'?tab='+onglet:'');
  }
};

// ── Injection des boutons de navigation contextuelle dans la chip patient ──────
// Ajoute un menu "Naviguer vers…" dans la modale QR quand le patient est actif
const _origShowQR = MEDICORE_PATIENT.showQR.bind(MEDICORE_PATIENT);
MEDICORE_PATIENT.showQR = function(){
  _origShowQR();
  // Ajouter les liens rapides après un tick
  setTimeout(()=>{
    const ov = document.getElementById('patient-qr-overlay');
    if(!ov) return;
    const p = this.get(); if(!p) return;
    const page = location.pathname.split('/').pop();
    // Ne pas montrer le lien vers la page courante
    const liens = [
      {label:'📋 DPI',     fn:"MEDICORE_GOTO.dpi()",          hide:'dpi.html'},
      {label:'🔬 Labo',    fn:"MEDICORE_GOTO.labo('')",        hide:'laboratoire.html'},
      {label:'🩻 Imagerie',fn:"MEDICORE_GOTO.imagerie('','')", hide:'imagerie.html'},
      {label:'💊 PUI',     fn:"MEDICORE_GOTO.pharmacie()",     hide:'pharmacie_pui.html'},
      {label:'🧾 Facture', fn:"MEDICORE_GOTO.facturation()",   hide:'facturation.html'},
    ].filter(l => l.hide !== page);

    const nav = document.createElement('div');
    nav.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;border-top:1px solid #e2dfd8;padding-top:10px';
    nav.innerHTML='<div style="width:100%;font-size:11px;color:#6b6b6b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Naviguer vers</div>'+
      liens.map(l=>`<button onclick="${l.fn};document.getElementById('patient-qr-overlay').remove()" style="padding:6px 10px;border:1px solid #e2dfd8;border-radius:6px;background:#fff;cursor:pointer;font-size:12.5px">${l.label}</button>`).join('');
    ov.querySelector('.modal')?.appendChild(nav);
  }, 50);
};

// ── Lire les paramètres URL à l'arrivée sur un module ─────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  const params = new URLSearchParams(location.search);

  // Pre-fill depuis URL : facturation ?nom= &ipp= &sejour=
  if(params.get('nom') && typeof document.getElementById === 'function'){
    const nomEl = document.getElementById('f-nom');
    if(nomEl && !nomEl.value) nomEl.value = params.get('nom');
    const nssEl = document.getElementById('f-nss');
    if(nssEl && !nssEl.value) nssEl.value = params.get('ipp')||'';
    const sejEl = document.getElementById('f-sejour');
    if(sejEl && !sejEl.value) sejEl.value = params.get('sejour')||'';
  }

  // Pre-fill depuis URL : imagerie ?type= &indication=
  if(params.get('indication') && typeof document.getElementById === 'function'){
    const indEl = document.getElementById('d-indication');
    if(indEl && !indEl.value) indEl.value = params.get('indication');
    const typeEl = document.getElementById('d-type');
    if(typeEl && params.get('type')){
      for(let i=0;i<typeEl.options.length;i++){
        if(typeEl.options[i].value===params.get('type')){typeEl.selectedIndex=i;break;}
      }
      if(typeof updateExamensList==='function') updateExamensList();
    }
    // Ouvrir la modal si on arrive avec indication
    setTimeout(()=>{if(typeof openDemande==='function') openDemande();},400);
  }

  // Pre-fill depuis URL : achats ?action=bc &produit= &urgence=
  if(params.get('action')==='bc' && typeof document.getElementById === 'function'){
    setTimeout(()=>{
      if(typeof openBC==='function') openBC();
      const obEl=document.getElementById('bc-objet');
      if(obEl && params.get('produit')) obEl.value='Approvisionnement : '+params.get('produit');
      const urgEl=document.getElementById('bc-urgence');
      if(urgEl && params.get('urgence')){
        for(let i=0;i<urgEl.options.length;i++){
          if(urgEl.options[i].value===params.get('urgence')){urgEl.selectedIndex=i;break;}
        }
      }
    },400);
  }

  // Purge périodique du bus
  try{ MEDICORE_BUS.purge(); }catch(e){}
});
