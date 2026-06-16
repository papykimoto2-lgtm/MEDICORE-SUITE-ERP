// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Moteur Bloc opératoire
// ──────────────────────────────────────────────────────────────────────────────
//  • Parcours opératoire horodaté (arrivée → préparation → anesthésie → incision
//    → fin → réveil → sortie), chaque étape datée automatiquement
//  • Check-list sécurité OMS en 3 temps (avant anesthésie / avant incision /
//    avant sortie) — bloquante : pas de clôture sans les 3 temps validés
//  • Statuts de salle temps réel (libre / préparation / occupée / nettoyage /
//    désinfection / maintenance / hors service)
//  • Équipe complète + signatures électroniques (chirurgien, anesthésiste,
//    IBODE, IADE, circulant, aide opératoire, interne)
//  • Classe ASA, type d'anesthésie, traçabilité DMI
//  État persisté par intervention dans le store 'bloc_interventions'.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_BLOC = {
  S_OP:'bloc_interventions', S_SALLES:'bloc_salles',

  // ── Référentiels ─────────────────────────────────────────────────────────────
  PRIORITES:['Programmée','Semi-urgence','Urgence'],
  ASA:['ASA I — patient sain','ASA II — atteinte modérée','ASA III — atteinte sévère',
       'ASA IV — menace vitale permanente','ASA V — moribond','ASA VI — mort encéphalique (don d\'organes)'],
  ANESTHESIES:['Anesthésie générale','Rachianesthésie','Péridurale','Anesthésie locale','Anesthésie locorégionale','Sédation'],
  ROLES_EQUIPE:['Chirurgien','Aide opératoire','Anesthésiste','IADE','IBODE','Infirmier circulant','Interne'],
  STATUTS_SALLE:['Libre','Préparation','Occupée','Nettoyage','Désinfection','Maintenance','Hors service'],
  COULEURS_SALLE:{ 'Libre':'#1e7a4e','Préparation':'#c8702a','Occupée':'#1a4b6e','Nettoyage':'#6b21a8','Désinfection':'#0e7490','Maintenance':'#b58100','Hors service':'#b92b2b' },

  // ── Parcours opératoire (étapes horodatées) ──────────────────────────────────
  ETAPES_PARCOURS:[
    { key:'arrivee',     label:'Patient arrivé',      icon:'🚪' },
    { key:'preparation', label:'Préparation',         icon:'🧼' },
    { key:'anesthesie',  label:'Anesthésie',          icon:'💉' },
    { key:'incision',    label:'Début intervention',  icon:'🔪' },
    { key:'fin',         label:'Fin intervention',    icon:'✅' },
    { key:'reveil',      label:'Salle de réveil',     icon:'🛏' },
    { key:'sortie',      label:'Sortie du bloc',      icon:'🏥' },
  ],

  // ── Check-list OMS — 3 temps ──────────────────────────────────────────────────
  CHECKLIST_OMS:{
    avant_anesthesie:{ label:'Avant anesthésie', items:[
      'Identité du patient confirmée','Consentement chirurgical signé','Site opératoire marqué',
      'Allergies connues vérifiées','Voies aériennes / risque d\'inhalation évalués','Matériel d\'anesthésie vérifié'] },
    avant_incision:{ label:'Avant incision (time-out)', items:[
      'Présentation de l\'équipe (noms et rôles)','Identité, site et intervention confirmés à voix haute',
      'Antibioprophylaxie administrée (< 60 min)','Imagerie essentielle disponible','Instruments stériles vérifiés','Étapes critiques anticipées'] },
    avant_sortie:{ label:'Avant sortie de salle', items:[
      'Compte des compresses correct','Compte des aiguilles correct','Compte des instruments correct',
      'Étiquetage des échantillons (prélèvements)','Problèmes de matériel signalés','Consignes post-opératoires définies'] },
  },

  _read(s){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(s,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+s)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(s,rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(s,rows,true);
    else localStorage.setItem('medicore_'+s,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _now(){ return new Date().toISOString(); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  // ── Salles ────────────────────────────────────────────────────────────────────
  SALLES_DEFAUT:[
    { id:'s1', nom:'Salle 1', spec:'Chirurgie générale & digestive' },
    { id:'s2', nom:'Salle 2', spec:'Chirurgie orthopédique' },
    { id:'s3', nom:'Salle 3', spec:'Gynécologie-Obstétrique' },
    { id:'s4', nom:'Salle 4', spec:'Urgences chirurgicales' },
    { id:'s5', nom:'Salle 5', spec:'Ophtalmologie / ORL' },
  ],
  salles(){
    const custom=this._read(this.S_SALLES);
    if(custom.length) return custom;
    return this.SALLES_DEFAUT.map(s=>Object.assign({statut:'Libre'}, s));
  },
  salle(id){ return this.salles().find(s=>s.id===id || s.nom===id); },
  majSalle(id, statut, motif){
    let list=this._read(this.S_SALLES);
    if(!list.length) list=this.SALLES_DEFAUT.map(s=>Object.assign({statut:'Libre'}, s));
    const s=list.find(x=>x.id===id||x.nom===id); if(!s) return null;
    s.statut=statut; s.statut_motif=motif||''; s.statut_depuis=this._now(); s.statut_par=this._user().nom||'';
    this._write(this.S_SALLES, list);
    return s;
  },
  ajouterSalle(o){ let list=this._read(this.S_SALLES);
    if(!list.length) list=this.SALLES_DEFAUT.map(s=>Object.assign({statut:'Libre'}, s));
    const id=o.id||('s'+(list.length+1)+Date.now().toString(36).slice(-2));
    list.push({ id, nom:o.nom||('Salle '+(list.length+1)), spec:o.spec||'', statut:'Libre' });
    this._write(this.S_SALLES, list); return { id };
  },

  // ── Interventions ─────────────────────────────────────────────────────────────
  all(){ return this._read(this.S_OP); },
  get(id){ return this._read(this.S_OP).find(o=>o.id===id); },
  _save(op){ const list=this._read(this.S_OP); const i=list.findIndex(x=>x.id===op.id);
    if(i>=0) list[i]=op; else list.unshift(op); this._write(this.S_OP, list); return op; },

  creer(o){
    const op={ id:o.id||('OP'+Date.now().toString(36)+Math.random().toString(36).slice(2,4)),
      patient:o.patient||'', patient_id:o.patient_id||'', acte:o.acte||'',
      chirurgien:o.chirurgien||'', salle:o.salle||'', date:o.date||new Date().toISOString().slice(0,10),
      heure:o.heure||'08:00', duree:+o.duree||90, priorite:o.priorite||'Programmée',
      asa:o.asa||'', anesthesie:o.anesthesie||'', anesthesiste:o.anesthesiste||'',
      obs:o.obs||'', statut:'Programmée',
      equipe:[], parcours:{}, checklist:{ avant_anesthesie:{}, avant_incision:{}, avant_sortie:{} },
      dmi:[], consommables:[], cr:'', signatures:{}, created_at:this._now() };
    // Chirurgien + anesthésiste pré-ajoutés à l'équipe
    if(op.chirurgien) op.equipe.push({ role:'Chirurgien', nom:op.chirurgien, signe:false });
    if(op.anesthesiste) op.equipe.push({ role:'Anesthésiste', nom:op.anesthesiste, signe:false });
    this._save(op);
    this._audit('Programmation intervention', op.id, `${op.acte} — ${op.patient} — ${op.salle}`);
    return op;
  },
  modifier(id, patch){ const op=this.get(id); if(!op) return null; Object.assign(op, patch); return this._save(op); },
  supprimer(id){ this._write(this.S_OP, this.all().filter(o=>o.id!==id)); },

  // ── Équipe + signatures ───────────────────────────────────────────────────────
  ajouterMembre(id, role, nom){ const op=this.get(id); if(!op) return null;
    op.equipe=op.equipe||[]; op.equipe.push({ role, nom, signe:false }); return this._save(op); },
  retirerMembre(id, idx){ const op=this.get(id); if(!op||!op.equipe) return null; op.equipe.splice(idx,1); return this._save(op); },
  signer(id, idx){ const op=this.get(id); if(!op||!op.equipe||!op.equipe[idx]) return null;
    op.equipe[idx].signe=true; op.equipe[idx].signe_le=this._now();
    this._audit('Signature électronique', id, `${op.equipe[idx].role} — ${op.equipe[idx].nom}`);
    return this._save(op); },

  // ── Parcours horodaté ─────────────────────────────────────────────────────────
  horodater(id, etapeKey){ const op=this.get(id); if(!op) return null;
    op.parcours=op.parcours||{}; op.parcours[etapeKey]=this._now();
    // Synchronise le statut + la salle
    if(etapeKey==='incision'){ op.statut='En cours'; this.majSalle(op.salle, 'Occupée'); }
    if(etapeKey==='fin'){ op.statut='Terminée — réveil'; }
    if(etapeKey==='reveil'){ this.majSalle(op.salle, 'Nettoyage'); }
    if(etapeKey==='sortie'){ op.statut='Sortie'; }
    this._audit('Parcours opératoire', id, this.ETAPES_PARCOURS.find(e=>e.key===etapeKey)?.label||etapeKey);
    return this._save(op);
  },
  dureeReelle(op){ if(op.parcours&&op.parcours.incision&&op.parcours.fin){
    return Math.round((new Date(op.parcours.fin)-new Date(op.parcours.incision))/60000); } return null; },

  // ── Check-list OMS ────────────────────────────────────────────────────────────
  cocherChecklist(id, temps, itemIdx, valeur){ const op=this.get(id); if(!op) return null;
    op.checklist=op.checklist||{}; op.checklist[temps]=op.checklist[temps]||{};
    op.checklist[temps][itemIdx]=valeur; return this._save(op); },
  checklistComplete(op, temps){ const items=this.CHECKLIST_OMS[temps].items;
    const c=(op.checklist&&op.checklist[temps])||{};
    return items.every((_,i)=>c[i]===true); },
  checklistGlobaleComplete(op){ return Object.keys(this.CHECKLIST_OMS).every(t=>this.checklistComplete(op,t)); },
  checklistProgression(op){ let tot=0, ok=0;
    Object.keys(this.CHECKLIST_OMS).forEach(t=>{ const items=this.CHECKLIST_OMS[t].items; tot+=items.length;
      const c=(op.checklist&&op.checklist[t])||{}; items.forEach((_,i)=>{ if(c[i]===true) ok++; }); });
    return { ok, tot, pct: tot?Math.round(ok/tot*100):0 }; },

  // ── Clôture (bloquée si check-list incomplète) ───────────────────────────────
  peutCloturer(op){
    if(!this.checklistGlobaleComplete(op)) return { ok:false, raison:'Check-list OMS incomplète (3 temps requis).' };
    if(!op.parcours || !op.parcours.fin) return { ok:false, raison:'Fin d\'intervention non horodatée.' };
    return { ok:true };
  },
  cloturer(id){ const op=this.get(id); if(!op) return null;
    const chk=this.peutCloturer(op); if(!chk.ok) return { erreur:chk.raison };
    op.statut='Clôturée'; op.cloture_le=this._now(); op.cloture_par=this._user().nom||'';
    if(op.salle) this.majSalle(op.salle, 'Désinfection');
    this._audit('Clôture intervention', id, `${op.acte} — ${op.patient}`);
    this._save(op);
    return { ok:true, op };
  },

  // ── Traçabilité DMI (dispositifs implantables) ───────────────────────────────
  ajouterDMI(id, dmi){ const op=this.get(id); if(!op) return null;
    op.dmi=op.dmi||[]; op.dmi.push(Object.assign({ ajoute_le:this._now() }, dmi)); 
    this._audit('Traçabilité DMI', id, `${dmi.designation} — lot ${dmi.lot}${dmi.serie?' / SN '+dmi.serie:''}`);
    return this._save(op); },
  // Recherche tous les patients ayant reçu un DMI (rappel fabricant)
  rechercheDMI(critere){ const res=[];
    this.all().forEach(op=>(op.dmi||[]).forEach(d=>{
      const hay=`${d.designation} ${d.fabricant} ${d.ref} ${d.lot} ${d.serie}`.toLowerCase();
      if(hay.includes((critere||'').toLowerCase())) res.push({ op:op.id, patient:op.patient, date:op.date, chirurgien:op.chirurgien, dmi:d });
    })); return res; },

  _audit(action, ref, detail){ if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log(action,'BLOC',detail,ref); },
};
if(typeof window!=='undefined') window.MEDICORE_BLOC = MEDICORE_BLOC;
