// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Registre partagé des prestations facturables (par patient)
// ──────────────────────────────────────────────────────────────────────────────
// Chaque spécialité pousse ici l'acte qu'elle réalise (labo, imagerie, bloc,
// pharmacie, consultation). À la SORTIE, la Facturation agrège toutes les
// prestations « à facturer » du patient en UNE note de sortie consolidée.
//
//   MEDICORE_PRESTA.ajouter({patientId, patient_nom, patient_ipp, module,
//                            libelle, code, montant, ref})
//   MEDICORE_PRESTA.aFacturer(patientId)         → lignes non encore facturées
//   MEDICORE_PRESTA.totalAFacturer(patientId)    → total FCFA
//   MEDICORE_PRESTA.marquerFacturees(ids, factureId)
//
// Anti-doublon : clé (module + ref). Re-validation/sync ne duplique pas.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_PRESTA = {
  STORE: 'prestations',
  S: { A_FACTURER:'à facturer', FACTUREE:'facturée', ANNULEE:'annulée' },

  // Tarifs FCFA par défaut (ajustables dans la note de sortie)
  TARIF_DEFAUT: {
    laboratoire: 5000, imagerie: 25000, bloc_operatoire: 150000,
    pharmacie_pui: 0, consultation: 10000, autre: 0
  },
  LABELS_MODULE: {
    laboratoire:'Laboratoire', imagerie:'Imagerie', bloc_operatoire:'Bloc opératoire',
    pharmacie_pui:'Pharmacie', consultation:'Consultation', facturation:'Facturation', autre:'Autre'
  },

  _read(){
    if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(this.STORE, []);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.STORE)||'[]'); return Array.isArray(p)?p:(p.d||[]); }
    catch(e){ return []; }
  },
  _write(rows){
    if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.STORE, rows, true);
    else localStorage.setItem('medicore_'+this.STORE, JSON.stringify({_v:1,_ts:Date.now(),d:rows}));
  },

  _uid(){ return 'PR'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); },

  // ── Pousser une prestation (idempotent par module+ref) ──────────────────────
  ajouter(p){
    if(!p || !p.patientId) return null;
    const rows = this._read();
    const montant = (p.montant!=null && p.montant!=='') ? +p.montant
                   : (this.TARIF_DEFAUT[p.module] || 0);
    const ref = p.ref || this._uid();
    let row = rows.find(x=> x.module===p.module && x.ref===ref);
    const base = {
      id: row?row.id:this._uid(),
      patientId: p.patientId, patient_nom:p.patient_nom||'', patient_ipp:p.patient_ipp||'',
      module: p.module||'autre', libelle: p.libelle||'', code: p.code||'',
      montant, ref, statut: this.S.A_FACTURER,
      date: p.date || new Date().toISOString()
    };
    if(row){ if(row.statut!==this.S.FACTUREE) Object.assign(row, base); }
    else rows.push(base);
    this._write(rows);
    if(typeof MEDICORE_BUS!=='undefined') MEDICORE_BUS.publish('PRESTATION_AJOUTEE', { patientId:p.patientId, module:p.module, montant });
    return base;
  },

  pourPatient(patientId){ return this._read().filter(x=>x.patientId===patientId); },
  aFacturer(patientId){ return this.pourPatient(patientId).filter(x=>x.statut===this.S.A_FACTURER); },
  facturees(patientId){ return this.pourPatient(patientId).filter(x=>x.statut===this.S.FACTUREE); },
  totalAFacturer(patientId){ return this.aFacturer(patientId).reduce((s,x)=>s+(+x.montant||0),0); },
  nbAFacturer(patientId){ return this.aFacturer(patientId).length; },

  // ── Clôture : marque facturées + lie la facture ─────────────────────────────
  marquerFacturees(ids, factureId){
    const set=new Set(ids); const rows=this._read();
    rows.forEach(x=>{ if(set.has(x.id)){ x.statut=this.S.FACTUREE; x.facture_id=factureId; x.facture_le=new Date().toISOString(); } });
    this._write(rows);
  },
  annuler(id){ const rows=this._read(); const x=rows.find(r=>r.id===id); if(x){ x.statut=this.S.ANNULEE; this._write(rows); } },

  // Patients ayant des prestations à facturer (file de sortie)
  patientsAFacturer(){
    const map={};
    this._read().filter(x=>x.statut===this.S.A_FACTURER).forEach(x=>{
      if(!map[x.patientId]) map[x.patientId]={ patientId:x.patientId, nom:x.patient_nom, ipp:x.patient_ipp, n:0, total:0 };
      map[x.patientId].n++; map[x.patientId].total+=(+x.montant||0);
    });
    return Object.values(map);
  },
};

if(typeof window!=='undefined') window.MEDICORE_PRESTA = MEDICORE_PRESTA;
