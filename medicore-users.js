// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Gestion des utilisateurs (comptes, mots de passe, accès)
// ──────────────────────────────────────────────────────────────────────────────
//  • Source de vérité unique des comptes locaux (store 'utilisateurs')
//  • Mots de passe : SHA-256 + sel (Web Crypto), jamais stockés en clair
//  • Rôles = clés MEDICORE_RBAC.ROLES (administrateur, medecin, pharmacien, …)
//  • Création / réinitialisation génèrent un mot de passe à transmettre une fois
//  • login.html authentifie via MEDICORE_USERS.verifier(login, mdp)
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_USERS = {
  S:'utilisateurs',

  _read(){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(this.S,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.S)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.S,rows,true);
    else localStorage.setItem('medicore_'+this.S, JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },

  // ── Hachage SHA-256 + sel (Web Crypto) ───────────────────────────────────────
  async _hash(pwd, salt){
    const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt+':'+pwd));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  },
  _salt(){ return Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>b.toString(16).padStart(2,'0')).join(''); },

  // ── Génération d'un mot de passe initial (lisible, fort, à transmettre) ──────
  genererMotDePasse(){
    const mots=['Sante','Vital','Soin','Labo','Care','Nova','Apex','Bien','Acces','Suivi'];
    const m=mots[Math.floor(Math.random()*mots.length)];
    const n=1000+Math.floor(Math.random()*9000);
    const s=['!','@','#','$','%','&'][Math.floor(Math.random()*6)];
    return `${m}${n}${s}2026`;
  },

  liste(){ return this._read(); },
  get(login){ return this._read().find(u=>u.login===login); },

  // ── Création d'un compte — retourne {user, pwd} (pwd en clair, une seule fois) ──
  async creer(o){
    const list=this._read();
    if(list.some(u=>u.login.toLowerCase()===String(o.login).toLowerCase())) return {erreur:'login_existe'};
    const pwd=o.pwd||this.genererMotDePasse();
    const salt=this._salt(), hash=await this._hash(pwd,salt);
    const user={ login:o.login, nom:o.nom||o.login, role:o.role||'archiviste', service:o.service||'',
      twofa:!!o.twofa, actif:true, salt, hash, must_change:true,
      created_at:new Date().toISOString(), created_par:o.par||'' };
    list.push(user); this._write(list);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Création utilisateur','CREATION', `${user.nom} (${user.login}) — rôle ${user.role}`, user.login);
    return {user, pwd};
  },

  // ── Réinitialisation du mot de passe — retourne {pwd} (en clair, une seule fois) ──
  async reinitialiser(login, pwdImpose){
    const list=this._read(); const u=list.find(x=>x.login===login); if(!u) return {erreur:'introuvable'};
    const pwd=pwdImpose||this.genererMotDePasse();
    u.salt=this._salt(); u.hash=await this._hash(pwd,u.salt); u.must_change=true; u.updated_at=new Date().toISOString();
    this._write(list);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Réinitialisation mot de passe','MODIFICATION', `${u.nom} (${u.login})`, u.login);
    return {pwd};
  },

  // ── Vérification des identifiants (login.html) ───────────────────────────────
  async verifier(login, pwd){
    const u=this._read().find(x=>x.login===login);
    if(!u || !u.actif) return null;
    const h=await this._hash(pwd, u.salt);
    return h===u.hash?u:null;
  },

  // ── Modification (rôle, service, 2FA, statut, nom) ───────────────────────────
  modifier(login, patch){
    const list=this._read(); const u=list.find(x=>x.login===login); if(!u) return null;
    Object.assign(u, patch); u.updated_at=new Date().toISOString();
    this._write(list);
    return u;
  },
  toggleActif(login){
    const u=this.get(login); if(!u) return null;
    if(login==='admin' && u.actif) return {erreur:'admin_actif_requis'};
    return this.modifier(login, {actif:!u.actif});
  },
  supprimer(login){
    if(login==='admin') return {erreur:'admin_protege'};
    this._write(this._read().filter(u=>u.login!==login));
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Suppression utilisateur','SUPPRESSION', login, login);
    return {ok:true};
  },
  marquerMdpChange(login){ return this.modifier(login,{must_change:false}); },

  // ── Initialisation (premier lancement) ───────────────────────────────────────
  // Crée le compte administrateur par défaut si le store est vide.
  // Mot de passe initial à changer dès la première connexion.
  ready:null,
  seed(){
    if(this.ready) return this.ready;
    this.ready=(async()=>{
      const list=this._read();
      if(list.length) return;
      const salt=this._salt();
      const initPwd='Sante1585$2026'; // ⚠ à communiquer une seule fois puis à changer
      const hash=await this._hash(initPwd, salt);
      this._write([{ login:'admin', nom:'Administrateur Système', role:'administrateur', service:'',
        twofa:true, actif:true, salt, hash, must_change:true, created_at:new Date().toISOString(), created_par:'système' }]);
    })();
    return this.ready;
  },
};
if(typeof window!=='undefined') window.MEDICORE_USERS = MEDICORE_USERS;
// Auto-seed au chargement (idempotent — ne crée le compte admin que si le store est vide)
if(typeof MEDICORE_USERS.seed==='function') MEDICORE_USERS.seed();
