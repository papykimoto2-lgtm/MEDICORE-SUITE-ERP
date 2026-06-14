// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Archivage des dossiers patients sortis
// ──────────────────────────────────────────────────────────────────────────────
// Déplace les patients « Sorti » du store actif 'patients' vers 'patients_archives'
// après le délai paramétré (CFG.seuils.delaiArchivageJours, défaut 90 j).
// Les dossiers archivés restent consultables (lecture) et peuvent être restaurés.
// Les autres données du patient (prescriptions, résultats, factures, mouvements…)
// restent dans leurs stores respectifs, indexées par patientId — rien n'est perdu.
// Store : 'patients_archives'.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_ARCHIVE = {
  S_ARCH:'patients_archives', S_PAT:'patients',
  DEFAULT_DELAI:90,

  _read(s){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(s,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+s)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(s,rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(s,rows,true);
    else localStorage.setItem('medicore_'+s,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  delai(){
    try{ const par=this._read('parametrage'); const cfg=(par&&par.cfg)||par;
      const d=cfg&&cfg.seuils&&cfg.seuils.delaiArchivageJours; return d>0?d:this.DEFAULT_DELAI; }catch(e){ return this.DEFAULT_DELAI; }
  },

  liste(){ return this._read(this.S_ARCH); },
  get(id){ return this.liste().find(p=>p.id===id); },

  // Patients sortis (du store actif) éligibles à l'archivage (sortie depuis > délai)
  eligibles(patientsActifs, delaiJours){
    const d=delaiJours||this.delai(); const lim=Date.now()-d*86400000;
    return (patientsActifs||[]).filter(p=>p.statut==='Sorti' && p.sortie && new Date(p.sortie).getTime()<=lim);
  },

  // Archive un dossier : retire du store actif, ajoute au store d'archives
  archiver(id, patientsActifs){
    const idx=patientsActifs.findIndex(p=>p.id===id); if(idx<0) return null;
    const p=patientsActifs[idx];
    const arch=this.liste();
    if(arch.some(a=>a.id===id)) { patientsActifs.splice(idx,1); this._write(this.S_PAT, patientsActifs); return p; }
    const copy=Object.assign({}, p, { archive_le:new Date().toISOString(), archive_par:this._user().nom||'' });
    arch.unshift(copy); this._write(this.S_ARCH, arch);
    patientsActifs.splice(idx,1); this._write(this.S_PAT, patientsActifs);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Archivage dossier patient','SUPPRESSION', `${p.nom} (${p.id}) — sortie le ${p.sortie?new Date(p.sortie).toLocaleDateString('fr-FR'):'—'}`, id);
    return copy;
  },

  // Archivage en masse de tous les éligibles
  archiverEligibles(patientsActifs){
    const elig=this.eligibles(patientsActifs);
    elig.forEach(p=>this.archiver(p.id, patientsActifs));
    return elig.length;
  },

  // Restaure un dossier archivé vers le store actif
  restaurer(id, patientsActifs){
    const arch=this.liste(); const idx=arch.findIndex(a=>a.id===id); if(idx<0) return null;
    const p=arch[idx]; const copy=Object.assign({}, p);
    delete copy.archive_le; delete copy.archive_par;
    arch.splice(idx,1); this._write(this.S_ARCH, arch);
    patientsActifs.unshift(copy); this._write(this.S_PAT, patientsActifs);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Restauration dossier patient','CREATION', `${p.nom} (${p.id})`, id);
    return copy;
  },

  recherche(q){
    q=(q||'').toLowerCase();
    return this.liste().filter(p=>!q || (p.nom||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q) || (p.ipp||'').toLowerCase().includes(q));
  },
};
if(typeof window!=='undefined') window.MEDICORE_ARCHIVE = MEDICORE_ARCHIVE;
