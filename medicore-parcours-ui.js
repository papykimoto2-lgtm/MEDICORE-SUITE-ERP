// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Barre de guidage du parcours patient (auto-injectée)
// ──────────────────────────────────────────────────────────────────────────────
// Inclure APRÈS medicore-parcours.js. Affiche, quand un patient est actif, le
// circuit de soins avec l'étape courante + un bouton « Étape suivante → ».
// ══════════════════════════════════════════════════════════════════════════════
(function(){
  if(typeof MEDICORE_PARCOURS==='undefined') return;
  const P=MEDICORE_PARCOURS;

  function patient(){ try{ return (typeof MEDICORE_PATIENT!=='undefined')?MEDICORE_PATIENT.get():null; }catch(e){ return null; } }

  function css(){
    if(document.getElementById('parc-css')) return;
    const s=document.createElement('style'); s.id='parc-css';
    s.textContent=`
    #parc-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:8500;
      background:#fff;border:1px solid #e2dfd8;border-radius:30px;box-shadow:0 6px 22px rgba(0,0,0,.16);
      display:flex;align-items:center;gap:4px;padding:7px 9px;font-family:'DM Sans',system-ui,sans-serif;max-width:94vw;overflow-x:auto}
    #parc-bar.hidden{display:none}
    .parc-step{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:18px;font-size:12px;white-space:nowrap;cursor:pointer;color:#6b6b6b}
    .parc-step .ic{font-size:13px}
    .parc-fait{color:#15803d}.parc-fait .ic::after{content:' ✓'}
    .parc-encours{background:#1C1C2E;color:#fff;font-weight:600}
    .parc-afaire{color:#B87333;font-weight:600}
    .parc-optionnel{opacity:.45}
    .parc-sep{color:#cbd5e1;font-size:11px}
    .parc-next{margin-left:6px;background:#B87333;color:#fff;border:none;border-radius:18px;padding:7px 14px;
      font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
    .parc-close{border:none;background:none;color:#9ca3af;font-size:15px;cursor:pointer;padding:0 4px}
    .parc-name{font-weight:600;font-size:12px;color:#1C1C2E;padding:0 6px;white-space:nowrap}`;
    document.head.appendChild(s);
  }

  function build(){
    css();
    let bar=document.getElementById('parc-bar');
    if(!bar){ bar=document.createElement('div'); bar.id='parc-bar'; document.body.appendChild(bar); }
    return bar;
  }

  function render(){
    const p=patient(); const bar=build();
    if(!p || !p.id){ bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const steps=P.statut(p.id);
    const next=P.prochaine(p.id);
    const modCour=location.pathname.split('/').pop().replace('.html','');
    const stepsHTML=steps.map((s,i)=>{
      const cls='parc-'+(s.etat==='attente'?'optionnel':s.etat);
      const go=`location.href='${s.module}.html?patient=${encodeURIComponent(p.id)}'`;
      return `${i>0?'<span class="parc-sep">›</span>':''}<span class="parc-step ${cls}" title="${s.label}${s.optionnel?' (optionnel)':''}" onclick="${go}"><span class="ic">${s.icon}</span>${s.label}</span>`;
    }).join('');
    const nextBtn = next.url
      ? `<button class="parc-next" title="${next.hint}" onclick="location.href='${next.url}'">${next.label} →</button>`
      : `<span class="parc-step parc-fait" style="font-weight:600">✓ Terminé</span>`;
    bar.innerHTML=`<span class="parc-name">🧭 ${p.nom||p.id}</span>${stepsHTML}${nextBtn}
      <button class="parc-close" title="Masquer" onclick="document.getElementById('parc-bar').classList.add('hidden')">✕</button>`;
  }

  function init(){
    render();
    // Re-render quand le patient actif change ou que des données bougent
    document.addEventListener('medicore-patient-change', render);
    setInterval(render, 8000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.MEDICORE_PARCOURS_UI={ render };
})();
