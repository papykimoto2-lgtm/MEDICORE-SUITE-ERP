// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Générateur de données de démonstration INTER-MODULES
// ──────────────────────────────────────────────────────────────────────────────
// Crée des patients avec un parcours cohérent qui traverse les modules :
//   DPI (admission + constantes) → Prescription → Laboratoire → Imagerie
//   → Pharmacie (à servir) → Facturation (prestations) → Bloc opératoire
// Objectif : tester les flux entre modules de bout en bout, pas des données isolées.
// Idempotent : ne réinjecte pas si des patients démo existent déjà (sauf force).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_DEMO = {
  TAG:'DEMO',   // marque les enregistrements générés (suppression ciblée)

  _save(store, rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(store, rows, true);
    else localStorage.setItem('medicore_'+store, JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _load(store){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(store,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+store)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },

  // Patients du jeu de démo (parcours différents pour couvrir tous les modules)
  PATIENTS:[
    { ipp:'IPP-2026-0001', id:'D300001', nom:'KOUASSI Adjoua',  sexe:'F', age:34, naissance:'1992-03-12', tel:'+225 07 11 22 33 01', service:'Médecine', motif:'Paludisme grave', medecin:'Dr. COULIBALY', statut:'Hospitalisé', chambre:'M-102' },
    { ipp:'IPP-2026-0002', id:'D300002', nom:'TRAORÉ Moussa',   sexe:'M', age:58, naissance:'1968-07-22', tel:'+225 07 11 22 33 02', service:'Chirurgie', motif:'Coxarthrose — PTH programmée', medecin:'Dr. TOURÉ', statut:'Hospitalisé', chambre:'C-205' },
    { ipp:'IPP-2026-0003', id:'D300003', nom:'DIABATÉ Fatim',   sexe:'F', age:27, naissance:'1999-01-05', tel:'+225 07 11 22 33 03', service:'Gynéco-Obstétrique', motif:'Suivi grossesse 32 SA', medecin:'Dr. YÉO', statut:'Externe', chambre:'—' },
    { ipp:'IPP-2026-0004', id:'D300004', nom:'KONÉ Ibrahim',    sexe:'M', age:45, naissance:'1981-11-30', tel:'+225 07 11 22 33 04', service:'Médecine', motif:'Diabète déséquilibré', medecin:'Dr. COULIBALY', statut:'Externe', chambre:'—' },
    { ipp:'IPP-2026-0005', id:'D300005', nom:'BAMBA Aïcha',     sexe:'F', age:6,  naissance:'2020-04-18', tel:'+225 07 11 22 33 05', service:'Urgences', motif:'Fièvre + déshydratation', medecin:'Dr. SORO', statut:'Urgence', chambre:'URG-3' },
  ],

  estCharge(){ return this._load('patients').some(p=>p && p._demo); },

  injecter(force){
    if(this.estCharge() && !force) return { skip:true, raison:'données démo déjà présentes' };
    const today=new Date().toISOString().slice(0,10);
    const nowFr=new Date().toLocaleString('fr-FR');

    // ── 1) PATIENTS (DPI) ───────────────────────────────────────────────────────
    const patients=this._load('patients').filter(p=>!p._demo);
    this.PATIENTS.forEach(p=>patients.push(Object.assign({ _demo:true, admission:today,
      constantes:{ ta:'12/8', pouls:78, temp:37.2, spo2:98, poids:p.age<12?20:70 } }, p)));
    this._save('patients', patients);
    if(typeof window!=='undefined' && Array.isArray(window.patients)){ window.patients.length=0; patients.forEach(x=>window.patients.push(x)); }

    // ── 2) PRESCRIPTIONS (DPI → Pharmacie) ──────────────────────────────────────
    const RX=(typeof MEDICORE_RX!=='undefined')?MEDICORE_RX:null;
    const presc=[
      { p:0, med:'Artésunate 60mg inj.',       polo:'2,4 mg/kg ×3',  voie:'IV',  duree:'3 j',  statut:'Validée' },
      { p:0, med:'Paracétamol 1g perf.',       polo:'3×/j',          voie:'IV',  duree:'5 j',  statut:'Validée' },
      { p:0, med:'Glucosé 5% 500mL',           polo:'2/j',           voie:'IV',  duree:'3 j',  statut:'En attente validation' },
      { p:1, med:'Céfazoline 2g inj.',         polo:'1 dose pré-op', voie:'IV',  duree:'1 j',  statut:'Validée' },
      { p:1, med:'Énoxaparine 4000 UI',        polo:'1/j SC',        voie:'SC',  duree:'10 j', statut:'Validée' },
      { p:3, med:'Metformine 500mg cp.',       polo:'2×/j',          voie:'PO',  duree:'30 j', statut:'Validée' },
      { p:3, med:'Gliclazide 30mg LP',         polo:'1×/j',          voie:'PO',  duree:'30 j', statut:'En attente validation' },
      { p:4, med:'Sérum physiologique 500mL',  polo:'selon poids',   voie:'IV',  duree:'1 j',  statut:'Validée' },
      { p:4, med:'Paracétamol sirop',          polo:'15 mg/kg ×4',   voie:'PO',  duree:'3 j',  statut:'Validée' },
    ];
    if(RX){
      presc.forEach((r,idx)=>{ const pat=this.PATIENTS[r.p];
        RX.ajouter({ id:'RXDEMO'+idx, patientId:pat.id, patient_nom:pat.nom, patient_ipp:pat.ipp, service:pat.service,
          med:r.med, posologie:r.polo, voie:r.voie, duree:r.duree, statut:r.statut, medecin:pat.medecin, date:nowFr, silencieux:true });
      });
    }

    // ── 3) DEMANDES + PRESTATIONS Laboratoire / Imagerie (→ Facturation) ────────
    const PR=(typeof MEDICORE_PRESTA!=='undefined')?MEDICORE_PRESTA:null;
    const RES=(typeof MEDICORE_RESULTATS!=='undefined')?MEDICORE_RESULTATS:null;
    if(PR){
      // Labo : KOUASSI (palu) + KONÉ (diabète)
      PR.ajouter({ patientId:this.PATIENTS[0].id, patient_nom:this.PATIENTS[0].nom, module:'laboratoire', libelle:'Goutte épaisse + NFS', code:'B-PAL-01', montant:7500, statut:'à facturer' });
      PR.ajouter({ patientId:this.PATIENTS[0].id, patient_nom:this.PATIENTS[0].nom, module:'laboratoire', libelle:'Ionogramme sanguin', code:'B-BIO-03', montant:8000, statut:'à facturer' });
      PR.ajouter({ patientId:this.PATIENTS[3].id, patient_nom:this.PATIENTS[3].nom, module:'laboratoire', libelle:'Glycémie à jeun + HbA1c', code:'B-BIO-05', montant:12000, statut:'à facturer' });
      // Imagerie : TRAORÉ (bilan pré-op PTH) + BAMBA (radio thorax)
      PR.ajouter({ patientId:this.PATIENTS[1].id, patient_nom:this.PATIENTS[1].nom, module:'imagerie', libelle:'Radiographie bassin face', code:'IMG-RX-12', montant:25000, statut:'à facturer' });
      PR.ajouter({ patientId:this.PATIENTS[4].id, patient_nom:this.PATIENTS[4].nom, module:'imagerie', libelle:'Radiographie thorax', code:'IMG-RX-03', montant:20000, statut:'à facturer' });
      // Consultations
      this.PATIENTS.forEach(pat=>PR.ajouter({ patientId:pat.id, patient_nom:pat.nom, module:'consultation', libelle:'Consultation '+pat.service, montant:10000, statut:'à facturer' }));
    }
    // Résultats labo prêts (→ DPI)
    if(RES){
      RES.ajouter({ patientId:this.PATIENTS[0].id, patient_nom:this.PATIENTS[0].nom, module:'laboratoire', examen:'Goutte épaisse', resultat:'Positif — P. falciparum (+++)', critique:true, date:nowFr });
      RES.ajouter({ patientId:this.PATIENTS[3].id, patient_nom:this.PATIENTS[3].nom, module:'laboratoire', examen:'HbA1c', resultat:'9,2 % (déséquilibré)', critique:false, date:nowFr });
    }

    // ── 4) DEMANDES inter-services (circuit) ────────────────────────────────────
    const DEM=(typeof MEDICORE_DEMANDES!=='undefined')?MEDICORE_DEMANDES:null;
    if(DEM){
      try{
        DEM.creer({ cible:'laboratoire', objet:'Goutte épaisse + NFS', type:'Analyse', patient:{ id:this.PATIENTS[0].id, nom:this.PATIENTS[0].nom }, priorite:'Urgent', details:'Suspicion paludisme grave' });
        DEM.creer({ cible:'imagerie', objet:'Radiographie bassin face', type:'Imagerie', patient:{ id:this.PATIENTS[1].id, nom:this.PATIENTS[1].nom }, priorite:'Normal', details:'Bilan pré-opératoire PTH' });
      }catch(e){}
    }

    // ── 5) BLOC OPÉRATOIRE : intervention programmée pour TRAORÉ (PTH) ───────────
    if(typeof MEDICORE_BLOC!=='undefined'){
      const op=MEDICORE_BLOC.creer({ patient:this.PATIENTS[1].nom, patient_id:this.PATIENTS[1].id,
        acte:'Prothèse totale de hanche (PTH)', chirurgien:'Dr. TOURÉ', salle:'Salle 2', date:today, heure:'09:00',
        duree:120, priorite:'Programmée', asa:MEDICORE_BLOC.ASA[1], anesthesie:'Rachianesthésie', anesthesiste:'Dr. KONÉ',
        obs:'Coxarthrose invalidante. Bilan pré-op OK.' });
      MEDICORE_BLOC.ajouterMembre(op.id,'IBODE','M. DIALLO');
      MEDICORE_BLOC.ajouterMembre(op.id,'Infirmier circulant','Mme BAMBA');
      // Intervention urgente pour la salle 4
      MEDICORE_BLOC.creer({ patient:'YAO Serge', patient_id:'D300099', acte:'Appendicectomie',
        chirurgien:'Dr. SORO', salle:'Salle 4', date:today, heure:'14:30', duree:60, priorite:'Urgence',
        asa:MEDICORE_BLOC.ASA[1], anesthesie:'Anesthésie générale', anesthesiste:'Dr. KONÉ', obs:'Urgence chirurgicale.' });
    }

    // ── 6) Interventions visibles dans le tableau bloc (store 'interventions') ───
    const interv=this._load('interventions').filter(x=>!x._demo);
    interv.push({ _demo:true, id:'OP-DEMO-1', patient:this.PATIENTS[1].nom, patient_id:this.PATIENTS[1].id, acte:'Prothèse totale de hanche (PTH)', chirurgien:'Dr. TOURÉ', salle:'Salle 2', date:today, heure:'09:00', duree:120, type:'Programmée', priorite:'Programmée', anesth:'Rachianesthésie', anesthMed:'Dr. KONÉ', statut:'Programmée', obs:'Coxarthrose. Bilan pré-op OK.', dmi:'PTH cimentée' });
    interv.push({ _demo:true, id:'OP-DEMO-2', patient:'YAO Serge', patient_id:'D300099', acte:'Appendicectomie', chirurgien:'Dr. SORO', salle:'Salle 4', date:today, heure:'14:30', duree:60, type:'Urgence', priorite:'Urgence', anesth:'Anesthésie générale', anesthMed:'Dr. KONÉ', statut:'Programmée', obs:'Urgence.', dmi:'—' });
    this._save('interventions', interv);

    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Données démo inter-modules','CREATION', this.PATIENTS.length+' patients + parcours complets', 'DEMO');
    return { ok:true, patients:this.PATIENTS.length };
  },

  // ── Suppression ciblée des données générées (par marqueur _demo) + stores liés ─
  supprimer(){
    // Patients marqués démo
    const patients=this._load('patients').filter(p=>!(p && p._demo));
    this._save('patients', patients);
    if(typeof window!=='undefined' && Array.isArray(window.patients)){ window.patients.length=0; patients.forEach(x=>window.patients.push(x)); }
    // Interventions marquées démo
    this._save('interventions', this._load('interventions').filter(x=>!(x && x._demo)));
    // Prescriptions démo (id RXDEMO*)
    this._save('prescriptions', this._load('prescriptions').filter(r=>!(r && String(r.id).startsWith('RXDEMO'))));
    // Stores entièrement liés au parcours démo → vidés
    ['prestations','resultats','demandes','bloc_interventions'].forEach(s=>this._save(s, []));
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Suppression données démo','SUPPRESSION','patients + parcours inter-modules','DEMO');
    return { ok:true };
  },
};
if(typeof window!=='undefined') window.MEDICORE_DEMO = MEDICORE_DEMO;
