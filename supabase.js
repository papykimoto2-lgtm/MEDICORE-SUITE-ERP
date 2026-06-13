// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Client Supabase
// Projet : medicore-erp (eu-west-3 · Paris)
// Remplace progressivement localStorage par un vrai backend PostgreSQL.
// ══════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://bjsgivzfarknjfdxhqth.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqc2dpdnpmYXJrbmpmZHhocXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMDUzMDUsImV4cCI6MjA5Njg4MTMwNX0.e1Oa9y0BT3DXe6BZUpNLLbsm8uxEePbWjyWGiKcPhBc';

// ── Client fetch léger (pas de dépendance npm) ─────────────────────────────────
const DB = {
  _h(method, body) {
    const h = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    };
    return { method, headers: h, body: body ? JSON.stringify(body) : undefined };
  },

  // SELECT avec filtres optionnels
  // ex: DB.select('patients', 'ipp,nom,prenom', { statut: 'eq.Actif' })
  async select(table, columns = '*', filters = {}, opts = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}`;
    Object.entries(filters).forEach(([k, v]) => url += `&${k}=${encodeURIComponent(v)}`);
    if (opts.order) url += `&order=${opts.order}`;
    if (opts.limit) url += `&limit=${opts.limit}`;
    if (opts.offset) url += `&offset=${opts.offset}`;
    const r = await fetch(url, this._h('GET'));
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // INSERT
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      ...this._h('POST', Array.isArray(data) ? data : [data]),
      headers: { ...this._h('POST').headers, 'Prefer': 'return=representation' }
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // UPDATE (filtre ex: { id: 'eq.uuid' })
  async update(table, data, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(filters).forEach(([k, v]) => url += `${k}=${encodeURIComponent(v)}&`);
    const r = await fetch(url, {
      ...this._h('PATCH', data),
      headers: { ...this._h('PATCH').headers, 'Prefer': 'return=representation' }
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // DELETE
  async delete(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(filters).forEach(([k, v]) => url += `${k}=${encodeURIComponent(v)}&`);
    const r = await fetch(url, this._h('DELETE'));
    if (!r.ok) throw new Error(await r.text());
    return r.ok;
  },

  // RPC (fonction PostgreSQL)
  async rpc(fn, params = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, this._h('POST', params));
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

// ── Auth Supabase ──────────────────────────────────────────────────────────────
const AUTH = {
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'Erreur auth');
    sessionStorage.setItem('medicore_sb_token', data.access_token);
    sessionStorage.setItem('medicore_sb_refresh', data.refresh_token);
    return data;
  },

  async signOut() {
    const token = this.getToken();
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token }
      });
    }
    sessionStorage.removeItem('medicore_sb_token');
    sessionStorage.removeItem('medicore_sb_refresh');
  },

  getToken() { return sessionStorage.getItem('medicore_sb_token'); },
  isAuth()   { return !!this.getToken(); }
};

// ── API MediCore — couche métier au-dessus de DB ───────────────────────────────
const API = {

  // ── Patients ────────────────────────────────────────────────────────────────
  patients: {
    async list(statut)   { return DB.select('patients','*', statut ? { statut:`eq.${statut}` } : {}, { order: 'nom.asc' }); },
    async get(id)        { return DB.select('patients','*',{ id:`eq.${id}` }).then(r=>r[0]); },
    async getByIPP(ipp)  { return DB.select('patients','*',{ ipp:`eq.${ipp}` }).then(r=>r[0]); },
    async create(data)   { return DB.insert('patients', data).then(r=>r[0]); },
    async update(id,d)   { return DB.update('patients', d, { id:`eq.${id}` }).then(r=>r[0]); },
  },

  // ── Séjours ─────────────────────────────────────────────────────────────────
  sejours: {
    async byPatient(patientId) { return DB.select('sejours','*',{ patient_id:`eq.${patientId}` },{ order:'date_entree.desc' }); },
    async actifs()             { return DB.select('sejours','*,patients(nom,prenom,ipp)',{ statut:'eq.Actif' }); },
    async create(data)         { return DB.insert('sejours', data).then(r=>r[0]); },
    async sortie(id)           { return DB.update('sejours',{ date_sortie: new Date().toISOString().split('T')[0], statut:'Sorti' },{ id:`eq.${id}` }); },
  },

  // ── Prescriptions ────────────────────────────────────────────────────────────
  prescriptions: {
    async bySejour(sejourId)    { return DB.select('prescriptions','*',{ sejour_id:`eq.${sejourId}` }); },
    async pending()             { return DB.select('prescriptions','*,sejours(num_dossier),patients!prescriptions_patient_id_fkey(nom)',{ statut:'eq.En attente validation' }); },
    async create(data)          { return DB.insert('prescriptions',data).then(r=>r[0]); },
    async valider(id, userId)   { return DB.update('prescriptions',{ statut:'Validée', validee_par:userId, validee_at:new Date().toISOString() },{ id:`eq.${id}` }); },
    async refuser(id, userId)   { return DB.update('prescriptions',{ statut:'Refusée', refuse_par:userId, refuse_at:new Date().toISOString() },{ id:`eq.${id}` }); },
  },

  // ── Labo ─────────────────────────────────────────────────────────────────────
  labo: {
    async list(statut)    { return DB.select('demandes_labo','*,patients(nom,prenom)',statut?{statut:`eq.${statut}`}:{},{ order:'created_at.desc' }); },
    async create(data)    { return DB.insert('demandes_labo',data).then(r=>r[0]); },
    async valider(id,uid) { return DB.update('demandes_labo',{ statut:'Validé', valide_par:uid, valide_at:new Date().toISOString() },{ id:`eq.${id}` }); },
    async resultats(demandeId) { return DB.select('resultats_labo','*',{ demande_id:`eq.${demandeId}` }); },
    async addResultat(data)    { return DB.insert('resultats_labo',data).then(r=>r[0]); },
  },

  // ── Stock ─────────────────────────────────────────────────────────────────────
  stock: {
    async list()          { return DB.select('produits','*',{},{ order:'dci.asc' }); },
    async alertes()       { return DB.select('produits','*',{ 'stock':'lte.stock_mini' }); },
    async mouvement(data) { return DB.insert('mouvements_stock',data).then(r=>r[0]); },
  },

  // ── Facturation ──────────────────────────────────────────────────────────────
  facturation: {
    async list(statut)    { return DB.select('factures','*,patients(nom,prenom)',statut?{statut:`eq.${statut}`}:{},{ order:'date_facture.desc' }); },
    async create(data)    { return DB.insert('factures',data).then(r=>r[0]); },
    async payer(id,uid)   { return DB.update('factures',{ statut:'Payée', paie_par:uid, paie_at:new Date().toISOString() },{ id:`eq.${id}` }); },
  },

  // ── Comptabilité ─────────────────────────────────────────────────────────────
  compta: {
    async journal(periode)  { return DB.select('ecritures','*',periode?{ date_ecrit:`gte.${periode}-01` }:{},{ order:'date_ecrit.asc' }); },
    async ecriture(data)    { return DB.insert('ecritures',data).then(r=>r[0]); },
    async balance()         { return DB.rpc('get_balance'); },
  },

  // ── Audit ─────────────────────────────────────────────────────────────────────
  audit: {
    async log(action, module, entiteId, detail, auteurId, auteurNom, role) {
      return DB.insert('audit_log',{ action, module, entite_id:entiteId, detail, auteur_id:auteurId, auteur_nom:auteurNom, role });
    },
    async recent(n=50) { return DB.select('audit_log','*',{},{ order:'created_at.desc', limit:n }); },
  },

  // ── Bus inter-modules ─────────────────────────────────────────────────────────
  bus: {
    async publish(type, payload, source) { return DB.insert('bus_evenements',{ type, payload, source, lu:false }); },
    async pending(type)   { return DB.select('bus_evenements','*',{ lu:'eq.false', ...(type?{type:`eq.${type}`}:{}) },{ order:'created_at.desc' }); },
    async markRead(type)  { return DB.update('bus_evenements',{ lu:true, lu_at:new Date().toISOString() },{ type:`eq.${type}`, lu:'eq.false' }); },
    async count(type)     { return DB.select('bus_evenements','id',{ lu:'eq.false', type:`eq.${type}` }).then(r=>r.length); },
  }
};

// ── Offline-first : fallback localStorage si Supabase inaccessible ─────────────
// Usage dans les modules : await safeDB(()=>API.patients.list(), localFallback)
async function safeDB(fn, fallback) {
  try {
    return await fn();
  } catch(e) {
    console.warn('[MediCore] Supabase indisponible — mode offline :', e.message);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

// Exposer globalement
window.DB     = DB;
window.AUTH   = AUTH;
window.API    = API;
window.safeDB = safeDB;
window.SUPABASE_URL = SUPABASE_URL;
