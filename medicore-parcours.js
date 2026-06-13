// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Moteur de parcours patient (workflow médical)
// ──────────────────────────────────────────────────────────────────────────────
// Pilote le patient le long du circuit de soins, sans navigation manuelle :
//   Accueil → Consultation → Prescription → Laboratoire → Imagerie → Pharmacie → Facturation
// L'état est DÉDUIT des données réelles (RX, prestations, demandes) → robuste,
// pas besoin d'instrumenter chaque clic. Fournit toujours « l'étape suivante ».
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_PARCOURS = {
  ETAPES: [
    { key:'accueil',     label:'Accueil',      icon:'🏥', module:'dpi' },
    { key:'consultation',label:'Consultation', icon:'🩺', module:'dpi' },
    { key:'prescription',label:'Prescription', icon:'💊', module:'dpi' },
    { key:'laboratoire', label:'Laboratoire',  icon:'🔬', module:'laboratoire', optionnel:true },
    { key:'imagerie',    label:'Imagerie',     icon:'🩻', module:'imagerie', optionnel:true },
    { key:'pharmacie',   label:'Pharmacie',    icon:'💉', module:'pharmacie_pui' },
    { key:'facturation', label:'Facturation',  icon:'🧾', module:'facturation' },
  ],

  _rx(id){ return (typeof MEDICORE_RX!=='undefined')?MEDICORE_RX.pourPatient(id):[]; },
  _prest(id){ return (typeof MEDICORE_PRESTA!=='undefined')?MEDICORE_PRESTA.pourPatient(id):[]; },
  _dem(id){ try{ return (typeof MEDICORE_DEMANDES!=='undefined')?MEDICORE_DEMANDES.all().filter(d=>d.patient&&d.patient.id===id):[]; }catch(e){ return []; } },

  // ── État du patient (faits déduits) ─────────────────────────────────────────
  faits(id){
    const rx=this._rx(id), prest=this._prest(id), dem=this._dem(id);
    return {
      presc:      rx.length>0,
      rxAttente:  rx.some(r=>r.statut==='En attente validation'),
      rxValide:   rx.some(r=>r.statut==='Validée'),
      servi:      rx.some(r=>r.statut==='Délivrée'),
      labo:       prest.some(p=>p.module==='laboratoire') || dem.some(d=>d.module_cible==='laboratoire'),
      imagerie:   prest.some(p=>p.module==='imagerie')    || dem.some(d=>d.module_cible==='imagerie'),
      prestDu:    prest.some(p=>p.statut==='à facturer'),
      prestSolde: prest.length>0 && prest.every(p=>p.statut!=='à facturer'),
      aDesPrest:  prest.length>0,
    };
  },

  // ── Statut de chaque étape ──────────────────────────────────────────────────
  statut(id){
    const f=this.faits(id);
    const consultation = f.presc || f.labo || f.imagerie || f.aDesPrest;
    const etat={
      accueil:     'fait',
      consultation: consultation?'fait':'encours',
      prescription: f.presc?'fait':(consultation?'afaire':'attente'),
      laboratoire:  f.labo?'fait':'optionnel',
      imagerie:     f.imagerie?'fait':'optionnel',
      pharmacie:    f.servi?'fait':(f.rxValide?'encours':(f.presc?'afaire':'optionnel')),
      facturation:  f.prestSolde?'fait':(f.prestDu?'encours':'afaire'),
    };
    return this.ETAPES.map(e=>Object.assign({}, e, { etat:etat[e.key] }));
  },

  // ── Étape suivante recommandée ──────────────────────────────────────────────
  prochaine(id){
    const f=this.faits(id);
    const url=(mod)=>mod+'.html?patient='+encodeURIComponent(id);
    let key,label,module,hint;
    if(!(f.presc||f.labo||f.imagerie||f.aDesPrest)){ key='consultation'; module='dpi'; label='Consultation'; hint='Examiner le patient, saisir constantes'; }
    else if(f.rxAttente){ key='prescription'; module='dpi'; label='Valider la prescription'; hint='Prescription en attente de validation'; }
    else if(f.rxValide && !f.servi){ key='pharmacie'; module='pharmacie_pui'; label='Pharmacie — dispenser'; hint='Ordonnance validée à servir'; }
    else if(f.prestDu){ key='facturation'; module='facturation'; label='Facturation — régler'; hint='Prestations à encaisser'; }
    else if(f.presc && !f.servi){ key='pharmacie'; module='pharmacie_pui'; label='Pharmacie'; hint='Ordonnance à traiter'; }
    else if(!f.prestSolde && f.aDesPrest){ key='facturation'; module='facturation'; label='Facturation'; hint='Clôturer la facturation'; }
    else { key='termine'; module='dpi'; label='Parcours terminé'; hint='Toutes les étapes sont complètes'; }
    return { key, label, module, hint, url: key==='termine'?null:url(module) };
  },
};
if(typeof window!=='undefined') window.MEDICORE_PARCOURS = MEDICORE_PARCOURS;
