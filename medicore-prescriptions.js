// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Registre partagé des prescriptions (DPI ↔ Pharmacie PUI)
// ──────────────────────────────────────────────────────────────────────────────
// Source unique : store « prescriptions » (tableau plat).
//   • DPI ajoute    → MEDICORE_RX.ajouter(rec)  (+ notif bus PUI)
//   • PUI lit        → MEDICORE_RX.enAttente() / pourPatient(id)
//   • PUI valide/refuse/délivre → met à jour le statut (DPI le voit, sync propage)
//
// Statuts : 'En attente validation' → 'Validée' | 'Refusée' → 'Délivrée'
// Chaque enregistrement porte patientId + identité patient (pour filtrage QR).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_RX = {
  STORE: 'prescriptions',
  S: { ATTENTE:'En attente validation', VALIDEE:'Validée', REFUSEE:'Refusée', DELIVREE:'Délivrée' },

  _read(){
    if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(this.STORE, []);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.STORE)||'[]'); return Array.isArray(p)?p:(p.d||[]); }
    catch(e){ return []; }
  },
  _write(rows){
    if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.STORE, rows, true);
    else localStorage.setItem('medicore_'+this.STORE, JSON.stringify({_v:1,_ts:Date.now(),d:rows}));
  },

  all(){ return this._read(); },
  get(id){ return this._read().find(r=>r.id===id); },
  pourPatient(patientId){ return this._read().filter(r=>r.patientId===patientId); },
  enAttente(){ return this._read().filter(r=>r.statut===this.S.ATTENTE); },
  enAttentePatient(patientId){ return this.enAttente().filter(r=>r.patientId===patientId); },

  // ── DPI : ajouter une prescription ───────────────────────────────────────────
  ajouter(rec){
    const rows = this._read();
    const r = Object.assign({
      id: rec.id || ('RX'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)),
      patientId:'', patient_nom:'', patient_ipp:'', service:'',
      med:'', posologie:'', voie:'', duree:'', notes:'',
      statut: this.S.ATTENTE, date:new Date().toLocaleString('fr-FR'),
      medecin:'', forcee:false, cree_le:new Date().toISOString()
    }, rec);
    // évite les doublons d'id (re-render/sync)
    const i = rows.findIndex(x=>x.id===r.id);
    if(i>=0) rows[i]=Object.assign(rows[i], r); else rows.push(r);
    this._write(rows);
    // Notifie la PUI (sauf prescription forcée hors circuit)
    if(typeof MEDICORE_BUS!=='undefined' && r.statut===this.S.ATTENTE && !rec.silencieux){
      MEDICORE_BUS.publish('PRESCRIPTION_ATTENTE_PUI', {
        prescId:r.id, patientId:r.patientId, patient:r.patient_nom, med:r.med, posologie:r.posologie, medecin:r.medecin
      });
    }
    return r;
  },

  // ── PUI : transitions ─────────────────────────────────────────────────────────
  _maj(id, patch){
    const rows=this._read(); const r=rows.find(x=>x.id===id);
    if(!r) return null;
    Object.assign(r, patch, { maj_le:new Date().toISOString() });
    this._write(rows);
    if(typeof MEDICORE_BUS!=='undefined') MEDICORE_BUS.markRead('PRESCRIPTION_ATTENTE_PUI');
    return r;
  },
  valider(id, par){ return this._maj(id, { statut:this.S.VALIDEE, valideePar:par||'', valideTs:new Date().toISOString() }); },
  refuser(id, par, motif){ return this._maj(id, { statut:this.S.REFUSEE, refusPar:par||'', refusMotif:motif||'', refusTs:new Date().toISOString() }); },
  delivrer(id, par){ return this._maj(id, { statut:this.S.DELIVREE, delivrePar:par||'', delivreTs:new Date().toISOString() }); },
};

if(typeof window!=='undefined') window.MEDICORE_RX = MEDICORE_RX;
