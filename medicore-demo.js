// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Générateur de données de démonstration INTER-MODULES
// CHU de Yopougon — jeu de démonstration cohérent couvrant TOUS les modules
// ──────────────────────────────────────────────────────────────────────────────
// Parcours patients reliant : DPI · Prescriptions · Laboratoire · Imagerie
// · Pharmacie · Facturation · Bloc · RH/Paie · Comptabilité · Trésorerie · Immo
// Idempotent : ne réinjecte pas si données démo déjà présentes (sauf force).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_DEMO = {
  TAG:'DEMO',
  _save(store, rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(store, rows, true);
    else localStorage.setItem('medicore_'+store, JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _load(store){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(store,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+store)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _saveObj(store, obj){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(store, obj, true);
    else localStorage.setItem('medicore_'+store, JSON.stringify({_v:1,_ts:Date.now(),d:obj})); },

  _today(){ return new Date().toISOString().slice(0,10); },
  _nowFr(){ return new Date().toLocaleString('fr-FR'); },
  _dateOffset(jours){ const d=new Date(); d.setDate(d.getDate()+jours); return d.toISOString().slice(0,10); },

  // ── PATIENTS (champs alignés sur le DPI : ddn, type, statut, lit, service…) ────
  PATIENTS:[
    { id:'D300001', ipp:'IPP-2026-0001', nom:'KOUASSI Adjoua',  sexe:'F', ddn:'1992-03-12', service:'Médecine générale', type:'Hospitalisé', statut:'Actif', lit:'101-A', medecin:'Dr. COULIBALY Seydou', motif:'Paludisme grave — accès pernicieux', allergies:'Pénicilline', antecedents:'HTA traitée', comorbidites:'HTA', groupe:'O+', assurance:'CNAM', entree:null, tel:'+225 07 11 22 33 01' },
    { id:'D300002', ipp:'IPP-2026-0002', nom:'TRAORÉ Moussa',   sexe:'M', ddn:'1968-07-22', service:'Chirurgie', type:'Hospitalisé', statut:'Actif', lit:'204-B', medecin:'Dr. TOURÉ Mamadou', motif:'Coxarthrose invalidante — PTH programmée', allergies:'', antecedents:'Dyslipidémie', comorbidites:'Dyslipidémie', groupe:'A+', assurance:'Mutuelle', entree:null, tel:'+225 07 11 22 33 02' },
    { id:'D300003', ipp:'IPP-2026-0003', nom:'DIABATÉ Fatim',   sexe:'F', ddn:'1999-01-05', service:'Maternité', type:'Hospitalisé', statut:'Actif', lit:'301-C', medecin:'Dr. BAMBA Aïcha', motif:'Grossesse 38 SA — surveillance pré-travail', allergies:'', antecedents:'G2P1', comorbidites:'', groupe:'B+', assurance:'CNAM', entree:null, tel:'+225 07 11 22 33 03' },
    { id:'D300004', ipp:'IPP-2026-0004', nom:'KONÉ Ibrahim',    sexe:'M', ddn:'1981-11-30', service:'Médecine générale', type:'Consultation', statut:'Actif', lit:'', medecin:'Dr. COULIBALY Seydou', motif:'Diabète type 2 déséquilibré', allergies:'', antecedents:'Diabète type 2 depuis 2015', comorbidites:'Diabète, obésité', groupe:'O+', assurance:'Privée', entree:null, tel:'+225 07 11 22 33 04' },
    { id:'D300005', ipp:'IPP-2026-0005', nom:'BAMBA Aïcha',     sexe:'F', ddn:'2020-04-18', service:'Urgences', type:'Urgences', statut:'Actif', lit:'URG-02', medecin:'Dr. SORO Kassoum', motif:'Fièvre + déshydratation sévère', allergies:'', antecedents:'Aucun', comorbidites:'', groupe:'A+', assurance:'CNAM', entree:null, tel:'+225 07 11 22 33 05' },
    { id:'D300006', ipp:'IPP-2026-0006', nom:'YAO Serge',       sexe:'M', ddn:'1995-09-08', service:'Chirurgie', type:'Urgences', statut:'Actif', lit:'201-A', medecin:'Dr. SORO Kassoum', motif:'Appendicite aiguë — bloc en urgence', allergies:'', antecedents:'Aucun', comorbidites:'', groupe:'AB+', assurance:'Aucune', entree:null, tel:'+225 07 11 22 33 06' },
    { id:'D300007', ipp:'IPP-2026-0007', nom:'OUATTARA Mariam', sexe:'F', ddn:'1975-06-15', service:'Médecine générale', type:'Ambulatoire', statut:'Actif', lit:'', medecin:'Dr. DIABATÉ Oumar', motif:'Bilan de santé annuel', allergies:'Iode', antecedents:'Aucun', comorbidites:'', groupe:'O-', assurance:'Mutuelle', entree:null, tel:'+225 07 11 22 33 07' },
    { id:'D300008', ipp:'IPP-2026-0008', nom:'GBAGBO Laurent',  sexe:'M', ddn:'1955-03-31', service:'Chirurgie', type:'Sorti', statut:'Sorti', lit:'', medecin:'Dr. TOURÉ Mamadou', motif:'Hernie inguinale — cure réussie', allergies:'', antecedents:'HTA', comorbidites:'HTA', groupe:'A+', assurance:'CNAM', entree:null, tel:'+225 07 11 22 33 08' },
  ],

  // ── PERSONNEL RH (CNPS, ITS — barèmes Côte d'Ivoire) ──────────────────────────
  PERSONNEL:[
    { mat:'AG-001', nom:'TOURÉ Mamadou',    cat:'Médical',      service:'Chirurgie',         poste:'Chirurgien viscéral',  salaire:850000, indem:150000, cnps:'CI-CNPS-1100001', statut:'Actif', dateEmbauche:'2018-02-01', finContrat:'' },
    { mat:'AG-002', nom:'BAMBA Aïcha',      cat:'Médical',      service:'Maternité',         poste:'Gynécologue-obstétricien', salaire:820000, indem:140000, cnps:'CI-CNPS-1100002', statut:'Actif', dateEmbauche:'2019-05-15', finContrat:'' },
    { mat:'AG-003', nom:'COULIBALY Seydou', cat:'Médical',      service:'Médecine générale', poste:'Médecin interniste',   salaire:780000, indem:120000, cnps:'CI-CNPS-1100003', statut:'Actif', dateEmbauche:'2017-09-01', finContrat:'' },
    { mat:'AG-004', nom:'SORO Kassoum',     cat:'Médical',      service:'Urgences',          poste:'Urgentiste',           salaire:760000, indem:160000, cnps:'CI-CNPS-1100004', statut:'Actif', dateEmbauche:'2020-01-10', finContrat:'' },
    { mat:'AG-005', nom:'DIALLO Mariam',    cat:'Paramédical',  service:'Bloc opératoire',   poste:'IBODE',                salaire:420000, indem:60000,  cnps:'CI-CNPS-1100005', statut:'Actif', dateEmbauche:'2021-03-01', finContrat:'' },
    { mat:'AG-006', nom:'KONAN Adjoua',     cat:'Pharmacie',    service:'Pharmacie',         poste:'Pharmacien hospitalier', salaire:680000, indem:90000,  cnps:'CI-CNPS-1100006', statut:'Actif', dateEmbauche:'2019-11-20', finContrat:'' },
    { mat:'AG-007', nom:'DOSSO Ramatou',    cat:'Paramédical',  service:'Laboratoire',       poste:'Technicien labo',      salaire:380000, indem:50000,  cnps:'CI-CNPS-1100007', statut:'Actif', dateEmbauche:'2022-06-01', finContrat:'2026-08-31' },
    { mat:'AG-008', nom:'YÉO Koffi',        cat:'Technique',    service:'Imagerie',          poste:'Manipulateur radio',   salaire:400000, indem:55000,  cnps:'CI-CNPS-1100008', statut:'Actif', dateEmbauche:'2020-08-15', finContrat:'' },
    { mat:'AG-009', nom:'KOUADIO Affoué',   cat:'Paramédical',  service:'Médecine générale', poste:'Infirmière major',     salaire:360000, indem:45000,  cnps:'CI-CNPS-1100009', statut:'Actif', dateEmbauche:'2021-10-01', finContrat:'' },
    { mat:'AG-010', nom:'TANO Brice',       cat:'Administratif',service:'Administration',    poste:'Agent facturation',    salaire:320000, indem:35000,  cnps:'CI-CNPS-1100010', statut:'Actif', dateEmbauche:'2023-01-15', finContrat:'' },
  ],

  // ── IMMOBILISATIONS (matériel médical CHU) ────────────────────────────────────
  IMMO:[
    { num:'IMM-001', desig:'Scanner 64 barrettes Siemens',  cat:'Matériel médical', compte:'2154', dateAcq:'2022-01-15', vb:285000000, duree:7, statut:'Actif' },
    { num:'IMM-002', desig:'Échographe GE Voluson',         cat:'Matériel médical', compte:'2154', dateAcq:'2023-03-10', vb:42000000,  duree:5, statut:'Actif' },
    { num:'IMM-003', desig:'Table opératoire Maquet',       cat:'Matériel médical', compte:'2154', dateAcq:'2021-06-01', vb:38000000,  duree:10, statut:'Actif' },
    { num:'IMM-004', desig:'Automate biochimie Cobas',      cat:'Matériel médical', compte:'2154', dateAcq:'2022-09-20', vb:55000000,  duree:7, statut:'Actif' },
    { num:'IMM-005', desig:'Ambulance médicalisée Toyota',  cat:'Matériel transport', compte:'2182', dateAcq:'2023-05-01', vb:35000000, duree:5, statut:'Actif' },
    { num:'IMM-006', desig:'Groupe électrogène 250 kVA',    cat:'Installation technique', compte:'2153', dateAcq:'2020-11-10', vb:28000000, duree:10, statut:'Actif' },
    { num:'IMM-007', desig:'Bâtiment hospitalisation aile B', cat:'Construction', compte:'2131', dateAcq:'2018-01-01', vb:1200000000, duree:25, statut:'Actif' },
  ],

  estCharge(){ return this._load('patients').some(p=>p && p._demo); },

  injecter(force){
    if(this.estCharge() && !force) return { skip:true, raison:'données démo déjà présentes' };
    const today=this._today();
    const nowFr=this._nowFr();

    // ══ 1) PATIENTS (DPI) ════════════════════════════════════════════════════════
    const patients=this._load('patients').filter(p=>!p._demo);
    this.PATIENTS.forEach(p=>{
      const pat=Object.assign({ _demo:true }, p);
      pat.entree = pat.type==='Sorti' ? this._dateOffset(-5) : (pat.type==='Hospitalisé'?this._dateOffset(-2):today);
      if(pat.type==='Sorti') pat.sortie=this._dateOffset(-1);
      patients.push(pat);
    });
    this._save('patients', patients);
    if(typeof window!=='undefined' && Array.isArray(window.patients)){ window.patients.length=0; patients.forEach(x=>window.patients.push(x)); }

    // ══ 2) CONSTANTES VITALES (DPI) ══════════════════════════════════════════════
    const constantes=this._load('constantes')||{};
    const cst={};
    cst['D300001']=[{date:nowFr, ta:'150/95', fc:102, t:39.8, spo2:94, poids:68, glycemie:''}];  // palu grave
    cst['D300002']=[{date:nowFr, ta:'135/85', fc:78,  t:37.0, spo2:98, poids:82, glycemie:''}];
    cst['D300003']=[{date:nowFr, ta:'120/75', fc:88,  t:37.2, spo2:99, poids:74, glycemie:''}];
    cst['D300004']=[{date:nowFr, ta:'140/90', fc:84,  t:36.9, spo2:97, poids:95, glycemie:198}]; // diabète
    cst['D300005']=[{date:nowFr, ta:'90/60',  fc:128, t:39.5, spo2:96, poids:18, glycemie:''}];  // enfant fièvre
    cst['D300006']=[{date:nowFr, ta:'125/80', fc:96,  t:38.2, spo2:98, poids:70, glycemie:''}];  // appendicite
    const constantesObj = (typeof constantes==='object' && !Array.isArray(constantes))?constantes:{};
    Object.assign(constantesObj, cst);
    this._saveObj('constantes', constantesObj);

    // ══ 3) PRESCRIPTIONS (DPI → Pharmacie PUI) ══════════════════════════════════
    const RX=(typeof MEDICORE_RX!=='undefined')?MEDICORE_RX:null;
    const presc=[
      { p:'D300001', med:'Artésunate 60mg inj.',      polo:'2,4 mg/kg ×3',  voie:'IV', duree:'3 j',  statut:'Validée' },
      { p:'D300001', med:'Paracétamol 1g perf.',      polo:'1g ×3/j',       voie:'IV', duree:'5 j',  statut:'Validée' },
      { p:'D300001', med:'Glucosé 5% 500mL',          polo:'2 poches/j',    voie:'IV', duree:'3 j',  statut:'En attente validation' },
      { p:'D300002', med:'Céfazoline 2g inj.',        polo:'2g pré-op',     voie:'IV', duree:'1 j',  statut:'Validée' },
      { p:'D300002', med:'Énoxaparine 4000 UI',       polo:'1 inj/j',       voie:'SC', duree:'10 j', statut:'Validée' },
      { p:'D300004', med:'Metformine 500mg cp.',      polo:'1cp ×2/j',      voie:'PO', duree:'30 j', statut:'Validée' },
      { p:'D300004', med:'Gliclazide 30mg LP',        polo:'1cp/j',         voie:'PO', duree:'30 j', statut:'En attente validation' },
      { p:'D300005', med:'Sérum physiologique 500mL', polo:'selon poids',   voie:'IV', duree:'1 j',  statut:'Validée' },
      { p:'D300005', med:'Paracétamol sirop',         polo:'15 mg/kg ×4',   voie:'PO', duree:'3 j',  statut:'Validée' },
      { p:'D300006', med:'Métronidazole 500mg inj.',  polo:'500mg ×3/j',    voie:'IV', duree:'5 j',  statut:'Validée' },
      { p:'D300006', med:'Ceftriaxone 1g inj.',       polo:'1g ×2/j',       voie:'IV', duree:'5 j',  statut:'Validée' },
    ];
    // Registre local DPI (objet par patientId)
    const prescObj={};
    presc.forEach((r,idx)=>{
      if(!prescObj[r.p]) prescObj[r.p]=[];
      prescObj[r.p].push({ id:'RXDEMO'+idx, med:r.med, posologie:r.polo, voie:r.voie, duree:r.duree, statut:r.statut,
        date:nowFr, medecin:(this.PATIENTS.find(x=>x.id===r.p)||{}).medecin||'Médecin' });
    });
    this._saveObj('prescriptions', prescObj);
    // Registre partagé PUI
    if(RX){
      presc.forEach((r,idx)=>{ const pat=this.PATIENTS.find(x=>x.id===r.p);
        RX.ajouter({ id:'RXDEMO'+idx, patientId:r.p, patient_nom:pat.nom, patient_ipp:pat.ipp, service:pat.service,
          med:r.med, posologie:r.polo, voie:r.voie, duree:r.duree, statut:r.statut, medecin:pat.medecin, date:nowFr, silencieux:true });
      });
    }

    // ══ 4) RÉSULTATS BIOLOGIQUES (DPI — format param/val/ref/unite/anormal) ═════
    const bioObj={};
    bioObj['D300001']=[
      {param:'Goutte épaisse', val:'Positif +++', unite:'P. falciparum', ref:'Négatif', anormal:true},
      {param:'Hémoglobine', val:'7.8', unite:'g/dL', ref:'12-16', anormal:true},
      {param:'Plaquettes', val:'85', unite:'10³/µL', ref:'150-400', anormal:true},
      {param:'Créatinine', val:'1.4', unite:'mg/dL', ref:'0.6-1.2', anormal:true},
    ];
    bioObj['D300004']=[
      {param:'Glycémie à jeun', val:'198', unite:'mg/dL', ref:'70-100', anormal:true},
      {param:'HbA1c', val:'9.2', unite:'%', ref:'<7', anormal:true},
      {param:'Cholestérol total', val:'245', unite:'mg/dL', ref:'<200', anormal:true},
    ];
    bioObj['D300006']=[
      {param:'Globules blancs', val:'15.8', unite:'10³/µL', ref:'4-11', anormal:true},
      {param:'CRP', val:'120', unite:'mg/L', ref:'<5', anormal:true},
    ];
    bioObj['D300007']=[
      {param:'Hémoglobine', val:'13.2', unite:'g/dL', ref:'12-16', anormal:false},
      {param:'Glycémie à jeun', val:'92', unite:'mg/dL', ref:'70-100', anormal:false},
      {param:'Créatinine', val:'0.9', unite:'mg/dL', ref:'0.6-1.2', anormal:false},
    ];
    this._saveObj('bioResultats', bioObj);

    // ══ 5) PRESTATIONS (→ Facturation) ═══════════════════════════════════════════
    const PR=(typeof MEDICORE_PRESTA!=='undefined')?MEDICORE_PRESTA:null;
    if(PR){
      PR.ajouter({ patientId:'D300001', patient_nom:'KOUASSI Adjoua', module:'laboratoire', libelle:'Goutte épaisse + NFS', code:'B-PAL-01', montant:7500, statut:'à facturer' });
      PR.ajouter({ patientId:'D300001', patient_nom:'KOUASSI Adjoua', module:'laboratoire', libelle:'Ionogramme + créatinine', code:'B-BIO-03', montant:8000, statut:'à facturer' });
      PR.ajouter({ patientId:'D300004', patient_nom:'KONÉ Ibrahim', module:'laboratoire', libelle:'Glycémie + HbA1c + bilan lipidique', code:'B-BIO-05', montant:15000, statut:'à facturer' });
      PR.ajouter({ patientId:'D300002', patient_nom:'TRAORÉ Moussa', module:'imagerie', libelle:'Radiographie bassin face', code:'IMG-RX-12', montant:25000, statut:'à facturer' });
      PR.ajouter({ patientId:'D300005', patient_nom:'BAMBA Aïcha', module:'imagerie', libelle:'Radiographie thorax', code:'IMG-RX-03', montant:20000, statut:'à facturer' });
      PR.ajouter({ patientId:'D300006', patient_nom:'YAO Serge', module:'imagerie', libelle:'Échographie abdominale', code:'IMG-ECHO-02', montant:30000, statut:'à facturer' });
      this.PATIENTS.filter(p=>p.statut==='Actif').forEach(pat=>PR.ajouter({ patientId:pat.id, patient_nom:pat.nom, module:'consultation', libelle:'Consultation '+pat.service, montant:10000, statut:'à facturer' }));
    }

    // ══ 6) RÉSULTATS partagés labo (circuit MEDICORE_RESULTATS) ═══════════════════
    const RES=(typeof MEDICORE_RESULTATS!=='undefined')?MEDICORE_RESULTATS:null;
    if(RES){
      try{
        RES.ajouter({ patientId:'D300001', patient_nom:'KOUASSI Adjoua', module:'laboratoire', examen:'Goutte épaisse', resultat:'Positif — P. falciparum (+++)', critique:true, date:nowFr });
        RES.ajouter({ patientId:'D300004', patient_nom:'KONÉ Ibrahim', module:'laboratoire', examen:'HbA1c', resultat:'9,2 % (déséquilibré)', critique:false, date:nowFr });
        RES.ajouter({ patientId:'D300006', patient_nom:'YAO Serge', module:'laboratoire', examen:'NFS + CRP', resultat:'Hyperleucocytose 15800, CRP 120', critique:true, date:nowFr });
      }catch(e){}
    }

    // ══ 7) DEMANDES inter-services (circuit) ═════════════════════════════════════
    const DEM=(typeof MEDICORE_DEMANDES!=='undefined')?MEDICORE_DEMANDES:null;
    if(DEM){
      try{
        DEM.creer({ cible:'laboratoire', objet:'Goutte épaisse + NFS', type:'Analyse', patient:{ id:'D300001', nom:'KOUASSI Adjoua' }, priorite:'Urgent', details:'Suspicion paludisme grave' });
        DEM.creer({ cible:'imagerie', objet:'Radiographie bassin face', type:'Imagerie', patient:{ id:'D300002', nom:'TRAORÉ Moussa' }, priorite:'Normal', details:'Bilan pré-opératoire PTH' });
        DEM.creer({ cible:'imagerie', objet:'Échographie abdominale', type:'Imagerie', patient:{ id:'D300006', nom:'YAO Serge' }, priorite:'Urgent', details:'Suspicion appendicite' });
      }catch(e){}
    }

    // ══ 8) BLOC OPÉRATOIRE ═══════════════════════════════════════════════════════
    const interv=this._load('interventions').filter(x=>!x._demo);
    interv.push({ _demo:true, id:'OP-DEMO-1', patient:'TRAORÉ Moussa', patient_id:'D300002', acte:'Prothèse totale de hanche (PTH)', chirurgien:'Dr. TOURÉ', salle:'Salle 2', date:today, heure:'09:00', duree:120, type:'Programmée', priorite:'Programmée', anesth:'Rachianesthésie', anesthMed:'Dr. KONÉ', statut:'Programmée', obs:'Coxarthrose. Bilan pré-op OK.', dmi:'PTH cimentée' });
    interv.push({ _demo:true, id:'OP-DEMO-2', patient:'YAO Serge', patient_id:'D300006', acte:'Appendicectomie', chirurgien:'Dr. SORO', salle:'Salle 4', date:today, heure:'14:30', duree:60, type:'Urgence', priorite:'Urgence', anesth:'Anesthésie générale', anesthMed:'Dr. KONÉ', statut:'Programmée', obs:'Appendicite aiguë confirmée.', dmi:'—' });
    interv.push({ _demo:true, id:'OP-DEMO-3', patient:'GBAGBO Laurent', patient_id:'D300008', acte:'Cure hernie inguinale', chirurgien:'Dr. TOURÉ', salle:'Salle 1', date:this._dateOffset(-3), heure:'10:00', duree:75, type:'Programmée', priorite:'Programmée', anesth:'Anesthésie locale', anesthMed:'Dr. KONÉ', statut:'Clôturée', obs:'Intervention réussie. Sortie J+2.', dmi:'Plaque prothétique' });
    this._save('interventions', interv);

    // ══ 9) RH — PERSONNEL ════════════════════════════════════════════════════════
    const persoExist=this._load('personnel').filter(p=>!(p && p._demo));
    this.PERSONNEL.forEach(p=>persoExist.push(Object.assign({_demo:true}, p)));
    this._save('personnel', persoExist);

    // ══ 10) IMMOBILISATIONS ══════════════════════════════════════════════════════
    const immoExist=this._load('immobilisations').filter(i=>!(i && i._demo));
    this.IMMO.forEach(i=>immoExist.push(Object.assign({_demo:true}, i)));
    this._save('immobilisations', immoExist);

    // ══ 11) COMPTABILITÉ — écritures SYSCOHADA ═══════════════════════════════════
    const ecr=this._load('ecritures').filter(e=>!(e && e._demo));
    const annee=new Date().getFullYear();
    let nec=0;
    const ecrire=(journal,piece,compte,libelle,debit,credit)=>{ ecr.push({_demo:true, id:'EC-'+annee+'-D'+String(++nec).padStart(4,'0'), date:today, journal, piece, compte, libelle, debit, credit, lettre:'', saisiepar:'DEMO'}); };
    // Encaissement consultation (caisse → produits)
    ecrire('CA','CAI-001','531','Encaissement consultations jour',70000,0);
    ecrire('CA','CAI-001','706','Prestations de services médicaux',0,70000);
    // Achat médicaments fournisseur
    ecrire('AC','FA-2026-018','601','Achat médicaments PUI',0,0);
    ecrire('AC','FA-2026-018','601','Achat médicaments PUI',1250000,0);
    ecrire('AC','FA-2026-018','401','Fournisseur PharmaCI',0,1250000);
    // Salaires
    ecrire('OD','PAIE-06','661','Rémunérations personnel',5870000,0);
    ecrire('OD','PAIE-06','421','Personnel — rémunérations dues',0,5870000);
    this._save('ecritures', ecr);

    // ══ 12) TRÉSORERIE — mouvements ══════════════════════════════════════════════
    const treso=this._load('mouvements_tresorerie').filter(m=>!(m && m._demo));
    const tm=(date,type,compte,libelle,tiers,montant,ref)=>treso.push({_demo:true, id:'TR-D'+(treso.length+1), date, type, compte, libelle, tiers, montant, ref});
    tm(today,'Encaissement','531','Recettes consultations','Patients divers',70000,'CAI-001');
    tm(today,'Encaissement','521','Règlement CNAM','CNAM',2400000,'CNAM-2026-06');
    tm(this._dateOffset(-1),'Décaissement','521','Paiement fournisseur médicaments','PharmaCI',1250000,'VIR-018');
    tm(this._dateOffset(-2),'Décaissement','531','Achat consommables','Magasin central',180000,'CAI-D02');
    this._save('mouvements_tresorerie', treso);

    // ══ 13) FACTURES émises ══════════════════════════════════════════════════════
    const fact=this._load('factures').filter(f=>!(f && f._demo));
    fact.push({_demo:true, id:'FAC-2026-0001', patient_id:'D300008', patient_nom:'GBAGBO Laurent', date:this._dateOffset(-1), montant_total:185000, montant_paye:185000, statut:'Payée', detail:'Cure hernie + séjour 2j'});
    fact.push({_demo:true, id:'FAC-2026-0002', patient_id:'D300004', patient_nom:'KONÉ Ibrahim', date:today, montant_total:35000, montant_paye:0, statut:'Impayée', detail:'Consultation + bilan diabète'});
    this._save('factures', fact);

    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Données démo CHU Yopougon','CREATION', this.PATIENTS.length+' patients + RH + compta + tréso + immo', 'DEMO');
    return { ok:true, patients:this.PATIENTS.length, personnel:this.PERSONNEL.length, immo:this.IMMO.length };
  },

  // ── Suppression ciblée (marqueur _demo + stores liés) ─────────────────────────
  supprimer(){
    const patients=this._load('patients').filter(p=>!(p && p._demo));
    this._save('patients', patients);
    if(typeof window!=='undefined' && Array.isArray(window.patients)){ window.patients.length=0; patients.forEach(x=>window.patients.push(x)); }
    this._save('interventions', this._load('interventions').filter(x=>!(x && x._demo)));
    this._save('personnel', this._load('personnel').filter(p=>!(p && p._demo)));
    this._save('immobilisations', this._load('immobilisations').filter(i=>!(i && i._demo)));
    this._save('ecritures', this._load('ecritures').filter(e=>!(e && e._demo)));
    this._save('mouvements_tresorerie', this._load('mouvements_tresorerie').filter(m=>!(m && m._demo)));
    this._save('factures', this._load('factures').filter(f=>!(f && f._demo)));
    // Stores entièrement liés au parcours démo → vidés
    ['prescriptions','bioResultats','constantes','prestations','resultats','demandes'].forEach(s=>this._saveObj(s, Array.isArray(this._load(s))?[]:{}));
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Suppression données démo','SUPPRESSION','patients + parcours inter-modules','DEMO');
    return { ok:true };
  },
};
if(typeof window!=='undefined') window.MEDICORE_DEMO = MEDICORE_DEMO;
