// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Moteur Imagerie (RIS) — modules de sécurité & traçabilité
// ──────────────────────────────────────────────────────────────────────────────
//  • Alertes de contre-indications (grossesse, allergie produit de contraste,
//    insuffisance rénale) selon le type d'examen
//  • Détection de doublon (examen identique récent)
//  • Traçabilité du produit de contraste (produit, volume, lot, péremption,
//    opérateur, réactions indésirables) → archivable DPI
//  • Suivi de dose d'irradiation (dose par examen + cumul annuel + alerte seuil)
//  • Workflow horodaté RIS (prescription → validation → RDV → accueil →
//    préparation → examen → interprétation → CR validé → DPI → facturation)
//  Données rattachées à chaque demande d'examen (store 'demandes_img').
//  NB : PACS/DICOM, HL7/FHIR et dictée vocale relèvent d'une intégration externe.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_IMAGERIE = {
  S_DOSE:'img_doses',   // historique des doses par patient

  // ── Modalités irradiantes et doses de référence (mGy, valeurs indicatives) ───
  IRRADIANT:{ 'Radiographie':0.1, 'Radiologie':0.1, 'Scanner':7, 'TDM':7, 'Mammographie':0.4,
              'Scopie':5, 'Amplificateur':2 },
  NON_IRRADIANT:['Échographie','IRM','Echo','Doppler'],
  SEUIL_DOSE_ANNUELLE:20,   // mSv/an (référence публique ; alerte si dépassé)

  // ── Produits de contraste courants ───────────────────────────────────────────
  CONTRASTES:['Iode — Iopamidol','Iode — Iohexol','Iode — Ioméprol','Gadolinium — Gadotérate',
              'Gadolinium — Gadobutrol','Baryte (sulfate)','Aucun'],
  EXAMENS_CONTRASTE:['Scanner injecté','TDM injecté','IRM injectée','Uro-scanner','Angio',
                     'Entéro','Lavement baryté','Urographie'],

  // ── Contre-indications par nature d'examen ───────────────────────────────────
  // Renvoie la liste des alertes à lever selon l'examen + le contexte patient.
  contreIndications(examen, ctx){
    ctx=ctx||{}; const ex=(examen||'').toLowerCase(); const alertes=[];
    const irradiant=Object.keys(this.IRRADIANT).some(k=>ex.includes(k.toLowerCase()))
      || ['radio','scanner','tdm','mammo','scopie','panoramique'].some(k=>ex.includes(k));
    const avecContraste=this.EXAMENS_CONTRASTE.some(k=>ex.includes(k.toLowerCase()))
      || ex.includes('inject')||ex.includes('contraste')||ex.includes('angio');
    // Grossesse + examen irradiant
    if(ctx.grossesse && irradiant) alertes.push({ niveau:'critique', msg:'⚠ GROSSESSE + examen irradiant — justifier, protéger ou différer.' });
    // Allergie produit de contraste
    if(ctx.allergie_contraste && avecContraste) alertes.push({ niveau:'critique', msg:'⚠ ALLERGIE au produit de contraste déclarée — prémédication / alternative requise.' });
    // Insuffisance rénale + contraste iodé/gadolinium
    if(ctx.insuffisance_renale && avecContraste) alertes.push({ niveau:'critique', msg:'⚠ INSUFFISANCE RÉNALE + injection — risque (NPCI / FSN). Vérifier DFG.' });
    // Métal/pacemaker + IRM
    if((ctx.pacemaker||ctx.implant_metallique) && ex.includes('irm')) alertes.push({ niveau:'critique', msg:'⚠ IRM + dispositif métallique / pacemaker — contre-indication possible.' });
    return alertes;
  },

  // ── Détection de doublon (examen identique récent) ───────────────────────────
  // examensRecents = [{examen, date}] du patient
  doublon(examen, examensRecents, joursFenetre){
    joursFenetre=joursFenetre||30;
    const lim=Date.now()-joursFenetre*86400000;
    const norm=s=>(s||'').toLowerCase().replace(/[^a-zà-ÿ0-9]+/g,'');
    const cible=norm(examen);
    return (examensRecents||[]).find(e=>norm(e.examen)===cible && new Date(e.date).getTime()>lim) || null;
  },

  // ── Traçabilité produit de contraste (attachée à une demande) ────────────────
  estIrradiant(examen){ const ex=(examen||'').toLowerCase();
    return Object.keys(this.IRRADIANT).some(k=>ex.includes(k.toLowerCase()))
      || ['radio','scanner','tdm','mammo','scopie','panoramique'].some(k=>ex.includes(k)); },
  doseReference(examen){ const ex=(examen||'').toLowerCase();
    for(const k in this.IRRADIANT){ if(ex.includes(k.toLowerCase())) return this.IRRADIANT[k]; }
    return this.estIrradiant(examen)?0.1:0; },

  // Enregistre une dose dans l'historique patient (store img_doses)
  enregistrerDose(patientId, patient_nom, examen, dose_mGy, par){
    if(typeof MEDICORE_STORE==='undefined') return;
    const list=MEDICORE_STORE.load(this.S_DOSE,[]);
    list.unshift({ id:'DOSE'+Date.now().toString(36), patientId, patient:patient_nom, examen,
      dose:+dose_mGy||0, date:new Date().toISOString(), par:par||'' });
    MEDICORE_STORE.save(this.S_DOSE, list, true);
  },
  // Cumul de dose de l'année en cours pour un patient (conversion mGy→mSv ≈ ×1 simplifiée)
  cumulAnnuel(patientId){
    if(typeof MEDICORE_STORE==='undefined') return 0;
    const an=new Date().getFullYear();
    return MEDICORE_STORE.load(this.S_DOSE,[]).filter(d=>d.patientId===patientId && new Date(d.date).getFullYear()===an)
      .reduce((s,d)=>s+(d.dose||0),0);
  },
  alerteDose(patientId, doseAjout){
    const cumul=this.cumulAnnuel(patientId)+(+doseAjout||0);
    return cumul>this.SEUIL_DOSE_ANNUELLE ? { depasse:true, cumul, seuil:this.SEUIL_DOSE_ANNUELLE } : { depasse:false, cumul };
  },
  historiquePatient(patientId){
    if(typeof MEDICORE_STORE==='undefined') return [];
    return MEDICORE_STORE.load(this.S_DOSE,[]).filter(d=>d.patientId===patientId);
  },

  // ── Workflow horodaté RIS ────────────────────────────────────────────────────
  ETAPES_RIS:[
    { key:'prescription', label:'Prescription' },
    { key:'validation',   label:'Validation' },
    { key:'rdv',          label:'Rendez-vous' },
    { key:'accueil',      label:'Accueil patient' },
    { key:'preparation',  label:'Préparation' },
    { key:'examen',       label:'Examen réalisé' },
    { key:'interpretation',label:'Interprétation' },
    { key:'cr_valide',    label:'CR validé' },
    { key:'dpi',          label:'Transmis au DPI' },
    { key:'facturation',  label:'Facturation' },
  ],
};
if(typeof window!=='undefined') window.MEDICORE_IMAGERIE = MEDICORE_IMAGERIE;
