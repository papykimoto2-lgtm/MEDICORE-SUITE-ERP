// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Impression / Aperçu PDF (sans dépendance)
// ──────────────────────────────────────────────────────────────────────────────
// Ouvre une fenêtre A4 mise en forme. L'utilisateur imprime ou « Enregistrer en PDF ».
//   MEDICORE_PRINT.open({ titre, sousTitre, corpsHTML })
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_PRINT = {
  etablissement(){
    try{
      const par=(typeof MEDICORE_STORE!=='undefined')?MEDICORE_STORE.load('parametrage',null):null;
      const c=(par&&par.cfg)||{};
      return { nom:c.etablissement||'MediCore — Centre Hospitalier', adresse:c.adresse||'Abidjan, Côte d\'Ivoire',
               tel:c.tel||'', rccm:c.rccm||'', ncc:c.ncc||'' };
    }catch(e){ return { nom:'MediCore — Centre Hospitalier', adresse:'Abidjan, Côte d\'Ivoire' }; }
  },

  open({ titre, sousTitre, corpsHTML }){
    const et=this.etablissement();
    const w=window.open('','_blank','width=900,height=1000');
    if(!w){ if(typeof toast==='function') toast('Autorisez les pop-ups pour l\'aperçu.','warn'); return; }
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${titre||'Document'}</title>
<style>
  @page{ size:A4; margin:14mm; }
  *{ box-sizing:border-box; }
  body{ font-family:'Segoe UI',system-ui,Arial,sans-serif; color:#1c1c2e; font-size:12.5px; line-height:1.5; margin:0; }
  .doc-bar{ position:sticky; top:0; background:#1C1C2E; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
  .doc-bar button{ background:#B87333; color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:13px; font-weight:600; cursor:pointer; }
  .doc-wrap{ max-width:780px; margin:0 auto; padding:22px; }
  .et-head{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1C1C2E; padding-bottom:10px; margin-bottom:14px; }
  .et-nom{ font-size:17px; font-weight:700; color:#1C1C2E; }
  .et-sub{ font-size:11px; color:#666; }
  .doc-titre{ font-size:18px; font-weight:700; margin:4px 0; }
  .doc-stitre{ font-size:12.5px; color:#666; margin-bottom:14px; }
  h3{ font-size:13px; text-transform:uppercase; letter-spacing:.5px; color:#B87333; border-bottom:1px solid #e2dfd8; padding-bottom:4px; margin:18px 0 8px; }
  table{ width:100%; border-collapse:collapse; margin:6px 0; }
  th,td{ text-align:left; padding:6px 8px; border-bottom:1px solid #e9e7e1; font-size:12px; }
  th{ background:#f8f7f2; font-size:10.5px; text-transform:uppercase; letter-spacing:.4px; color:#666; }
  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:6px 18px; }
  .kv{ font-size:12.5px; } .kv b{ color:#1C1C2E; }
  .tl{ border-left:2px solid #B87333; padding-left:12px; margin-left:4px; }
  .tl-item{ margin-bottom:10px; } .tl-date{ font-size:11px; color:#888; } .tl-type{ font-weight:600; }
  .right{ text-align:right; } .tot{ font-weight:700; }
  .paye{ color:#15803d; font-weight:600; } .du{ color:#b91c1c; font-weight:600; }
  .sign{ margin-top:30px; display:flex; justify-content:space-between; }
  .sign div{ width:45%; } .sign .line{ border-top:1px solid #1c1c2e; margin-top:40px; padding-top:4px; font-size:11px; color:#666; }
  .foot{ margin-top:24px; border-top:1px solid #e2dfd8; padding-top:8px; font-size:10px; color:#999; text-align:center; }
  @media print{ .doc-bar{ display:none; } .doc-wrap{ padding:0; } }
</style></head><body>
  <div class="doc-bar"><span>Aperçu — ${titre||''}</span><button onclick="window.print()">🖨 Imprimer / PDF</button></div>
  <div class="doc-wrap">
    <div class="et-head">
      <div><div class="et-nom">${et.nom}</div><div class="et-sub">${et.adresse}${et.tel?' · '+et.tel:''}${et.rccm?' · RCCM '+et.rccm:''}</div></div>
      <div class="et-sub right">${new Date().toLocaleString('fr-FR')}</div>
    </div>
    <div class="doc-titre">${titre||''}</div>
    ${sousTitre?`<div class="doc-stitre">${sousTitre}</div>`:''}
    ${corpsHTML||''}
    <div class="foot">Document généré par MediCore ERP · ${et.nom} · SYSCOHADA — FCFA</div>
  </div>
</body></html>`);
    w.document.close(); w.focus();
  },
};
if(typeof window!=='undefined') window.MEDICORE_PRINT = MEDICORE_PRINT;
