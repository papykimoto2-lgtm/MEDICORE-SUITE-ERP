// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Bootstrap sécurité (à inclure en dernier sur les pages protégées)
// Vérifie la session, applique le RBAC au niveau module, masque l'UI non autorisée,
// et journalise l'accès. Redirige vers login si non autorisé.
// ══════════════════════════════════════════════════════════════════════════════
(function(){
  function moduleId(){ return (location.pathname.split('/').pop()||'').replace('.html',''); }
  function blocPage(role){
    document.body.innerHTML=`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;background:#f4f3ef">
      <div style="background:#fff;border:1px solid #e2dfd8;border-radius:12px;padding:32px;max-width:420px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.1)">
        <div style="font-size:40px">⛔</div>
        <h2 style="font-family:'DM Serif Display',serif;color:#1a4b6e;margin:10px 0">Accès non autorisé</h2>
        <p style="color:#6b6b6b;font-size:14px">Votre rôle <strong>${role||'—'}</strong> n'a pas accès à ce module.</p>
        <a href="dpi.html" style="display:inline-block;margin-top:14px;background:#1a4b6e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">← Retour</a>
      </div></div>`;
  }
  function run(){
    if(typeof MEDICORE_SESSION==='undefined') return;
    // 1) Session valide ? (sinon redirection login)
    if(!MEDICORE_SESSION.guard()) return;
    // 2) Accès au module selon le rôle
    const mod=moduleId();
    if(typeof MEDICORE_RBAC!=='undefined' && mod && mod!=='login'){
      if(!MEDICORE_RBAC.canModule(mod)){
        if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.accesRefuse('module:'+mod);
        blocPage(MEDICORE_RBAC.role());
        return;
      }
      MEDICORE_RBAC.enforceUI();
    }
    // 3) Journalise l'accès au module
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Accès module','CONSULTATION', mod, '');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
