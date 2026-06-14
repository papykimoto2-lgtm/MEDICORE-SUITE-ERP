// Carte « Caisse pharmacie » injectée dans le tableau de bord
(function(){
  function inject(){
    if(typeof MEDICORE_CAISSE==='undefined') return;
    const c=document.querySelector('.content'); if(!c || document.getElementById('dash-caisse-pharma')) return;
    const recette=MEDICORE_CAISSE.totalJour('pharmacie_pui');
    const nb=MEDICORE_CAISSE.duJour('pharmacie_pui').length;
    const sess=MEDICORE_CAISSE.sessionCourante('pharmacie_pui');
    const labo=MEDICORE_CAISSE.totalJour('laboratoire');
    const card=document.createElement('div');
    card.id='dash-caisse-pharma';
    card.style.cssText='background:#fff;border:1px solid var(--border,#e2dfd8);border-left:4px solid #15803d;border-radius:8px;padding:16px 18px;margin:0 0 18px;box-shadow:0 1px 3px rgba(0,0,0,.06)';
    card.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'+
        '<div><div style="font-size:12px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.5px">🧾 Caisse pharmacie — recette du jour</div>'+
        '<div style="font-size:26px;font-weight:700;color:#15803d">'+recette.toLocaleString('fr-FR')+' FCFA</div>'+
        '<div style="font-size:12px;color:#6b6b6b">'+nb+' opération(s) · caisse '+(sess?('ouverte par '+sess.caissier):'fermée')+'</div></div>'+
        '<div style="text-align:right"><div style="font-size:12px;color:#6b6b6b">Caisse laboratoire (jour)</div>'+
        '<div style="font-size:20px;font-weight:600;color:#1a4b6e">'+labo.toLocaleString('fr-FR')+' FCFA</div>'+
        '<a href="pharmacie_pui.html" style="font-size:12px;color:#1a4b6e;text-decoration:none">→ Ouvrir la pharmacie</a></div>'+
      '</div>';
    c.insertBefore(card, c.firstChild);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
