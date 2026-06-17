// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Résultats partagés (biologie / imagerie / autres)
// ──────────────────────────────────────────────────────────────────────────────
// Quand un département (labo, imagerie) valide un résultat, il l'écrit ici.
// Le DPI (et les Urgences) le LISENT → le résultat revient dans le dossier patient.
// Store 'resultats' (synchronisé Supabase).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_RESULTATS = {
  STORE:'resultats',
  _read(){
    let raw;
    if(typeof MEDICORE_STORE!=='undefined') raw=MEDICORE_STORE.load(this.STORE, []);
    else { try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.STORE)||'[]'); raw=Array.isArray(p)?p:(p.d||[]); }catch(e){ raw=[]; } }
    if(Array.isArray(raw)) return raw;
    if(raw && Array.isArray(raw.d)) return raw.d;
    return [];
  },

  _write(rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.STORE,rows,true);
    else localStorage.setItem('medicore_'+this.STORE,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _uid(){ return 'RES'+Date.now().toString(36)+Math.random().toString(36).slice(2,4); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  // ajouter({ patientId, patient_nom, type:'biologie'|'imagerie', libelle,
  //           params:[{param,val,unite,ref,anormal}], compteRendu, conclusion, demandeRef })
  ajouter(o){
    const rec={
      id:this._uid(), patientId:o.patientId, patient_nom:o.patient_nom||'',
      type:o.type||'biologie', libelle:o.libelle||'',
      params:o.params||[], compteRendu:o.compteRendu||'', conclusion:o.conclusion||'',
      demandeRef:o.demandeRef||'', par:o.par||this._user().nom||'',
      date:new Date().toISOString(), statut:'validé'
    };
    const rows=this._read(); rows.unshift(rec); this._write(rows);
    if(typeof MEDICORE_BUS!=='undefined') MEDICORE_BUS.publish('RESULTAT_DISPO', { patientId:rec.patientId, type:rec.type });
    return rec;
  },
  pourPatient(id, type){ return this._read().filter(r=>r.patientId===id && (!type||r.type===type)); },
  // Paramètres bio à plat (pour le tableau de résultats du DPI)
  bioParams(id){
    const out=[];
    this.pourPatient(id,'biologie').forEach(r=>(r.params||[]).forEach(p=>out.push(Object.assign({date:r.date,libelle:r.libelle},p))));
    return out;
  },
};
if(typeof window!=='undefined') window.MEDICORE_RESULTATS = MEDICORE_RESULTATS;
