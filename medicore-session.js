// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Session (expiration absolue + inactivité + jeton)
// ──────────────────────────────────────────────────────────────────────────────
// Côté client : déconnexion auto à l'expiration ou après inactivité.
// Le jeton local imite un JWT (header.payload.signature) pour transporter rôle/exp.
// ⚠️ La vérification cryptographique réelle se fait côté serveur (Supabase JWT).
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_SESSION = {
  KEY:'medicore_user', TKEY:'medicore_token', AKEY:'medicore_last_activity',
  ABS_MS: 12*60*60*1000,   // durée de vie absolue : 12 h
  IDLE_MS: 20*60*1000,     // inactivité max : 20 min

  _b64(o){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }catch(e){ return ''; } },
  _unb64(s){ try{ return JSON.parse(decodeURIComponent(escape(atob(s)))); }catch(e){ return null; } },

  // Émet un "JWT" local à la connexion
  issue(user){
    const iat=Date.now(), exp=iat+this.ABS_MS;
    const payload={ sub:user.login, nom:user.nom, role:user.role, iat, exp };
    const token=this._b64({alg:'local',typ:'JWT'})+'.'+this._b64(payload)+'.'+this._b64({s:(user.login||'')+iat});
    try{
      sessionStorage.setItem(this.KEY, JSON.stringify(user));
      sessionStorage.setItem(this.TKEY, token);
      sessionStorage.setItem(this.AKEY, String(iat));
    }catch(e){}
    return token;
  },
  payload(){ const t=sessionStorage.getItem(this.TKEY); if(!t) return null; const parts=t.split('.'); return parts[1]?this._unb64(parts[1]):null; },
  user(){ try{ return JSON.parse(sessionStorage.getItem(this.KEY)||'null'); }catch(e){ return null; } },

  touch(){ try{ sessionStorage.setItem(this.AKEY, String(Date.now())); }catch(e){} },

  // Retourne {ok} ou {expired, reason}
  check(){
    const p=this.payload(); if(!p) return { ok:false, reason:'absente' };
    const now=Date.now();
    if(now>p.exp) return { ok:false, reason:'absolue' };
    const last=+(sessionStorage.getItem(this.AKEY)||p.iat);
    if(now-last>this.IDLE_MS) return { ok:false, reason:'inactivite' };
    return { ok:true, payload:p };
  },

  logout(reason){
    try{
      const u=this.user();
      if(u && typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('DECONNEXION','CONNEXION','Fin de session'+(reason?' ('+reason+')':''), u.login);
      if(typeof MEDICORE_AUTH!=='undefined' && MEDICORE_AUTH.isAuthenticated()) { try{ MEDICORE_AUTH.signOut(); }catch(e){} }
      sessionStorage.removeItem(this.KEY); sessionStorage.removeItem(this.TKEY); sessionStorage.removeItem(this.AKEY);
    }catch(e){}
    location.href='login.html'+(reason?('?exp='+reason):'');
  },

  // À appeler sur chaque page protégée
  guard(){
    const r=this.check();
    if(!r.ok){ this.logout(r.reason); return false; }
    this.touch();
    ['click','keydown','mousemove','touchstart'].forEach(ev=>document.addEventListener(ev, ()=>this.touch(), {passive:true}));
    // Vérif périodique (expiration auto même sans action)
    setInterval(()=>{ const c=this.check(); if(!c.ok) this.logout(c.reason); }, 30000);
    return true;
  },
};
if(typeof window!=='undefined') window.MEDICORE_SESSION = MEDICORE_SESSION;
