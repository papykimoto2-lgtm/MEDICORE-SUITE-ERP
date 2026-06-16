// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Moteur Planning & Permanence par service
// ──────────────────────────────────────────────────────────────────────────────
// Programme de travail (qui est affecté, quand, sur quel service) + permanence
// (qui est de garde/astreinte en ce moment) + prise/fin de service avec
// transmission des consignes (relève), pour assurer la continuité des soins.
// Stores : planning_postes (affectations), planning_releves (relèves horodatées)
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_PLANNING = {
  S_POSTES:'planning_postes', S_RELEVES:'planning_releves',

  SERVICES:['Urgences','Bloc opératoire','Maternité','Réanimation','Hospitalisation',
            'Laboratoire','Imagerie','Pharmacie','Consultations externes','Administration'],

  // Type de poste : libellé, plage horaire indicative, couleur, présence physique requise
  TYPES:{
    Matin:     { label:'Matin',        debut:'07:00', fin:'15:00', couleur:'#1a4b6e', presence:true },
    ApresMidi: { label:'Après-midi',   debut:'15:00', fin:'23:00', couleur:'#0e7490', presence:true },
    Nuit:      { label:'Nuit',         debut:'23:00', fin:'07:00', couleur:'#6b21a8', presence:true },
    Garde:     { label:'Garde (24h)',  debut:'08:00', fin:'08:00', couleur:'#b91c1c', presence:true },
    Astreinte: { label:'Astreinte',    debut:'08:00', fin:'08:00', couleur:'#c2410c', presence:false },
    Repos:     { label:'Repos',        debut:'',      fin:'',      couleur:'#6b6b6b', presence:false },
  },
  STATUTS:['Prévu','En cours','Terminé','Absent','Remplacé'],

  _read(s){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(s,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+s)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(s,rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(s,rows,true);
    else localStorage.setItem('medicore_'+s,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },
  _uid(p){ return (p||'PL')+Date.now().toString(36)+Math.random().toString(36).slice(2,5); },

  postes(){ return this._read(this.S_POSTES); },
  releves(){ return this._read(this.S_RELEVES); },

  // ── Affectation d'un agent à un poste (service/date/type) ────────────────────
  affecter({ date, service, type, agentMat, agentNom, heureDebut, heureFin, notes }){
    if(!date||!service||!type||!agentMat) return { erreur:'champs_requis' };
    const t=this.TYPES[type]||{};
    const rows=this.postes();
    const poste={ id:this._uid('PST-'), date, service, type,
      agentMat, agentNom:agentNom||agentMat,
      heureDebut:heureDebut||t.debut||'', heureFin:heureFin||t.fin||'',
      statut:'Prévu', notes:notes||'',
      cree_par:this._user().nom||'', cree_le:new Date().toISOString() };
    rows.push(poste); this._write(this.S_POSTES, rows);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Planning — affectation','CREATION',
      `${agentNom||agentMat} — ${service} — ${t.label||type} — ${date}`, poste.id);
    return { ok:true, poste };
  },
  modifier(id, champs){
    const rows=this.postes(); const p=rows.find(x=>x.id===id); if(!p) return { erreur:'introuvable' };
    Object.assign(p, champs); this._write(this.S_POSTES, rows); return { ok:true, poste:p };
  },
  supprimer(id){
    const rows=this.postes().filter(x=>x.id!==id); this._write(this.S_POSTES, rows); return { ok:true };
  },

  // ── Prise de service (l'agent entrant confirme et reçoit les consignes) ─────
  prendreService(posteId, consignesRecues){
    const rows=this.postes(); const p=rows.find(x=>x.id===posteId); if(!p) return { erreur:'introuvable' };
    p.statut='En cours'; p.prise_le=new Date().toISOString();
    this._write(this.S_POSTES, rows);
    const rel=this.releves();
    rel.unshift({ id:this._uid('REL-'), posteId, type:'prise', date:new Date().toISOString(),
      agentMat:p.agentMat, agentNom:p.agentNom, service:p.service, consignes:consignesRecues||'' });
    this._write(this.S_RELEVES, rel);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Prise de service','VALIDATION',
      `${p.agentNom} — ${p.service} (${this.TYPES[p.type]?.label||p.type})`, posteId);
    return { ok:true };
  },
  // ── Fin de service (transmission des consignes à l'équipe suivante) ─────────
  finirService(posteId, consignesTransmises){
    const rows=this.postes(); const p=rows.find(x=>x.id===posteId); if(!p) return { erreur:'introuvable' };
    p.statut='Terminé'; p.fin_le=new Date().toISOString();
    this._write(this.S_POSTES, rows);
    const rel=this.releves();
    rel.unshift({ id:this._uid('REL-'), posteId, type:'fin', date:new Date().toISOString(),
      agentMat:p.agentMat, agentNom:p.agentNom, service:p.service, consignes:consignesTransmises||'' });
    this._write(this.S_RELEVES, rel);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Fin de service','VALIDATION',
      `${p.agentNom} — ${p.service} — transmission relève`, posteId);
    return { ok:true };
  },
  // Dernière consigne transmise pour un service à une date donnée (pour affichage à la relève)
  derniereConsigne(service, date){
    const rel=this.releves().filter(r=>r.service===service && r.type==='fin' && r.consignes
      && r.date.slice(0,10)<=(date||new Date().toISOString().slice(0,10)));
    return rel.sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null;
  },

  // ── Permanence du jour : qui est de service maintenant, par service ─────────
  permanenceDuJour(date){
    date = date || new Date().toISOString().slice(0,10);
    const postesJour = this.postes().filter(p=>p.date===date && p.statut!=='Absent');
    return this.SERVICES.map(svc=>{
      const affectes = postesJour.filter(p=>p.service===svc && p.type!=='Repos');
      return { service:svc, postes:affectes, couverture: affectes.some(p=>this.TYPES[p.type]?.presence) };
    });
  },
  // Services sans aucune présence physique affectée à une date (alerte sécurité)
  rupturesCouverture(date){
    return this.permanenceDuJour(date).filter(s=>!s.couverture);
  },

  // ── Planning hebdomadaire : grille service × jour ────────────────────────────
  semaine(dateDebutLundi){
    const jours=[]; const d0=new Date(dateDebutLundi);
    for(let i=0;i<7;i++){ const d=new Date(d0); d.setDate(d0.getDate()+i); jours.push(d.toISOString().slice(0,10)); }
    const postes=this.postes().filter(p=>jours.includes(p.date));
    return { jours, postes };
  },

  // ── Compteurs agent (pour la paie : gardes, astreintes, heures du mois) ──────
  compteursAgent(mat, anneeMois){ // anneeMois = 'YYYY-MM'
    const rows=this.postes().filter(p=>p.agentMat===mat && p.date.startsWith(anneeMois));
    return {
      gardes: rows.filter(p=>p.type==='Garde').length,
      astreintes: rows.filter(p=>p.type==='Astreinte').length,
      nuits: rows.filter(p=>p.type==='Nuit').length,
      total: rows.length,
    };
  },
  // Compteurs agrégés tous agents sur le mois (pour les KPI GTA)
  compteursMois(anneeMois){
    const rows=this.postes().filter(p=>p.date.startsWith(anneeMois));
    return { gardes: rows.filter(p=>p.type==='Garde').length, astreintes: rows.filter(p=>p.type==='Astreinte').length };
  },
};
if(typeof window!=='undefined') window.MEDICORE_PLANNING = MEDICORE_PLANNING;
