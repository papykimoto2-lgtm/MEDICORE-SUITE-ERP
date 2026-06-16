// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — RBAC (contrôle d'accès basé sur les rôles)
// ──────────────────────────────────────────────────────────────────────────────
// Source de vérité des rôles et permissions côté client (UI + garde-fous).
// ⚠️ L'application RÉELLE des droits se fait côté serveur via Supabase RLS
//    (voir security_schema.sql). Cette couche guide l'UI et bloque l'accidentel.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_RBAC = {
  ROLES: {
    administrateur:{ label:'Administrateur',  desc:'Accès complet + configuration', twofa:true },
    direction:     { label:'Direction',       desc:'Pilotage, reporting, validation', twofa:true },
    medecin:       { label:'Médecin',          desc:'Dossiers, prescriptions, actes' },
    infirmier:     { label:'Infirmier',        desc:'Soins, constantes, surveillance' },
    pharmacien:    { label:'Pharmacien',       desc:'PUI, dispensation, stock' },
    laborantin:    { label:'Laborantin',       desc:'Analyses, résultats' },
    caissier:      { label:'Caissier',         desc:'Encaissements, caisse' },
    comptable:     { label:'Comptable',        desc:'Comptabilité, trésorerie' },
    rh:            { label:'RH',               desc:'Personnel, paie' },
    archiviste:    { label:'Archiviste',       desc:'Consultation dossiers (lecture)' },
  },

  // Permissions par rôle. '*' = tout. Sinon liste de clés "module" et "action".
  PERMS: {
    administrateur: ['*'],
    direction:      ['module:*','dossier.read','rapport.read','prescription.validate','user.read','audit.read','stock.write','stock.admin'],
    medecin:        ['module:urgences','module:dpi','module:laboratoire','module:imagerie','module:bloc','module:pharmacie',
                     'dossier.read','dossier.write','prescription.create','prescription.validate','prescription.delete','demande.create','urgence.triage'],
    infirmier:      ['module:urgences','module:dpi','dossier.read','constante.write','urgence.triage','surveillance.write'],
    pharmacien:     ['module:pharmacie','module:dpi','dossier.read','prescription.validate','dispense','stock.write'],
    laborantin:     ['module:laboratoire','module:dpi','dossier.read','resultat.write','demande.handle'],
    caissier:       ['module:facturation','module:pharmacie','module:dpi','dossier.read','encaisser','facture.create'],
    comptable:      ['module:comptabilite_generale','module:comptabilite_analytique','module:tresorerie','module:immobilisations','module:facturation','compta.write','rapport.read'],
    rh:             ['module:rh_paie','rh.write'],
    archiviste:     ['module:dpi','module:tableaux_de_bord','dossier.read'],
  },

  // Modules accessibles par rôle (pour la sidebar / redirection)
  MODULES_ROLE: {
    administrateur:'*', direction:'*',
    medecin:['urgences','dpi','laboratoire','imagerie','bloc_operatoire','pharmacie_pui'],
    infirmier:['urgences','dpi'],
    pharmacien:['pharmacie_pui','dpi'],
    laborantin:['laboratoire','dpi'],
    caissier:['facturation','pharmacie_pui','dpi'],
    comptable:['comptabilite_generale','comptabilite_analytique','tresorerie','immobilisations','facturation','tableaux_de_bord'],
    rh:['rh_paie','tableaux_de_bord'],
    archiviste:['dpi','tableaux_de_bord'],
  },

  _normRole(r){
    if(!r) return null;
    r=(''+r).toLowerCase().replace(/[éè]/g,'e').replace(/[^a-z]/g,'');
    const map={administrateur:'administrateur',admin:'administrateur',administrateursi:'administrateur',
      direction:'direction',directeur:'direction',daf:'comptable',
      medecin:'medecin',docteur:'medecin',praticien:'medecin',chirurgien:'medecin',radiologue:'medecin',
      infirmier:'infirmier',infirmiere:'infirmier',ide:'infirmier',
      pharmacien:'pharmacien',laborantin:'laborantin',biologiste:'laborantin',
      caissier:'caissier',caisse:'caissier',comptable:'comptable',rh:'rh',archiviste:'archiviste'};
    return map[r]||r;
  },

  current(){
    try{ const u=JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); return u; }catch(e){ return {}; }
  },
  role(){ return this._normRole(this.current().role); },

  can(perm){
    const role=this.role(); if(!role) return false;
    const p=this.PERMS[role]||[];
    if(p.includes('*')) return true;
    if(p.includes(perm)) return true;
    // module:* autorise tout module:xxx
    if(perm.indexOf('module:')===0 && p.includes('module:*')) return true;
    return false;
  },
  canModule(moduleId){
    const role=this.role(); if(!role) return false;
    const m=this.MODULES_ROLE[role];
    if(m==='*') return true;
    return Array.isArray(m) && m.includes(moduleId);
  },
  requireRole(...roles){ const r=this.role(); return roles.map(x=>this._normRole(x)).includes(r); },
  needs2FA(role){ const cfg=this.ROLES[this._normRole(role)]; return !!(cfg&&cfg.twofa); },

  // Masque les éléments [data-perm="x"] / [data-role="a,b"] non autorisés
  enforceUI(root){
    (root||document).querySelectorAll('[data-perm]').forEach(el=>{ if(!this.can(el.getAttribute('data-perm'))) el.style.display='none'; });
    (root||document).querySelectorAll('[data-role]').forEach(el=>{
      const allow=el.getAttribute('data-role').split(',').map(s=>this._normRole(s.trim()));
      if(!allow.includes(this.role())) el.style.display='none';
    });
  },
};
if(typeof window!=='undefined') window.MEDICORE_RBAC = MEDICORE_RBAC;
