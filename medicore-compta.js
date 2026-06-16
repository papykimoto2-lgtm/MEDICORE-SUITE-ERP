// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Moteur de comptabilisation SYSCOHADA (écritures automatiques)
// ──────────────────────────────────────────────────────────────────────────────
// Point central : chaque événement métier (facturation, encaissement, achat,
// sortie de stock, paie…) appelle ce moteur, qui génère une écriture comptable
// ÉQUILIBRÉE (Débit = Crédit), conforme au plan SYSCOHADA Révisé, avec :
//   • ventilation analytique par centre de coût (service hospitalier)
//   • comptes de tiers auxiliaires (411xxx patient, 401xxx fournisseur…)
//   • contrôle interne (créateur, date/heure, pas de suppression directe)
// Les écritures sont écrites dans le store 'ecritures' (lu par la compta générale).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_COMPTA = {
  S:'ecritures', S_TIERS:'comptes_tiers',

  // ── Plan comptable SYSCOHADA — comptes utilisés par l'ERP santé ──────────────
  COMPTES:{
    // Classe 1 — Capitaux
    '101':'Capital social', '120':'Résultat de l\'exercice', '160':'Emprunts',
    // Classe 2 — Immobilisations
    '215':'Matériel médical', '218':'Matériel & mobilier', '244':'Matériel de bureau',
    '281':'Amortissements immobilisations',
    // Classe 3 — Stocks
    '311':'Stock médicaments', '312':'Stock consommables médicaux', '321':'Stock réactifs labo',
    // Classe 4 — Tiers
    '401':'Fournisseurs', '411':'Clients / Patients', '421':'Personnel — rémunérations dues',
    '431':'Sécurité sociale (CNPS)', '441':'État — impôts (ITS)', '443':'État — TVA facturée',
    '445':'État — TVA récupérable', '447':'Assurances & mutuelles',
    // Classe 5 — Trésorerie
    '521':'Banque', '531':'Caisse', '585':'Virements internes',
    // Classe 6 — Charges
    '601':'Achats de médicaments', '602':'Achats de consommables', '603':'Variation de stocks',
    '604':'Achats réactifs', '605':'Eau & électricité', '622':'Locations', '627':'Services bancaires',
    '641':'Salaires & traitements', '645':'Charges sociales', '658':'Prise en charge sociale (service social)', '681':'Dotations aux amortissements',
    // Classe 7 — Produits
    '701':'Ventes de médicaments', '706':'Prestations médicales', '707':'Ventes accessoires',
    '758':'Produits divers',
  },

  // ── Journaux ──────────────────────────────────────────────────────────────────
  JOURNAUX:{ VT:'Ventes', AC:'Achats', BQ:'Banque', CA:'Caisse', OD:'Opérations diverses',
             PA:'Paie', IM:'Immobilisations' },

  // ── Centres analytiques (services hospitaliers) ──────────────────────────────
  CENTRES:{ urgences:'Urgences', bloc_operatoire:'Bloc opératoire', imagerie:'Imagerie',
            laboratoire:'Laboratoire', pharmacie_pui:'Pharmacie', hospitalisation:'Hospitalisation',
            consultation:'Consultations externes', maternite:'Maternité', administration:'Administration',
            service_social:'Service social' },

  TVA_TAUX:0.18,
  S_EXERCICES:'exercices_comptables',
  ANTERIORITE_ANALYTIQUE:5,   // nombre d'années d'historique analytique conservées/comparées

  // ── Exercices comptables ─────────────────────────────────────────────────────
  // Un exercice = une année civile (SYSCOHADA). Statuts : Ouvert / Clôturé.
  exercices(){
    let list=[];
    if(typeof MEDICORE_STORE!=='undefined') list=MEDICORE_STORE.load(this.S_EXERCICES,[]);
    else { try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.S_EXERCICES)||'[]'); list=Array.isArray(p)?p:(p.d||[]); }catch(e){ list=[]; } }
    if(!list.length){ const an=new Date().getFullYear();
      list=[{ annee:an, statut:'Ouvert', ouvert_le:new Date().toISOString(), courant:true }]; }
    // Complète avec les exercices ayant des écritures (antériorité)
    const anneesEcr=new Set(this._read().map(e=>this.exerciceDe(e.date)));
    let modifie=false;
    anneesEcr.forEach(an=>{ if(!list.some(x=>x.annee===an)){ list.push({ annee:an, statut:'Ouvert', ouvert_le:null, auto:true }); modifie=true; } });
    if(modifie || !MEDICORE_STORE.load(this.S_EXERCICES,[]).length) this._saveExercices(list);
    return list.sort((a,b)=>b.annee-a.annee);
  },
  _saveExercices(list){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.S_EXERCICES,list,true);
    else localStorage.setItem('medicore_'+this.S_EXERCICES,JSON.stringify({_v:1,_ts:Date.now(),d:list})); },
  exerciceCourant(){ const e=this.exercices().find(x=>x.courant); return e?e.annee:new Date().getFullYear(); },
  exerciceDe(date){ return new Date(date||Date.now()).getFullYear(); },
  estCloture(annee){ const e=this.exercices().find(x=>x.annee===+annee); return e?e.statut==='Clôturé':false; },

  // Ouvre un nouvel exercice et le rend courant (report automatique des soldes de bilan)
  ouvrirExercice(annee){
    annee=+annee||(this.exerciceCourant()+1);
    const list=this.exercices();
    if(list.some(x=>x.annee===annee)) return { erreur:'exercice existe déjà' };
    list.forEach(x=>x.courant=false);
    list.push({ annee, statut:'Ouvert', ouvert_le:new Date().toISOString(), courant:true });
    this._saveExercices(list);
    // Report des soldes des comptes de bilan (classes 1 à 5) en à-nouveaux
    this._reportANouveaux(annee);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Ouverture exercice','CREATION','Exercice '+annee, String(annee));
    return { ok:true, annee };
  },
  // Clôture un exercice (plus d'écritures possibles dessus)
  cloturerExercice(annee){
    annee=+annee||this.exerciceCourant();
    const list=this.exercices(); const e=list.find(x=>x.annee===annee);
    if(!e) return { erreur:'exercice introuvable' };
    e.statut='Clôturé'; e.cloture_le=new Date().toISOString(); e.cloture_par=this._user().nom||'';
    this._saveExercices(list);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Clôture exercice','VALIDATION','Exercice '+annee, String(annee));
    return { ok:true, annee };
  },
  // Réouverture contrôlée d'un exercice clôturé
  rouvrirExercice(annee){
    const list=this.exercices(); const e=list.find(x=>x.annee===+annee);
    if(!e) return { erreur:'introuvable' };
    e.statut='Ouvert'; e.reouvert_le=new Date().toISOString(); e.reouvert_par=this._user().nom||'';
    this._saveExercices(list);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Réouverture exercice','MODIFICATION','Exercice '+annee, String(annee));
    return { ok:true };
  },
  definirCourant(annee){ const list=this.exercices(); list.forEach(x=>x.courant=(x.annee===+annee)); this._saveExercices(list); return { ok:true }; },

  // Report automatique des à-nouveaux : solde des comptes 1-5 repris sur le nouvel exercice
  _reportANouveaux(anneeNew){
    const anneePrec=anneeNew-1;
    const soldes={};
    this._read().filter(e=>this.exerciceDe(e.date)===anneePrec).forEach(e=>{
      const cl=e.compte[0];
      if(['1','2','3','4','5'].includes(cl)){ soldes[e.compte]=(soldes[e.compte]||0)+(e.debit||0)-(e.credit||0); }
    });
    const lignes=[];
    Object.keys(soldes).forEach(c=>{ const s=soldes[c]; if(Math.abs(s)<0.01) return;
      lignes.push({ compte:c, debit:s>0?s:0, credit:s<0?-s:0, libelle:'À-nouveau '+anneeNew }); });
    if(lignes.length){
      // Équilibrage par le compte de résultat reporté si nécessaire
      const d=lignes.reduce((s,l)=>s+l.debit,0), cr=lignes.reduce((s,l)=>s+l.credit,0);
      if(Math.abs(d-cr)>0.01){ const ecart=d-cr;
        lignes.push({ compte:'120', debit:ecart<0?-ecart:0, credit:ecart>0?ecart:0, libelle:'Report à nouveau résultat' }); }
      this.ecrire({ journal:'OD', date:anneeNew+'-01-01', libelle:'Report des à-nouveaux '+anneeNew, lignes, source:'cloture' });
    }
  },

  _read(){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(this.S,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.S)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.S,rows,true);
    else localStorage.setItem('medicore_'+this.S,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _tiers(){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(this.S_TIERS,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.S_TIERS)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _saveTiers(rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.S_TIERS,rows,true);
    else localStorage.setItem('medicore_'+this.S_TIERS,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },
  _piece(jrn){ const an=new Date().getFullYear(); const n=this._read().filter(e=>e.piece&&e.piece.startsWith(jrn+'-'+an)).length+1;
    return jrn+'-'+an+'-'+String(n).padStart(5,'0'); },

  // ── Comptes de tiers auxiliaires (411 patient, 401 fournisseur…) ─────────────
  // Crée/retrouve un compte auxiliaire unique pour un tiers donné.
  compteTiers(type, ref, nom){
    const racine = type==='fournisseur'?'401': type==='personnel'?'421': type==='assurance'?'447':'411';
    const list=this._tiers();
    let t=list.find(x=>x.type===type && x.ref===ref);
    if(!t){
      const seq=list.filter(x=>x.compte.startsWith(racine)).length+1;
      t={ type, ref:ref||('AUTO'+seq), nom:nom||ref||'Tiers', compte:racine+String(seq).padStart(6,'0'), cree_le:new Date().toISOString() };
      list.push(t); this._saveTiers(list);
    } else if(nom && t.nom!==nom){ t.nom=nom; this._saveTiers(list); }
    return t;
  },
  tiers(){ return this._tiers(); },
  // État de compte d'un tiers (toutes ses écritures)
  etatTiers(compteAux){
    return this._read().filter(e=>e.compte_aux===compteAux || e.compte===compteAux)
      .sort((a,b)=>new Date(a.date)-new Date(b.date));
  },
  soldeTiers(compteAux){ const e=this.etatTiers(compteAux);
    return e.reduce((s,x)=>s+(x.debit||0)-(x.credit||0),0); },

  // ── Écriture générique équilibrée ─────────────────────────────────────────────
  // lignes = [{ compte, libelle, debit, credit, compte_aux?, tiers_nom?, centre? }]
  ecrire({ journal, date, libelle, lignes, centre, source, ref }){
    const totD=lignes.reduce((s,l)=>s+(+l.debit||0),0);
    const totC=lignes.reduce((s,l)=>s+(+l.credit||0),0);
    if(Math.abs(totD-totC)>0.01) return { erreur:'desequilibre', debit:totD, credit:totC };
    const d=date||new Date().toISOString().slice(0,10);
    const exercice=this.exerciceDe(d);
    // Blocage : pas d'écriture sur un exercice clôturé (sauf report d'à-nouveaux)
    if(source!=='cloture' && this.estCloture(exercice)) return { erreur:'exercice_cloture', exercice };
    const piece=this._piece(journal||'OD');
    const u=this._user().nom||'Système';
    const rows=this._read();
    lignes.forEach((l,i)=>{
      rows.push({ id:piece+'-'+(i+1), piece, journal:journal||'OD', date:d, exercice,
        compte:l.compte, intitule:this.COMPTES[l.compte]||l.libelle||'', libelle:l.libelle||libelle||'',
        debit:+l.debit||0, credit:+l.credit||0,
        compte_aux:l.compte_aux||'', tiers_nom:l.tiers_nom||'',
        centre:l.centre||centre||'', source:source||'', ref:ref||'',
        cree_par:u, cree_le:new Date().toISOString(), valide:false, lettrage:'' });
    });
    this._write(rows);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Écriture comptable auto','CREATION',`${piece} — ${libelle} — ${totD.toLocaleString('fr-FR')} F`, piece);
    return { ok:true, piece, exercice, debit:totD, credit:totC };
  },

  // ══ ÉCRITURES AUTOMATIQUES PAR ÉVÉNEMENT MÉTIER ══════════════════════════════

  // Facturation patient : 411 Client (D) → 706 Prestations (C) [+ 443 TVA si applicable]
  facturationPatient({ patientId, patient_nom, montant, centre, ref, tva, date }){
    const t=this.compteTiers('patient', patientId, patient_nom);
    const ht = tva ? Math.round(montant/(1+this.TVA_TAUX)) : montant;
    const mtva = tva ? montant-ht : 0;
    const lignes=[{ compte:'411', compte_aux:t.compte, tiers_nom:patient_nom, debit:montant, credit:0, libelle:'Facture '+(patient_nom||'') }];
    lignes.push({ compte:'706', debit:0, credit:ht, centre, libelle:'Prestation '+(this.CENTRES[centre]||centre||'') });
    if(mtva>0) lignes.push({ compte:'443', debit:0, credit:mtva, libelle:'TVA collectée' });
    return this.ecrire({ journal:'VT', date, libelle:'Facturation '+(patient_nom||''), lignes, centre, source:'facturation', ref });
  },

  // Encaissement : 531/521 (D) → 411 Client (C)
  encaissement({ patientId, patient_nom, montant, mode, centre, ref }){
    const t=this.compteTiers('patient', patientId, patient_nom);
    const cpt = (mode==='Espèces'||mode==='espece')?'531':'521';
    return this.ecrire({ journal: cpt==='531'?'CA':'BQ', libelle:'Règlement '+(patient_nom||''), centre,
      lignes:[ { compte:cpt, debit:montant, credit:0, libelle:'Encaissement '+(mode||'') },
               { compte:'411', compte_aux:t.compte, tiers_nom:patient_nom, debit:0, credit:montant, libelle:'Règlement '+(patient_nom||'') } ],
      source:'caisse', ref });
  },

  // Achat (médicament/consommable) : 601/602 (D) [+ 445 TVA] → 401 Fournisseur (C)
  achatFournisseur({ fournisseurRef, fournisseur_nom, montant, compteCharge, tva, ref, centre, date }){
    const t=this.compteTiers('fournisseur', fournisseurRef, fournisseur_nom);
    const ht = tva ? Math.round(montant/(1+this.TVA_TAUX)) : montant;
    const mtva = tva ? montant-ht : 0;
    const lignes=[{ compte:compteCharge||'601', debit:ht, credit:0, centre, libelle:'Achat '+(fournisseur_nom||'') }];
    if(mtva>0) lignes.push({ compte:'445', debit:mtva, credit:0, libelle:'TVA récupérable' });
    lignes.push({ compte:'401', compte_aux:t.compte, tiers_nom:fournisseur_nom, debit:0, credit:montant, libelle:'Fournisseur '+(fournisseur_nom||'') });
    return this.ecrire({ journal:'AC', date, libelle:'Achat '+(fournisseur_nom||''), lignes, source:'achats', ref });
  },

  // Sortie de stock (consommation pharmacie) : 603 Variation (D) → 311/312 Stock (C)
  sortieStock({ montant, compteStock, centre, ref, libelle }){
    return this.ecrire({ journal:'OD', libelle:libelle||'Sortie de stock', centre,
      lignes:[ { compte:'603', debit:montant, credit:0, centre, libelle:'Consommation '+(this.CENTRES[centre]||centre||'') },
               { compte:compteStock||'311', debit:0, credit:montant, libelle:'Variation de stock' } ],
      source:'pharmacie', ref });
  },

  // Paie : 641 Salaires (D) → 421 Net à payer (C) + 431 CNPS (C) + 441 ITS (C)
  paie({ brut, cnps, its, ref }){
    const net = brut - (cnps||0) - (its||0);
    return this.ecrire({ journal:'PA', libelle:'Paie du mois', centre:'administration',
      lignes:[ { compte:'641', debit:brut, credit:0, libelle:'Salaires bruts' },
               { compte:'421', debit:0, credit:net, libelle:'Net à payer' },
               { compte:'431', debit:0, credit:cnps||0, libelle:'CNPS' },
               { compte:'441', debit:0, credit:its||0, libelle:'ITS' } ],
      source:'paie', ref });
  },

  // Prise en charge par le service social : reconnaît la prestation pour la part
  // concernée (411 D / 706 C), puis annule cette même créance car le coût est
  // absorbé par l'établissement (658 Charge D / 411 C). Le compte du patient
  // revient ainsi exactement à 0 sur cette part — méthode autonome et équilibrée.
  priseEnChargeSociale({ patientId, patient_nom, montant, motif, responsable, ref, date, centreSoin }){
    if(!montant || montant<=0) return { ok:true, montant:0 };
    const t=this.compteTiers('patient', patientId, patient_nom);
    // 1) Reconnaissance de la prestation pour la part concernée
    this.facturationPatient({ patientId, patient_nom, montant, centre:centreSoin||'hospitalisation', ref, date });
    // 2) Écriture de prise en charge : la créance correspondante est annulée
    return this.ecrire({ journal:'OD', date, libelle:`Prise en charge sociale — ${motif||'—'} — ${patient_nom||''}`,
      centre:'service_social',
      lignes:[ { compte:'658', debit:montant, credit:0, centre:'service_social', libelle:'Prise en charge sociale — '+(patient_nom||'') },
               { compte:'411', compte_aux:t.compte, tiers_nom:patient_nom, debit:0, credit:montant, libelle:'Solde pris en charge — service social ('+(responsable||'')+')' } ],
      source:'service_social', ref });
  },

  // Amortissement : 681 Dotation (D) → 281 Amortissements (C)
  amortissement({ montant, libelle, ref }){
    return this.ecrire({ journal:'OD', libelle:libelle||'Dotation amortissement',
      lignes:[ { compte:'681', debit:montant, credit:0, libelle:libelle||'Dotation' },
               { compte:'281', debit:0, credit:montant, libelle:'Amortissements cumulés' } ],
      source:'immobilisations', ref });
  },

  // ── Analytique par centre sur une période arbitraire (pour tableaux de bord) ─
  analytiqueParCentrePeriode(dateDebut, dateFin){
    const res={}; Object.keys(this.CENTRES).forEach(c=>res[c]={ produits:0, charges:0 });
    const d0=dateDebut?new Date(dateDebut):null, d1=dateFin?new Date(dateFin):null;
    this._read().forEach(e=>{ if(!e.centre||!res[e.centre]) return;
      const d=new Date(e.date); if(d0&&d<d0) return; if(d1&&d>d1) return;
      if(e.compte.startsWith('7')) res[e.centre].produits+=(e.credit-e.debit);
      if(e.compte.startsWith('6')) res[e.centre].charges+=(e.debit-e.credit);
    });
    return Object.keys(res).map(c=>({ centre:c, label:this.CENTRES[c], produits:res[c].produits,
      charges:res[c].charges, resultat:res[c].produits-res[c].charges }));
  },
  // Totaux produits/charges sur une période, TOUS comptes (centre tagué ou non) — total fiable
  totauxPeriode(dateDebut, dateFin){
    const d0=dateDebut?new Date(dateDebut):null, d1=dateFin?new Date(dateFin):null;
    let produits=0, charges=0;
    this._read().forEach(e=>{ const d=new Date(e.date); if(d0&&d<d0) return; if(d1&&d>d1) return;
      if(e.compte.startsWith('7')) produits+=(e.credit-e.debit);
      if(e.compte.startsWith('6')) charges+=(e.debit-e.credit);
    });
    return { produits, charges };
  },
  // Position de trésorerie réelle (solde caisse + banque, tous exercices confondus)
  positionTresorerie(){
    return this.balance().filter(b=>['531','521','585'].includes(b.compte)).reduce((s,b)=>s+b.solde,0);
  },

  // ── Comptabilité analytique : résultat par centre de coût (pour un exercice) ─
  analytiqueParCentre(annee){
    annee = annee || this.exerciceCourant();
    const res={}; Object.keys(this.CENTRES).forEach(c=>res[c]={ produits:0, charges:0 });
    this._read().forEach(e=>{ if(!e.centre||!res[e.centre]) return;
      if(this.exerciceDe(e.date)!==+annee) return;
      if(e.compte.startsWith('7')) res[e.centre].produits+=(e.credit-e.debit);
      if(e.compte.startsWith('6')) res[e.centre].charges+=(e.debit-e.credit);
    });
    return Object.keys(res).map(c=>({ centre:c, label:this.CENTRES[c], produits:res[c].produits,
      charges:res[c].charges, resultat:res[c].produits-res[c].charges }));
  },

  // ── Antériorité analytique sur N années (par défaut 5) ───────────────────────
  // Renvoie, pour chaque centre, l'évolution du résultat sur les 5 derniers exercices.
  analytiqueHistorique(nbAnnees){
    nbAnnees = nbAnnees || this.ANTERIORITE_ANALYTIQUE;
    const anneeFin=this.exerciceCourant();
    const annees=[]; for(let i=nbAnnees-1;i>=0;i--) annees.push(anneeFin-i);
    const parCentre={}; Object.keys(this.CENTRES).forEach(c=>parCentre[c]={ label:this.CENTRES[c], annees:{} });
    annees.forEach(an=>{ this.analytiqueParCentre(an).forEach(row=>{
      parCentre[row.centre].annees[an]={ produits:row.produits, charges:row.charges, resultat:row.resultat };
    }); });
    return { annees, centres:Object.keys(parCentre).map(c=>Object.assign({ centre:c }, parCentre[c])) };
  },

  // Comparatif global (tous centres) sur 5 ans : produits / charges / résultat par an
  syntheseHistorique(nbAnnees){
    nbAnnees = nbAnnees || this.ANTERIORITE_ANALYTIQUE;
    const anneeFin=this.exerciceCourant();
    const out=[];
    for(let i=nbAnnees-1;i>=0;i--){ const an=anneeFin-i;
      let prod=0, charg=0;
      this._read().forEach(e=>{ if(this.exerciceDe(e.date)!==an) return;
        if(e.compte.startsWith('7')) prod+=(e.credit-e.debit);
        if(e.compte.startsWith('6')) charg+=(e.debit-e.credit); });
      out.push({ annee:an, produits:prod, charges:charg, resultat:prod-charg, exercice:this.exercices().find(x=>x.annee===an)||null });
    }
    return out;
  },

  // ── Balance générale (filtrable par exercice) ────────────────────────────────
  balance(annee){
    const m={}; this._read().forEach(e=>{ if(annee && this.exerciceDe(e.date)!==+annee) return;
      if(!m[e.compte]) m[e.compte]={ compte:e.compte, intitule:this.COMPTES[e.compte]||e.intitule||'', debit:0, credit:0 };
      m[e.compte].debit+=e.debit||0; m[e.compte].credit+=e.credit||0; });
    return Object.values(m).map(x=>Object.assign(x,{ solde:x.debit-x.credit })).sort((a,b)=>a.compte.localeCompare(b.compte));
  },
  // Balance par compte sur une période arbitraire de dates (pour tableaux de bord analytiques)
  balancePeriode(dateDebut, dateFin, centre){
    const d0=dateDebut?new Date(dateDebut):null, d1=dateFin?new Date(dateFin):null;
    const m={}; this._read().forEach(e=>{
      const d=new Date(e.date); if(d0&&d<d0) return; if(d1&&d>d1) return;
      if(centre && e.centre!==centre) return;
      if(!m[e.compte]) m[e.compte]={ compte:e.compte, intitule:this.COMPTES[e.compte]||e.intitule||'', debit:0, credit:0 };
      m[e.compte].debit+=e.debit||0; m[e.compte].credit+=e.credit||0; });
    return Object.values(m).map(x=>Object.assign(x,{ solde:x.debit-x.credit })).sort((a,b)=>a.compte.localeCompare(b.compte));
  },
};
if(typeof window!=='undefined') window.MEDICORE_COMPTA = MEDICORE_COMPTA;
