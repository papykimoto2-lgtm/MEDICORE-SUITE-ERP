// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Scanner QR caméra (natif, sans dépendance)
// ──────────────────────────────────────────────────────────────────────────────
// Utilise l'API BarcodeDetector (Chrome / Android, recommandé en contexte hospit.).
// Aucune librairie externe → fonctionne hors-ligne.
// Nécessite HTTPS ou localhost (contrainte navigateur pour getUserMedia).
//
//   MEDICORE_SCAN.open(resultat => { ... })   // resultat = { id, ipp, nom, raw }
//
// Parse le payload bracelet MediCore :  …dpi.html?patient=ID  [IPP xxx - NOM]
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_SCAN = {
  _stream:null, _raf:null, _det:null,

  supported(){ return typeof window!=='undefined' && 'BarcodeDetector' in window; },

  // ── Extraction de l'identité depuis le contenu QR ────────────────────────────
  parse(text){
    text = (text||'').trim();
    let id='', ipp='', nom='';
    // 1) URL avec ?patient=ID
    try{ const u = new URL(text.split(/\s{2,}/)[0]); id = u.searchParams.get('patient') || ''; }catch(e){}
    if(!id){ const m = text.match(/[?&]patient=([^&\s]+)/); if(m) id = decodeURIComponent(m[1]); }
    // 2) Bloc [IPP xxx - NOM]
    const m2 = text.match(/\[\s*IPP\s+(.+?)\s+-\s+(.+?)\s*\]/i);
    if(m2){ ipp = m2[1].trim(); nom = m2[2].trim(); }
    // 3) QR brut = un simple identifiant
    if(!id && !ipp && /^[A-Za-z0-9._-]{2,}$/.test(text)) id = text;
    return { id, ipp, nom, raw:text };
  },

  // ── Ouvre la modale caméra ───────────────────────────────────────────────────
  async open(onResult){
    if(!this.supported()){
      this._fallback(onResult);
      return;
    }
    this._buildModal();
    const video = document.getElementById('mscan-video');
    const msg   = document.getElementById('mscan-msg');
    try{
      this._stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
      video.srcObject = this._stream;
      await video.play();
      this._det = new BarcodeDetector({ formats:['qr_code'] });
      msg.textContent = 'Visez le QR du bracelet patient…';
      const tick = async ()=>{
        if(!this._stream) return;
        try{
          const codes = await this._det.detect(video);
          if(codes && codes.length){
            const res = this.parse(codes[0].rawValue);
            this.close();
            if(typeof onResult==='function') onResult(res);
            return;
          }
        }catch(e){ /* frame ignorée */ }
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }catch(e){
      msg.innerHTML = '⚠️ Caméra indisponible ('+(e.name||e.message)+').<br>Vérifiez l\'autorisation et le HTTPS.';
      msg.style.color = '#b91c1c';
    }
  },

  close(){
    if(this._raf){ cancelAnimationFrame(this._raf); this._raf=null; }
    if(this._stream){ this._stream.getTracks().forEach(t=>t.stop()); this._stream=null; }
    const ov=document.getElementById('mscan-ov'); if(ov) ov.remove();
  },

  // ── Saisie manuelle si BarcodeDetector absent (iOS Safari, vieux navigateurs) ─
  _fallback(onResult){
    const v = prompt('Scanner indisponible sur ce navigateur.\nSaisissez l\'IPP ou le N° de dossier du patient :');
    if(v && v.trim() && typeof onResult==='function') onResult(this.parse(v.trim()));
  },

  // ── DOM modale ────────────────────────────────────────────────────────────────
  _buildModal(){
    if(document.getElementById('mscan-ov')) return;
    const ov=document.createElement('div'); ov.id='mscan-ov';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;'+
      'flex-direction:column;align-items:center;justify-content:center;font-family:DM Sans,system-ui,sans-serif';
    ov.innerHTML=
      '<div style="position:relative;width:300px;max-width:88vw;aspect-ratio:1;border-radius:16px;overflow:hidden;background:#000">'+
        '<video id="mscan-video" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>'+
        '<div style="position:absolute;inset:14%;border:3px solid #B87333;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.25)"></div>'+
      '</div>'+
      '<div id="mscan-msg" style="color:#fff;font-size:13.5px;margin-top:16px;text-align:center;max-width:300px">Initialisation caméra…</div>'+
      '<button onclick="MEDICORE_SCAN.close()" style="margin-top:18px;padding:10px 24px;border:none;border-radius:24px;'+
        'background:#fff;color:#1C1C2E;font-weight:600;font-size:14px;cursor:pointer">Annuler</button>';
    ov.addEventListener('click', e=>{ if(e.target===ov) this.close(); });
    document.body.appendChild(ov);
  },
};

if(typeof window!=='undefined') window.MEDICORE_SCAN = MEDICORE_SCAN;
