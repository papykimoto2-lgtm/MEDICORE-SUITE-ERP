// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Registre des demandes inter-modules
// ──────────────────────────────────────────────────────────────────────────────
// Modèle : chaque module métier est autonome, dirigé par un responsable qui
// génère actes/factures et tient un budget pour atteindre les objectifs Direction.
//
// Cycle de vie d'une demande (acte médical ou service) :
//   1. CRÉATION    → demandeur émet vers un module cible        (EN_ATTENTE)
//   2. NOTIFICATION→ apparaît dans la file du module cible       (badge bus)
//   3. PRISE EN CHARGE → responsable la prend                    (EN_TRAITEMENT)
//   4. TRAITEMENT  → acte/service exécuté + résultat             (TRAITEE)
//   5. RETOUR      → renvoyée au demandeur + notification         (RETOURNEE)
//   (REFUSEE possible à toute étape avec motif)
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_DEMANDES = {

  STORE: 'demandes',

  // ── Statuts ───────────────────────────────────────────────────────────────────
  S: {
    ATTENTE:'EN_ATTENTE', NOTIFIEE:'NOTIFIEE', TRAITEMENT:'EN_TRAITEMENT',
    TRAITEE:'TRAITEE', RETOURNEE:'RETOURNEE', REFUSEE:'REFUSEE'
  },

  LABELS: {
    EN_ATTENTE:'En attente', NOTIFIEE:'Notifiée', EN_TRAITEMENT:'En traitement',
    TRAITEE:'Traitée', RETOURNEE:'Retournée', REFUSEE:'Refusée'
  },
  COULEURS: {
    EN_ATTENTE:'#ca8a04', NOTIFIEE:'#1d4ed8', EN_TRAITEMENT:'#7c3aed',
    TRAITEE:'#0891b2', RETOURNEE:'#15803d', REFUSEE:'#b91c1c'
  },

  // ── Registre des modules cibles ────────────────────────────────────────────────
  // busDemande = type bus notifié à la création ; busRetour = notifié au retour.
  MODULES: {
    laboratoire:      { label:'Laboratoire',     icon:'🔬', busDemande:'LABO_DEMANDE_URGENTE',     busRetour:'LABO_RESULTATS_PRETS' },
    imagerie:         { label:'Imagerie',        icon:'🩻', busDemande:'IMAGERIE_DEMANDE',         busRetour:'IMAGERIE_CR_PRET'     },
    pharmacie_pui:    { label:'Pharmacie PUI',   icon:'💊', busDemande:'PRESCRIPTION_ATTENTE_PUI', busRetour:'PUI_DELIVRE'          },
    bloc_operatoire:  { label:'Bloc opératoire', icon:'🏥', busDemande:'BLOC_DEMANDE',             busRetour:'BLOC_CR_PRET'         },
    facturation:      { label:'Facturation',     icon:'🧾', busDemande:'SORTIE_A_FACTURER',        busRetour:'FACTURE_PRETE'        },
    achats_logistique:{ label:'Achats & logist.',icon:'📦', busDemande:'ACHAT_DEMANDE',            busRetour:'ACHAT_LIVRE'          },
  },

  PRIORITES: ['Normale','Urgente','Vitale'],

  // ── Persistance ─────────────────────────────────────────────────────────────────
  _read(){
    let raw;
    if(typeof MEDICORE_STORE!=='undefined') raw=MEDICORE_STORE.load(this.STORE, []);
    else { try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.STORE)||'[]'); raw=Array.isArray(p)?p:(p.d||[]); }catch(e){ raw=[]; } }
    if(Array.isArray(raw)) return raw;
    if(raw && Array.isArray(raw.d)) return raw.d;
    return [];
  }
    catch(e){ return []; }
  },
  _write(rows){
    if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.STORE, rows, true);
    else localStorage.setItem('medicore_'+this.STORE, JSON.stringify({_v:1,_ts:Date.now(),d:rows}));
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────────
  _now(){ return new Date().toISOString(); },
  _uid(){ return 'DEM-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||localStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },
  _module(){ return (typeof location!=='undefined') ? location.pathname.split('/').pop().replace('.html','') : ''; },

  all(){ return this._read(); },
  get(id){ return this._read().find(d=>d.id===id); },

  // ── 1. CRÉER une demande ─────────────────────────────────────────────────────────
  creer({ cible, objet, type, patient, priorite, details }){
    if(!this.MODULES[cible]) throw new Error('Module cible inconnu : '+cible);
    const u = this._user();
    const d = {
      id: this._uid(),
      type: type || 'acte',                       // 'acte' | 'service'
      module_cible: cible,
      module_demandeur: this._module() || 'dpi',
      objet: objet || '',
      details: details || '',
      patient: patient || null,                   // { id, nom, ipp }
      priorite: this.PRIORITES.includes(priorite) ? priorite : 'Normale',
      statut: this.S.ATTENTE,
      demandeur: { id:u.id||null, nom:u.nom||u.email||'—', role:u.role||'' },
      responsable: null,
      resultat: null,
      cree_le: this._now(),
      maj_le: this._now(),
      lu_cible: false,                            // pas encore vu par le module cible
      lu_demandeur: true,
      historique: [{ statut:this.S.ATTENTE, le:this._now(), par:u.nom||u.email||'—' }],
    };
    const rows = this._read(); rows.push(d); this._write(rows);
    this._notifierCible(d);
    this._emit('creee', d);
    return d;
  },

  // ── Transition générique ───────────────────────────────────────────────────────
  _transition(id, statut, patch){
    const rows = this._read();
    const d = rows.find(x=>x.id===id);
    if(!d) throw new Error('Demande introuvable : '+id);
    const u = this._user();
    Object.assign(d, patch||{});
    d.statut = statut;
    d.maj_le = this._now();
    d.historique = d.historique || [];
    d.historique.push({ statut, le:this._now(), par:u.nom||u.email||'—' });
    this._write(rows);
    return d;
  },

  // ── 3. PRENDRE EN CHARGE (responsable du module cible) ───────────────────────────
  prendreEnCharge(id){
    const u = this._user();
    const d = this._transition(id, this.S.TRAITEMENT, {
      lu_cible:true,
      responsable:{ id:u.id||null, nom:u.nom||u.email||'—', role:u.role||'' }
    });
    this._emit('prise', d);
    return d;
  },

  // ── 4. TRAITER (résultat de l'acte / service) ────────────────────────────────────
  traiter(id, resultat){
    const d = this._transition(id, this.S.TRAITEE, { resultat: resultat||null, lu_cible:true });
    this._emit('traitee', d);
    return d;
  },

  // ── 5. RETOURNER au demandeur (+ notification) ───────────────────────────────────
  retourner(id, retour){
    const d = this._transition(id, this.S.RETOURNEE, {
      resultat: retour!=null ? retour : (this.get(id)||{}).resultat,
      lu_cible:true, lu_demandeur:false
    });
    this._notifierDemandeur(d);
    this._emit('retournee', d);
    return d;
  },

  // ── Refuser (motif obligatoire) ──────────────────────────────────────────────────
  refuser(id, motif){
    const d = this._transition(id, this.S.REFUSEE, { motif:motif||'', lu_cible:true, lu_demandeur:false });
    this._notifierDemandeur(d);
    this._emit('refusee', d);
    return d;
  },

  // ── Accuser réception côté cible (marque vue, statut NOTIFIEE) ────────────────────
  accuser(id){
    const d = this.get(id);
    if(d && d.statut===this.S.ATTENTE) return this._transition(id, this.S.NOTIFIEE, { lu_cible:true });
    return d;
  },

  // ── Notifications via le bus ──────────────────────────────────────────────────────
  _notifierCible(d){
    const m = this.MODULES[d.module_cible];
    if(typeof MEDICORE_BUS!=='undefined' && m){
      MEDICORE_BUS.publish(m.busDemande, { demande_id:d.id, objet:d.objet, priorite:d.priorite, patient:d.patient });
    }
  },
  _notifierDemandeur(d){
    const m = this.MODULES[d.module_cible];
    if(typeof MEDICORE_BUS!=='undefined' && m){
      MEDICORE_BUS.publish(m.busRetour, { demande_id:d.id, objet:d.objet, statut:d.statut, patient:d.patient });
    }
  },

  // ── Requêtes ────────────────────────────────────────────────────────────────────
  // File d'attente d'un module cible (à traiter)
  enAttente(module){
    return this._read().filter(d=> d.module_cible===module &&
      (d.statut===this.S.ATTENTE || d.statut===this.S.NOTIFIEE))
      .sort(this._triPriorite.bind(this));
  },
  // En cours de traitement par le module cible
  enTraitement(module){
    return this._read().filter(d=> d.module_cible===module &&
      (d.statut===this.S.TRAITEMENT || d.statut===this.S.TRAITEE));
  },
  // Retours destinés au demandeur (résultats reçus)
  retoursPour(module){
    return this._read().filter(d=> d.module_demandeur===module &&
      (d.statut===this.S.RETOURNEE || d.statut===this.S.REFUSEE))
      .sort((a,b)=> (b.maj_le||'').localeCompare(a.maj_le||''));
  },
  // Toutes les demandes émises par un module
  emisesPar(module){ return this._read().filter(d=> d.module_demandeur===module); },

  // Demandes refusées concernant un module (comme cible OU demandeur)
  refusees(module){
    return this._read().filter(d=> d.statut===this.S.REFUSEE &&
      (d.module_cible===module || d.module_demandeur===module))
      .sort((a,b)=> (b.maj_le||'').localeCompare(a.maj_le||''));
  },

  // Lie l'entrée du registre natif à la demande prise en charge (appelé à l'enregistrement)
  finaliserLien(registreId, resume){
    if(typeof window==='undefined' || !window.__demLiee) return;
    const rows=this._read(); const d=rows.find(x=>x.id===window.__demLiee);
    if(d){ d.registreId=registreId; d.resultat=resume||('Enregistrée au registre (réf '+registreId+')'); this._write(rows); }
    window.__demLiee=null;
    if(typeof DEM_UI!=='undefined') DEM_UI.refresh();
    return d;
  },

  _triPriorite(a,b){
    const ordre={ 'Vitale':0,'Urgente':1,'Normale':2 };
    const pa=ordre[a.priorite]??2, pb=ordre[b.priorite]??2;
    return pa!==pb ? pa-pb : (a.cree_le||'').localeCompare(b.cree_le||'');
  },

  // ── Compteurs (badges) ────────────────────────────────────────────────────────────
  nbAttente(module){ return this.enAttente(module).filter(d=>!d.lu_cible).length; },
  nbRetours(module){ return this.retoursPour(module).filter(d=>!d.lu_demandeur).length; },

  // ── Observateurs UI ────────────────────────────────────────────────────────────────
  _listeners: [],
  on(fn){ this._listeners.push(fn); },
  _emit(ev, d){ this._listeners.forEach(fn=>{ try{ fn(ev,d); }catch(e){} }); },

  // ══════════════════════════════════════════════════════════════════════════════
  // WIDGETS RÉUTILISABLES — à monter dans n'importe quelle page module
  // ══════════════════════════════════════════════════════════════════════════════

  _chip(statut){
    return `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;`+
      `background:${this.COULEURS[statut]}1a;color:${this.COULEURS[statut]}">${this.LABELS[statut]||statut}</span>`;
  },
  _prioChip(p){
    const c = p==='Vitale'?'#b91c1c':p==='Urgente'?'#ca8a04':'#64748b';
    return `<span style="font-size:11px;font-weight:600;color:${c}">${p==='Normale'?'':'⚠ '}${p}</span>`;
  },
  _patient(d){ return d.patient ? (d.patient.nom||'')+(d.patient.ipp?' · '+d.patient.ipp:'') : '—'; },

  // File d'attente du module cible (côté responsable qui traite)
  renderFileAttente(module, containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    const list = this.enAttente(module).concat(this.enTraitement(module));
    if(!list.length){ el.innerHTML = this._vide('Aucune demande en attente.'); return; }
    el.innerHTML = list.map(d=>`
      <div class="dem-row" style="border:1px solid #e2dfd8;border-radius:8px;padding:12px 14px;margin-bottom:8px;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:4px">
          <div><strong>${d.objet||'(sans objet)'}</strong> ${this._prioChip(d.priorite)}</div>
          ${this._chip(d.statut)}
        </div>
        <div style="font-size:12.5px;color:#6b6b6b;margin-bottom:8px">
          👤 ${this._patient(d)} · Demandé par <strong>${d.demandeur.nom}</strong>
          <span style="font-family:monospace;font-size:11px">(${d.module_demandeur})</span>
          ${d.details?'<br>'+d.details:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${d.statut===this.S.ATTENTE||d.statut===this.S.NOTIFIEE
            ? `<button onclick="MEDICORE_DEMANDES._uiPrendre('${d.id}','${containerId}','${module}')" style="${this._btn('#7c3aed')}">▶ Prendre en charge</button>
               <button onclick="MEDICORE_DEMANDES._uiRefuser('${d.id}','${containerId}','${module}')" style="${this._btn('#b91c1c',true)}">✕ Refuser</button>`
            : d.statut===this.S.TRAITEMENT
            ? `<button onclick="MEDICORE_DEMANDES._uiRetour('${d.id}','${containerId}','${module}')" style="${this._btn('#15803d')}">✓ Traiter & retourner</button>`
            : `<button onclick="MEDICORE_DEMANDES._uiRetour('${d.id}','${containerId}','${module}')" style="${this._btn('#15803d')}">↩ Retourner au demandeur</button>`}
        </div>
      </div>`).join('');
  },

  // Retours reçus (côté demandeur)
  renderMesRetours(module, containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    const list = this.retoursPour(module);
    if(!list.length){ el.innerHTML = this._vide('Aucun retour pour le moment.'); return; }
    el.innerHTML = list.map(d=>`
      <div style="border:1px solid #e2dfd8;border-radius:8px;padding:12px 14px;margin-bottom:8px;background:${d.lu_demandeur?'#fff':'#f0fdf4'}">
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
          <strong>${d.objet||'(sans objet)'}</strong> ${this._chip(d.statut)}
        </div>
        <div style="font-size:12.5px;color:#6b6b6b">
          ${this.MODULES[d.module_cible]?.icon||''} ${this.MODULES[d.module_cible]?.label||d.module_cible}
          · 👤 ${this._patient(d)}
          ${d.responsable?' · Traité par <strong>'+d.responsable.nom+'</strong>':''}
        </div>
        ${d.resultat?`<div style="margin-top:6px;font-size:12.5px;background:#f8f7f2;border-radius:6px;padding:8px">${typeof d.resultat==='string'?d.resultat:JSON.stringify(d.resultat)}</div>`:''}
        ${d.motif?`<div style="margin-top:6px;font-size:12.5px;color:#b91c1c">Motif refus : ${d.motif}</div>`:''}
        ${!d.lu_demandeur?`<button onclick="MEDICORE_DEMANDES._uiAccuserRetour('${d.id}','${containerId}','${module}')" style="${this._btn('#1d4ed8',true)};margin-top:8px">Marquer lu</button>`:''}
      </div>`).join('');
  },

  // Liste des demandes refusées (état)
  renderRefusees(module, containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    const list = this.refusees(module);
    if(!list.length){ el.innerHTML = this._vide('Aucune demande refusée.'); return; }
    el.innerHTML = list.map(d=>{
      const sens = d.module_cible===module ? 'Refusée par vous' : 'Refusée par '+(this.MODULES[d.module_cible]?.label||d.module_cible);
      return `<div style="border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin-bottom:8px;background:#fff1f2">
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
          <strong>${d.objet||'(sans objet)'}</strong> ${this._chip(d.statut)}
        </div>
        <div style="font-size:12.5px;color:#6b6b6b">
          👤 ${this._patient(d)} · ${sens}
          ${d.demandeur?.nom?' · Demandé par '+d.demandeur.nom:''}
        </div>
        ${d.motif?`<div style="margin-top:6px;font-size:12.5px;color:#b91c1c">Motif : ${d.motif}</div>`:''}
        <div style="margin-top:4px;font-size:11px;color:#9ca3af">${d.maj_le?new Date(d.maj_le).toLocaleString('fr-CI'):''}</div>
      </div>`;
    }).join('');
  },

  _btn(c,outline){ return outline
    ? `padding:6px 12px;border:1px solid ${c};border-radius:6px;background:#fff;color:${c};cursor:pointer;font-size:12.5px;font-weight:600`
    : `padding:6px 12px;border:none;border-radius:6px;background:${c};color:#fff;cursor:pointer;font-size:12.5px;font-weight:600`; },
  _vide(t){ return `<div style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">${t}</div>`; },

  // ── Handlers UI internes ─────────────────────────────────────────────────────────
  _uiPrendre(id, cid, module){
    this.prendreEnCharge(id);
    // Hook module : matérialiser la demande dans le registre natif (ouvre son formulaire)
    if(typeof window!=='undefined' && typeof window.onDemandePriseEnCharge==='function'){
      try{ window.onDemandePriseEnCharge(this.get(id)); }catch(e){}
    }
    this.renderFileAttente(module, cid);
  },
  _uiRefuser(id, cid, module){
    const m = prompt('Motif du refus :'); if(m===null) return;
    this.refuser(id, m); this.renderFileAttente(module, cid);
  },
  _uiRetour(id, cid, module){
    const r = prompt('Résultat / compte-rendu à retourner au demandeur :');
    if(r===null) return;
    this.retourner(id, r); this.renderFileAttente(module, cid);
  },
  _uiAccuserRetour(id, cid, module){
    const rows=this._read(); const d=rows.find(x=>x.id===id);
    if(d){ d.lu_demandeur=true; this._write(rows); }
    if(typeof MEDICORE_BUS!=='undefined'){ const m=this.MODULES[d.module_cible]; if(m) MEDICORE_BUS.markRead(m.busRetour); }
    this.renderMesRetours(module, cid);
  },
};

if(typeof window!=='undefined') window.MEDICORE_DEMANDES = MEDICORE_DEMANDES;
