// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Dock UI des demandes inter-modules (auto-injecté)
// ──────────────────────────────────────────────────────────────────────────────
// Inclure APRÈS medicore-demandes.js dans n'importe quelle page module :
//   <script src="medicore-demandes.js"></script>
//   <script src="medicore-demandes-ui.js"></script>
// S'auto-monte selon le module courant (location). Aucune édition de page requise.
//   • Onglet « Reçues »      : file d'attente si le module est une cible.
//   • Onglet « Mes retours »  : résultats renvoyés au module demandeur.
//   • Bouton « ＋ Demander »  : modale de création vers un module cible.
// ══════════════════════════════════════════════════════════════════════════════

(function(){
  if(typeof MEDICORE_DEMANDES==='undefined'){ console.warn('[Demandes UI] medicore-demandes.js manquant'); return; }
  const D = MEDICORE_DEMANDES;

  function moduleCourant(){ return location.pathname.split('/').pop().replace('.html',''); }
  function estCible(m){ return !!D.MODULES[m]; }

  function patientActif(){
    try{ if(typeof MEDICORE_PATIENT!=='undefined'){ const p=MEDICORE_PATIENT.get(); if(p) return { id:p.id||p.dossier||'', nom:p.nom||'', ipp:p.ipp||'' }; } }catch(e){}
    return null;
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  function injectCSS(){
    if(document.getElementById('dem-ui-css')) return;
    const s=document.createElement('style'); s.id='dem-ui-css';
    s.textContent=`
    #dem-dock{position:fixed;right:18px;bottom:18px;z-index:9000;font-family:'DM Sans',system-ui,sans-serif}
    #dem-fab{display:flex;align-items:center;gap:8px;background:#1C1C2E;color:#fff;border:none;border-radius:28px;
      padding:11px 18px;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22)}
    #dem-fab .dem-dot{background:#B87333;color:#fff;border-radius:20px;min-width:20px;height:20px;display:inline-flex;
      align-items:center;justify-content:center;font-size:11.5px;padding:0 5px}
    #dem-panel{display:none;position:absolute;right:0;bottom:56px;width:380px;max-width:92vw;max-height:72vh;
      background:#fff;border:1px solid #e2dfd8;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.22);overflow:hidden;flex-direction:column}
    #dem-panel.open{display:flex}
    .dem-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e2dfd8;background:#f8f7f2}
    .dem-head b{font-size:14px}
    .dem-tabs{display:flex;border-bottom:1px solid #e2dfd8}
    .dem-tab{flex:1;padding:9px;border:none;background:#fff;cursor:pointer;font-size:12.5px;font-weight:600;color:#6b6b6b}
    .dem-tab.active{color:#1C1C2E;box-shadow:inset 0 -2px 0 #B87333}
    .dem-tab .b{background:#B87333;color:#fff;border-radius:10px;font-size:10.5px;padding:0 5px;margin-left:4px}
    .dem-body{overflow-y:auto;padding:12px;background:#f4f2ec;flex:1}
    .dem-foot{padding:10px 12px;border-top:1px solid #e2dfd8;background:#fff}
    .dem-foot button{width:100%;padding:9px;border:none;border-radius:7px;background:#B87333;color:#fff;font-weight:600;font-size:13px;cursor:pointer}
    .dem-x{border:none;background:none;font-size:18px;cursor:pointer;color:#6b6b6b}
    .dem-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9500;display:none;align-items:center;justify-content:center}
    .dem-ov.open{display:flex}
    .dem-modal{background:#fff;border-radius:12px;width:440px;max-width:94vw;max-height:90vh;overflow-y:auto;padding:20px}
    .dem-modal h3{margin:0 0 14px;font-size:16px}
    .dem-modal label{display:block;font-size:12px;font-weight:600;color:#6b6b6b;margin:9px 0 3px}
    .dem-modal input,.dem-modal select,.dem-modal textarea{width:100%;padding:8px 10px;border:1px solid #e2dfd8;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box}
    .dem-modal .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .dem-modal .acts{display:flex;gap:8px;margin-top:16px}
    .dem-modal .acts button{flex:1;padding:9px;border-radius:7px;font-weight:600;font-size:13px;cursor:pointer}
    .dem-primary{background:#1C1C2E;color:#fff;border:none}
    .dem-cancel{background:#fff;color:#1C1C2E;border:1px solid #e2dfd8}`;
    document.head.appendChild(s);
  }

  // ── DOM dock ──────────────────────────────────────────────────────────────────
  function buildDock(){
    const mod = moduleCourant();
    const cible = estCible(mod);
    const dock=document.createElement('div'); dock.id='dem-dock';
    dock.innerHTML=`
      <div id="dem-panel">
        <div class="dem-head"><b>Échanges inter-services</b><button class="dem-x" onclick="DEM_UI.toggle(false)">✕</button></div>
        <div class="dem-tabs">
          ${cible?`<button class="dem-tab active" data-t="recues" onclick="DEM_UI.tab('recues')">Reçues <span class="b" id="dem-b-recues">0</span></button>`:''}
          <button class="dem-tab ${cible?'':'active'}" data-t="retours" onclick="DEM_UI.tab('retours')">Mes retours <span class="b" id="dem-b-retours">0</span></button>
          <button class="dem-tab" data-t="refusees" onclick="DEM_UI.tab('refusees')">Refusées <span class="b" id="dem-b-refusees">0</span></button>
        </div>
        <div class="dem-body">
          ${cible?'<div id="dem-recues"></div>':''}
          <div id="dem-retours" style="${cible?'display:none':''}"></div>
          <div id="dem-refusees" style="display:none"></div>
        </div>
        <div class="dem-foot"><button onclick="DEM_UI.openModal()">＋ Demander un autre service</button></div>
      </div>
      <button id="dem-fab" onclick="DEM_UI.toggle()">📨 Inter-services <span class="dem-dot" id="dem-fab-count">0</span></button>`;
    document.body.appendChild(dock);

    const ov=document.createElement('div'); ov.className='dem-ov'; ov.id='dem-ov';
    const modCour = moduleCourant();
    const cibleOpts=Object.entries(D.MODULES).filter(([k])=>k!==modCour)
      .map(([k,m])=>`<option value="${k}">${m.icon} ${m.label}</option>`).join('');
    ov.innerHTML=`<div class="dem-modal">
      <h3>Demander un autre service</h3>
      <div style="font-size:12px;color:#6b6b6b;margin:-8px 0 10px">Pour un examen/acte réalisé par le service où vous êtes, utilisez son propre formulaire.</div>
      <label>Service sollicité</label><select id="dm-cible">${cibleOpts}</select>
      <label>Type</label><select id="dm-type"><option value="acte">Acte médical</option><option value="service">Service</option></select>
      <label>Objet</label><input id="dm-objet" placeholder="Ex: NFS + CRP en urgence">
      <div class="r2"><div><label>Patient</label><input id="dm-pat" placeholder="Nom"></div><div><label>IPP</label><input id="dm-ipp" placeholder="IPP-001"></div></div>
      <label>Priorité</label><select id="dm-prio"><option>Normale</option><option>Urgente</option><option>Vitale</option></select>
      <label>Détails</label><textarea id="dm-det" rows="3" placeholder="Indication clinique…"></textarea>
      <div class="acts"><button class="dem-cancel" onclick="DEM_UI.closeModal()">Annuler</button><button class="dem-primary" onclick="DEM_UI.submit()">Émettre</button></div>
    </div>`;
    document.body.appendChild(ov);
  }

  // ── API publique ───────────────────────────────────────────────────────────────
  window.DEM_UI = {
    _open:false, _tab:null,
    toggle(force){
      this._open = (force!==undefined)?force:!this._open;
      document.getElementById('dem-panel').classList.toggle('open', this._open);
      if(this._open) this.refresh();
    },
    tab(t){
      this._tab=t;
      document.querySelectorAll('.dem-tab').forEach(b=>b.classList.toggle('active', b.dataset.t===t));
      const r=document.getElementById('dem-recues'), q=document.getElementById('dem-retours'), x=document.getElementById('dem-refusees');
      if(r) r.style.display = t==='recues'?'':'none';
      if(q) q.style.display = t==='retours'?'':'none';
      if(x) x.style.display = t==='refusees'?'':'none';
      this.refresh();
    },
    refresh(){
      const mod=moduleCourant();
      if(estCible(mod) && document.getElementById('dem-recues')) D.renderFileAttente(mod,'dem-recues');
      if(document.getElementById('dem-retours')) D.renderMesRetours(mod,'dem-retours');
      if(document.getElementById('dem-refusees')) D.renderRefusees(mod,'dem-refusees');
      const nA = estCible(mod)?D.enAttente(mod).length+D.enTraitement(mod).length:0;
      const nR = D.nbRetours(mod);
      const nX = D.refusees(mod).length;
      const setB=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
      setB('dem-b-recues', nA); setB('dem-b-retours', nR); setB('dem-b-refusees', nX);
      const tot=nA+nR; const fc=document.getElementById('dem-fab-count');
      if(fc){ fc.textContent=tot; fc.style.display=tot>0?'':'none'; }
    },
    openModal(){
      const p=patientActif();
      if(p){ document.getElementById('dm-pat').value=p.nom||''; document.getElementById('dm-ipp').value=p.ipp||''; }
      document.getElementById('dem-ov').classList.add('open');
    },
    closeModal(){ document.getElementById('dem-ov').classList.remove('open'); },
    submit(){
      const objet=document.getElementById('dm-objet').value.trim();
      if(!objet){ alert('Objet requis.'); return; }
      D.creer({
        cible:document.getElementById('dm-cible').value,
        type:document.getElementById('dm-type').value,
        objet,
        patient:{ id:'P'+Date.now(), nom:document.getElementById('dm-pat').value||'—', ipp:document.getElementById('dm-ipp').value||'' },
        priorite:document.getElementById('dm-prio').value,
        details:document.getElementById('dm-det').value
      });
      this.closeModal();
      ['dm-objet','dm-det'].forEach(id=>document.getElementById(id).value='');
      this.toggle(true);
      if(typeof toast==='function') toast('Demande émise.','success');
    }
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init(){
    injectCSS(); buildDock();
    DEM_UI.tab(estCible(moduleCourant())?'recues':'retours');
    DEM_UI.refresh();
    D.on(()=>DEM_UI.refresh());
    setInterval(()=>DEM_UI.refresh(), 15000);   // capte les retours d'autres appareils (après sync)
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
