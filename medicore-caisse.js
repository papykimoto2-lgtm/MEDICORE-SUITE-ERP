// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Caisse partagée (encaissements par service)
// ──────────────────────────────────────────────────────────────────────────────
// Point d'encaissement réutilisable : Pharmacie, Laboratoire, Imagerie…
// Procédure unique :  scan patient → prestations non payées → encaisser →
//   • transaction de caisse (registre du jour),
//   • écriture trésorerie SYSCOHADA (531 Caisse / 70x Ventes-Services),
//   • prestations liées marquées « facturée » (pas de double facturation à la sortie).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_CAISSE = {
  STORE: 'caisse',
  SERVICES: {
    pharmacie_pui: { label:'Caisse Pharmacie',  compteVente:'701' }, // ventes de marchandises
    laboratoire:   { label:'Caisse Laboratoire', compteVente:'706' }, // prestations de services
    imagerie:      { label:'Caisse Imagerie',    compteVente:'706' },
    bloc_operatoire:{ label:'Caisse Bloc opératoire', compteVente:'706' },
    facturation:   { label:'Caisse Centrale',    compteVente:'706' },
  },

  // ── SESSION DE CAISSE (ouverture / fond / clôture / écart) ──────────────────
  _sessKey(service){ return 'medicore_caisse_sess_'+service; },
  sessionCourante(service){
    try{ const s=JSON.parse(localStorage.getItem(this._sessKey(service))||'null'); return (s&&s.statut==='ouverte')?s:null; }catch(e){ return null; }
  },
  ouvrirSession(service, { caissier, fond }){
    if(this.sessionCourante(service)) return this.sessionCourante(service);
    const s={ id:'SES'+Date.now().toString(36), service, caissier:caissier||'—',
      fond:+fond||0, ouverte_le:new Date().toISOString(), statut:'ouverte' };
    try{ localStorage.setItem(this._sessKey(service), JSON.stringify(s)); }catch(e){}
    return s;
  },
  // Transactions de la session en cours
  txnSession(service){
    const s=this.sessionCourante(service); if(!s) return [];
    return this._read().filter(t=>t.service===service && t.session_id===s.id);
  },
  totalSession(service){ return this.txnSession(service).reduce((x,t)=>x+(+t.total||0),0); },
  // Clôture : état final, versement, écart
  cloturerSession(service, { compteEspeces, versement }){
    const s=this.sessionCourante(service); if(!s) return null;
    const recette=this.totalSession(service);
    const attendu=s.fond+recette;                         // ce qui doit être en caisse
    const compte=(compteEspeces==null?attendu:+compteEspeces);
    const clos=Object.assign({}, s, {
      statut:'cloturee', cloturee_le:new Date().toISOString(),
      recette, attendu, compte_especes:compte,
      versement:(versement==null?recette:+versement),
      ecart: compte-attendu, nb_operations:this.txnSession(service).length
    });
    // Historique synchronisé
    try{
      let hist=[]; if(typeof MEDICORE_STORE!=='undefined') hist=MEDICORE_STORE.load('caisse_sessions',[]);
      hist.unshift(clos);
      if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save('caisse_sessions', hist, true);
    }catch(e){}
    try{ localStorage.removeItem(this._sessKey(service)); }catch(e){}
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Clôture de caisse','ENCAISSEMENT',
      `${(this.SERVICES[service]||{}).label||service} — recette ${recette.toLocaleString('fr-FR')} · écart ${clos.ecart.toLocaleString('fr-FR')}`, s.id);
    return clos;
  },

  _read(){
    if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(this.STORE, []);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.STORE)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; }
  },
  _write(rows){
    if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.STORE, rows, true);
    else localStorage.setItem('medicore_'+this.STORE, JSON.stringify({_v:1,_ts:Date.now(),d:rows}));
  },
  _uid(){ return 'CAI'+Date.now().toString(36)+Math.random().toString(36).slice(2,4); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  // ── Encaisser une liste de lignes ───────────────────────────────────────────
  // lignes: [{ libelle, montant, ref?, prestationId? }]
  encaisser({ service, patientId, patient_nom, lignes, mode, caissier, compteVente }){
    lignes=(lignes||[]).filter(l=>l && (+l.montant||0)>=0);
    if(!lignes.length) return null;
    const cfg=this.SERVICES[service]||{label:service,compteVente:'706'};
    const total=lignes.reduce((s,l)=>s+(+l.montant||0),0);
    const sess=this.sessionCourante(service);
    const txn={
      id:this._uid(), date:new Date().toISOString(), service,
      service_label:cfg.label, session_id:sess?sess.id:null,
      patientId:patientId||'', patient_nom:patient_nom||'',
      lignes, total, mode:mode||'Espèces',
      caissier:caissier||(sess&&sess.caissier)||this._user().nom||'—',
      compte_debit:'531', compte_credit:compteVente||cfg.compteVente, statut:'Encaissé'
    };
    const rows=this._read(); rows.unshift(txn); this._write(rows);

    // Écriture trésorerie (lisible par le module Trésorerie)
    try{
      let tr=[]; if(typeof MEDICORE_STORE!=='undefined') tr=MEDICORE_STORE.load('mouvements_tresorerie', []);
      tr.unshift({ id:txn.id, date:txn.date, libelle:`${cfg.label} — ${patient_nom||patientId||''}`,
        montant:total, sens:'Entrée', mode:txn.mode, journal:cfg.label,
        compte_debit:'531', compte_credit:txn.compte_credit, ref:txn.id, module:service });
      if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save('mouvements_tresorerie', tr, true);
    }catch(e){}

    // Marque les prestations liées comme facturées
    if(typeof MEDICORE_PRESTA!=='undefined'){
      const ids=lignes.map(l=>l.prestationId).filter(Boolean);
      if(ids.length) MEDICORE_PRESTA.marquerFacturees(ids, txn.id);
    }
    // Écriture comptable SYSCOHADA automatique (531/521 Trésorerie → 706 Produits)
    try{
      if(typeof MEDICORE_COMPTA!=='undefined'){
        // Facturation (constatation du produit) puis encaissement (règlement)
        MEDICORE_COMPTA.facturationPatient({ patientId, patient_nom, montant:total, centre:service, ref:txn.id });
        MEDICORE_COMPTA.encaissement({ patientId, patient_nom, montant:total, mode:txn.mode, centre:service, ref:txn.id });
      }
    }catch(e){}

    if(typeof MEDICORE_BUS!=='undefined') MEDICORE_BUS.publish('ENCAISSEMENT', { service, montant:total, patient:patient_nom });
    return txn;
  },

  // ── Encaisse les prestations « à facturer » d'un patient pour un service ────
  encaisserPrestationsPatient(service, patientId, opts){
    if(typeof MEDICORE_PRESTA==='undefined') return null;
    const lignes=MEDICORE_PRESTA.aFacturer(patientId)
      .filter(p=>p.module===service)
      .map(p=>({ libelle:p.libelle, montant:+p.montant||0, ref:p.ref, prestationId:p.id }));
    if(!lignes.length) return null;
    const nom=(MEDICORE_PRESTA.aFacturer(patientId)[0]||{}).patient_nom||'';
    return this.encaisser(Object.assign({ service, patientId, patient_nom:nom, lignes }, opts||{}));
  },

  // ── Requêtes ────────────────────────────────────────────────────────────────
  transactions(service){ return this._read().filter(t=>!service||t.service===service); },
  duJour(service){ const j=new Date().toISOString().slice(0,10); return this.transactions(service).filter(t=>(t.date||'').slice(0,10)===j); },
  totalJour(service){ return this.duJour(service).reduce((s,t)=>s+(+t.total||0),0); },

  // ── Registre (vue) ────────────────────────────────────────────────────────────
  renderRegistre(service){
    const jour=this.duJour(service); const total=this.totalJour(service);
    const cfg=this.SERVICES[service]||{label:'Caisse'};
    const rows=jour.length? jour.map(t=>`
      <tr>
        <td style="padding:7px 10px;font-size:12px">${new Date(t.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
        <td style="padding:7px 10px;font-size:12.5px">${t.patient_nom||'—'}</td>
        <td style="padding:7px 10px;font-size:12px;color:var(--text-muted)">${(t.lignes||[]).map(l=>l.libelle).join(', ')}</td>
        <td style="padding:7px 10px;font-size:12px">${t.mode}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:600">${(+t.total).toLocaleString('fr-FR')}</td>
      </tr>`).join('')
      : `<tr><td colspan="5" style="padding:22px;text-align:center;color:var(--text-muted)">Aucun encaissement aujourd'hui.</td></tr>`;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px">
        <div><div style="font-size:12px;color:var(--text-muted)">${cfg.label} — recette du jour</div>
          <div style="font-size:22px;font-weight:700;color:var(--accent)">${total.toLocaleString('fr-FR')} FCFA</div></div>
        <div style="text-align:right"><div style="font-size:12px;color:var(--text-muted)">${jour.length} opération(s)</div>
          <div style="font-size:11.5px;color:var(--text-muted)">SYSCOHADA 531 / ${cfg.compteVente}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid var(--border)">
        <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted)">HEURE</th>
        <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted)">PATIENT</th>
        <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted)">DÉTAIL</th>
        <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted)">MODE</th>
        <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted)">MONTANT (FCFA)</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
  },

  // Modale registre + clôture
  ouvrirRegistre(service){
    let ov=document.getElementById('modal-registre-caisse'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='modal-registre-caisse'; ov.className='overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
    const cfg=this.SERVICES[service]||{label:'Caisse'};
    ov.innerHTML=`<div class="modal" style="width:680px;max-width:96vw;max-height:90vh;overflow-y:auto">
      <div class="modal-header"><div><div class="modal-title">${cfg.label}</div>
        <div class="modal-subtitle">Registre du jour</div></div>
        <button class="modal-close" onclick="document.getElementById('modal-registre-caisse').remove()">✕</button></div>
      <div class="modal-body">${this.renderRegistre(service)}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="MEDICORE_CAISSE.cloturer('${service}')">🔒 Clôturer la caisse (Z)</button>
        <button class="btn btn-primary" onclick="document.getElementById('modal-registre-caisse').remove()">Fermer</button>
      </div></div>`;
    document.body.appendChild(ov);
  },
  cloturer(service){
    const total=this.totalJour(service); const n=this.duJour(service).length;
    if(typeof MEDICORE_BUS!=='undefined') MEDICORE_BUS.publish('CAISSE_CLOTURE', { service, total, n });
    if(typeof toast==='function') toast(`Clôture Z — ${n} opération(s), ${total.toLocaleString('fr-FR')} FCFA.`,'success');
  },
};

if(typeof window!=='undefined') window.MEDICORE_CAISSE = MEDICORE_CAISSE;
