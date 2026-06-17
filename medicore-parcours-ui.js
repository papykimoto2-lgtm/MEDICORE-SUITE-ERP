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

  // Cache du dernier HTML rendu — évite les écritures DOM inutiles
  let _lastBarHTML = '';
  // Verrou anti-reentrée : empêche MutationObserver de se retriggerer
  // sur les mutations produites par render() elle-même
  let _rendering = false;

  function render(){
    if(_rendering) return;
    const p=patient(); const bar=build();
    if(!p || !p.id){ bar.classList.add('hidden'); _lastBarHTML=''; return; }
    // ── Masquer la barre si une modale/overlay est VISIBLE (sinon elle obstrue
    //    les boutons d'enregistrement en bas des formulaires) ──
    let modaleOuverte=false;
    document.querySelectorAll('.overlay, .modal-overlay').forEach(ov=>{
      if(modaleOuverte) return;
      const vis = ov.classList.contains('open') ||
        (getComputedStyle(ov).display!=='none' && ov.offsetParent!==null);
      if(vis) modaleOuverte=true;
    });
    if(modaleOuverte){ bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const steps=P.statut(p.id);
    const next=P.prochaine(p.id);
    const stepsHTML=steps.map((s,i)=>{
      const cls='parc-'+(s.etat==='attente'?'optionnel':s.etat);
      const go=`location.href='${s.module}.html?patient=${encodeURIComponent(p.id)}'`;
      return `${i>0?'<span class="parc-sep">›</span>':''}<span class="parc-step ${cls}" title="${s.label}${s.optionnel?' (optionnel)':''}" onclick="${go}"><span class="ic">${s.icon}</span>${s.label}</span>`;
    }).join('');
    const nextBtn = next.url
      ? `<button class="parc-next" title="${next.hint}" onclick="location.href='${next.url}'">${next.label} →</button>`
      : `<span class="parc-step parc-fait" style="font-weight:600">✓ Terminé</span>`;
    const newHTML=`<span class="parc-name">🧭 ${p.nom||p.id}</span>${stepsHTML}${nextBtn}`
      +`<button class="parc-close" title="Masquer" onclick="document.getElementById('parc-bar').classList.add('hidden')">✕</button>`;
    // N'écrit dans le DOM que si le contenu a réellement changé
    // (évite de déclencher le MutationObserver pour rien)
    if(newHTML !== _lastBarHTML){
      _rendering = true;
      bar.innerHTML = newHTML;
      _lastBarHTML = newHTML;
      _rendering = false;
    }
  }

  // Debounce pour absorber les rafales de mutations DOM
  let _debounceTimer = null;
  function renderDebounced(){
    if(_debounceTimer) return;
    _debounceTimer = setTimeout(()=>{ _debounceTimer=null; render(); }, 120);
  }

  function init(){
    render();
    // Re-render quand le patient actif change
    document.addEventListener('medicore-patient-change', render);
    // Rafraîchissement périodique (garde-fou si événements manqués)
    setInterval(render, 8000);
    // ── Détection ouverture/fermeture modale SANS boucle de rétroaction ──
    // On n'observe PAS subtree:true sur tout le body (déclencherait render
    // sur les mutations de bar.innerHTML → boucle infinie).
    // On surveille uniquement les overlays connus + les ajouts d'enfants directs du body.
    try{
      const obs=new MutationObserver(renderDebounced);
      document.querySelectorAll('.overlay, .modal-overlay').forEach(ov=>{
        obs.observe(ov, { attributes:true, attributeFilter:['class','style'] });
      });
      // Overlays créés dynamiquement
      const bodyObs=new MutationObserver((muts)=>{
        const pertinent=muts.some(m=>
          [...m.addedNodes,...m.removedNodes].some(n=>
            n.nodeType===1 && n.classList &&
            (n.classList.contains('overlay')||n.classList.contains('modal-overlay'))
          )
        );
        if(pertinent) renderDebounced();
      });
      bodyObs.observe(document.body, { childList:true });
    }catch(e){}
    // Filet de sécurité : tout clic peut ouvrir/fermer une modale
    document.addEventListener('click', ()=>setTimeout(renderDebounced, 50), true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.MEDICORE_PARCOURS_UI={ render };
})();
