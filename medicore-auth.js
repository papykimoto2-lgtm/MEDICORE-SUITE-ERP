// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Supabase Auth (JWT côté serveur)
// ──────────────────────────────────────────────────────────────────────────────
// Authentifie via Supabase Auth → jeton JWT signé serveur (expiration + refresh).
// Le rôle vient de la table medicore_profiles. Le jeton est ensuite envoyé sur
// chaque requête REST (Authorization: Bearer) → les politiques RLS s'appliquent.
// Repli : si Supabase non configuré, l'app reste utilisable en mode local.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_AUTH = {
  SKEY:'medicore_sb_session',

  creds(){
    let s={}; try{ s=JSON.parse(localStorage.getItem('medicore_sb_creds')||'{}'); }catch(e){}
    return { url:s.url||(typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:''),
             key:s.key||(typeof SUPABASE_KEY!=='undefined'?SUPABASE_KEY:'') };
  },
  configured(){ const c=this.creds(); return !!(c.url&&c.key); },

  _session(){ try{ return JSON.parse(localStorage.getItem(this.SKEY)||'null'); }catch(e){ return null; } },
  _save(s){ try{ localStorage.setItem(this.SKEY, JSON.stringify(s)); }catch(e){} },
  _clear(){ try{ localStorage.removeItem(this.SKEY); }catch(e){} },

  // Jeton valide (sinon null → appeler ensureFresh)
  token(){
    const s=this._session(); if(!s||!s.access_token) return null;
    if(s.expires_at && Date.now() > (s.expires_at-30000)) return null; // marge 30 s
    return s.access_token;
  },
  user(){ const s=this._session(); return s?s.user:null; },

  async _post(path, body, bearer){
    const { url, key }=this.creds();
    const r=await fetch(url+path, { method:'POST',
      headers:{ 'apikey':key, 'Authorization':'Bearer '+(bearer||key), 'Content-Type':'application/json' },
      body:JSON.stringify(body) });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error_description||data.msg||data.message||('HTTP '+r.status));
    return data;
  },

  // Connexion email / mot de passe → JWT
  async signIn(email, password){
    const d=await this._post('/auth/v1/token?grant_type=password', { email, password });
    const sess={ access_token:d.access_token, refresh_token:d.refresh_token,
      expires_at:Date.now()+((d.expires_in||3600)*1000), user:d.user };
    this._save(sess);
    const profil=await this.profil(d.user.id).catch(()=>null);
    return { user:d.user, profil };
  },

  // Rôle / nom depuis medicore_profiles
  async profil(userId){
    const { url, key }=this.creds(); const tok=this.token();
    const r=await fetch(url+'/rest/v1/medicore_profiles?select=role,nom,login,actif&user_id=eq.'+userId,
      { headers:{ 'apikey':key, 'Authorization':'Bearer '+(tok||key) } });
    const arr=await r.json().catch(()=>[]);
    return Array.isArray(arr)&&arr[0]?arr[0]:null;
  },

  // Rafraîchit le jeton si expiré
  async ensureFresh(){
    const s=this._session(); if(!s) return null;
    if(s.access_token && Date.now() < (s.expires_at-30000)) return s.access_token;
    if(!s.refresh_token) return null;
    try{
      const d=await this._post('/auth/v1/token?grant_type=refresh_token', { refresh_token:s.refresh_token });
      const sess={ access_token:d.access_token, refresh_token:d.refresh_token||s.refresh_token,
        expires_at:Date.now()+((d.expires_in||3600)*1000), user:d.user||s.user };
      this._save(sess); return sess.access_token;
    }catch(e){ this._clear(); return null; }
  },

  async signOut(){
    const { url, key }=this.creds(); const s=this._session();
    if(s&&s.access_token){ try{ await fetch(url+'/auth/v1/logout',{ method:'POST',
      headers:{ 'apikey':key, 'Authorization':'Bearer '+s.access_token } }); }catch(e){} }
    this._clear();
  },
  isAuthenticated(){ return !!this._session(); },
};
if(typeof window!=='undefined') window.MEDICORE_AUTH = MEDICORE_AUTH;
