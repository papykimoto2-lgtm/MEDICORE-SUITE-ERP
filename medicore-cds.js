// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Aide à la consultation (check-list + suggestions de prescription)
// ──────────────────────────────────────────────────────────────────────────────
// Objectif : réduire le temps de consultation.
//   1) Selon les symptômes cochés → check-list d'examens/signes à vérifier.
//   2) Suggestions de médicaments + posologies, PRIORISÉES sur le stock PUI.
//
// ⚠️ Suggestions NON CONTRAIGNANTES — le praticien reste seul juge. Aide à la
//    décision, ne remplace pas le jugement clinique.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_CDS = {

  // ── Symptômes proposables (cochables) ───────────────────────────────────────
  SYMPTOMES: [
    {key:'fievre',        label:'Fièvre'},
    {key:'frissons',      label:'Frissons / sueurs'},
    {key:'cephalees',     label:'Céphalées'},
    {key:'toux',          label:'Toux'},
    {key:'dyspnee',       label:'Dyspnée / essoufflement'},
    {key:'douleur_thorax',label:'Douleur thoracique'},
    {key:'douleur_abdo',  label:'Douleur abdominale'},
    {key:'diarrhee',      label:'Diarrhée'},
    {key:'vomissements',  label:'Vomissements / nausées'},
    {key:'dysurie',       label:'Brûlures mictionnelles'},
    {key:'asthenie',      label:'Asthénie / fatigue'},
    {key:'douleur',       label:'Douleur (générale)'},
    {key:'plaie',         label:'Plaie / traumatisme'},
    {key:'hta_connue',    label:'HTA connue'},
    {key:'diabete_connu', label:'Diabète connu'},
  ],

  // ── Check-list par symptôme (examens / signes / questions) ──────────────────
  CHECKLIST: {
    fievre:        ['Mesurer la température', 'TDR paludisme / goutte épaisse', 'NFS + CRP', 'Rechercher un foyer infectieux', 'Hémocultures si T° > 38,5 °C persistante'],
    frissons:      ['Goutte épaisse (paludisme)', 'Hémocultures si frissons solennels'],
    cephalees:     ['Prendre la TA', 'Rechercher signes méningés (raideur de nuque)', 'Examen neurologique', 'Goutte épaisse si fièvre associée'],
    toux:          ['Auscultation pulmonaire', 'SpO₂', 'Radiographie thoracique si dyspnée/fièvre', 'Rechercher signes de gravité'],
    dyspnee:       ['SpO₂', 'Fréquence respiratoire', 'Auscultation cardio-pulmonaire', 'Radiographie thoracique', 'ECG si douleur thoracique'],
    douleur_thorax:['ECG', 'TA aux deux bras', 'Troponine', 'Auscultation', 'Rechercher signes de gravité'],
    douleur_abdo:  ['Palpation abdominale', 'Rechercher défense / contracture', 'Bandelette urinaire', 'βHCG si femme en âge de procréer', 'Échographie abdominale si gravité'],
    diarrhee:      ['Évaluer la déshydratation', 'Coproculture si glairo-sanglante/fébrile', 'Ionogramme si forme sévère'],
    vomissements:  ['Évaluer la déshydratation', 'Glycémie', 'Ionogramme'],
    dysurie:       ['ECBU', 'Bandelette urinaire', 'Température'],
    asthenie:      ['NFS', 'Glycémie', 'Goutte épaisse', 'TA'],
    douleur:       ['Évaluer l\'intensité (EVA 0–10)', 'Localisation / irradiation', 'Facteurs déclenchants'],
    plaie:         ['Évaluer profondeur et étendue', 'Statut vaccinal antitétanique', 'Parage + antisepsie', 'Rechercher signes d\'infection'],
    hta_connue:    ['TA répétée au repos', 'Vérifier l\'observance du traitement', 'Rechercher un retentissement (rénal, oculaire)'],
    diabete_connu: ['Glycémie capillaire', 'Rechercher une décompensation', 'Examen des pieds'],
  },

  // ── Protocoles indicatifs : symptôme → médicaments suggérés ─────────────────
  // (posologies adultes standard ; à adapter au poids/âge/terrain)
  PROTOCOLES: {
    fievre:        [{med:'Paracétamol 1g', posologie:'1 g × 3/j', voie:'Orale (PO)', duree:'3–5 jours'}],
    douleur:       [{med:'Paracétamol 1g', posologie:'1 g × 3/j', voie:'Orale (PO)', duree:'au besoin'}],
    frissons:      [{med:'Artémether/Luméfantrine 20/120mg', posologie:'4 cp × 2/j', voie:'Orale (PO)', duree:'3 jours'}],
    toux:          [{med:'Amoxicilline 500mg', posologie:'1 g × 3/j', voie:'Orale (PO)', duree:'7 jours'}],
    dyspnee:       [{med:'Salbutamol 100µg', posologie:'2 bouffées × 3/j', voie:'Topique', duree:'au besoin'}],
    douleur_abdo:  [{med:'Métronidazole 500mg', posologie:'500 mg × 3/j', voie:'Orale (PO)', duree:'7 jours'},
                    {med:'Paracétamol 1g', posologie:'1 g × 3/j', voie:'Orale (PO)', duree:'au besoin'}],
    diarrhee:      [{med:'SRO (réhydratation orale)', posologie:'après chaque selle', voie:'Orale (PO)', duree:'jusqu\'à arrêt'},
                    {med:'Métronidazole 500mg', posologie:'500 mg × 3/j', voie:'Orale (PO)', duree:'7 jours'}],
    vomissements:  [{med:'Métoclopramide 10mg', posologie:'10 mg × 3/j', voie:'Orale (PO)', duree:'3 jours'}],
    dysurie:       [{med:'Ciprofloxacine 500mg', posologie:'500 mg × 2/j', voie:'Orale (PO)', duree:'5 jours'},
                    {med:'Ceftriaxone 1g', posologie:'1 g/j', voie:'Intraveineuse (IV)', duree:'si pyélonéphrite'}],
    cephalees:     [{med:'Paracétamol 1g', posologie:'1 g × 3/j', voie:'Orale (PO)', duree:'au besoin'}],
    hta_connue:    [{med:'Amlodipine 5mg', posologie:'5–10 mg/j', voie:'Orale (PO)', duree:'traitement de fond'}],
    diabete_connu: [{med:'Metformine 500mg', posologie:'500–1000 mg × 2/j', voie:'Orale (PO)', duree:'traitement de fond'}],
    plaie:         [{med:'Amoxicilline 500mg', posologie:'1 g × 3/j', voie:'Orale (PO)', duree:'7 jours'}],
  },

  // ── Stock PUI ────────────────────────────────────────────────────────────────
  stock(){
    let arr=[];
    if(typeof MEDICORE_STORE!=='undefined') arr = MEDICORE_STORE.load('stock', []);
    if(!arr || !arr.length){
      try{ const p=JSON.parse(localStorage.getItem('medicore_stock')||'[]'); arr=Array.isArray(p)?p:(p.d||[]); }catch(e){ arr=[]; }
    }
    return arr;
  },
  _tok(s){ return (s||'').toLowerCase().split(/[\s/0-9µ%.,()-]+/).filter(w=>w.length>3); },
  // Cherche le produit PUI correspondant à un médicament suggéré
  enStock(med){
    const toks=this._tok(med);
    if(!toks.length) return {ok:false};
    const prod=this.stock().find(p=>{
      const dci=(p.dci||p.nom||'').toLowerCase();
      return toks.some(t=>dci.includes(t));
    });
    if(prod && (prod.stock>0)) return {ok:true, qty:prod.stock, dci:prod.dci||prod.nom, code:prod.code};
    if(prod) return {ok:false, qty:0, dci:prod.dci||prod.nom, rupture:true};
    return {ok:false};
  },

  // ── Synthèse pour un ensemble de symptômes ──────────────────────────────────
  checklistPour(keys){
    const out=[]; const seen=new Set();
    keys.forEach(k=>(this.CHECKLIST[k]||[]).forEach(item=>{ if(!seen.has(item)){ seen.add(item); out.push(item); } }));
    return out;
  },
  medsPour(keys){
    const map=new Map();
    keys.forEach(k=>(this.PROTOCOLES[k]||[]).forEach(m=>{ if(!map.has(m.med)) map.set(m.med, Object.assign({}, m)); }));
    const list=Array.from(map.values()).map(m=>{ const s=this.enStock(m.med); return Object.assign(m, {stock:s}); });
    // Priorité : en stock d'abord
    list.sort((a,b)=> (b.stock.ok?1:0) - (a.stock.ok?1:0));
    return list;
  },
};

if(typeof window!=='undefined') window.MEDICORE_CDS = MEDICORE_CDS;
