// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Moteur de synchronisation Cloud (offline-first)
// ──────────────────────────────────────────────────────────────────────────────
// • Stockage local = source de vérité. Cloud = miroir optionnel.
// • Sync delta par ligne (hash) — n'envoie que ce qui a changé.
// • Pull incrémental NON destructif (merge par id, last-write-wins).
// • Tolérant aux coupures : withTimeout + file d'attente + reprise auto.
// • Table générique JSONB → compatible tous les modules sans schéma typé.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_SYNC = {

  TABLE:    'medicore_sync_docs',
  TIMEOUT:  12000,          // 12 s — réseau instable
  AUTO_MS:  60000,          // sync auto toutes les 60 s
  NS:       'medicore_',

  // ── Stores synchronisés (clé localStorage sans préfixe → libellé) ───────────
  STORES: [

    { store:'demandes',              label:'Demandes inter-modules' },
    { store:'prestations',           label:'Prestations facturables' },
    { store:'caisse',                label:'Caisse / encaissements'  },
    { store:'caisse_sessions',       label:'Sessions de caisse'    },
    { store:'urgences',              label:'Urgences / triage'     },
    { store:'audit',                 label:'Journal d\'audit'        },
    { store:'connexions',            label:'Historique connexions'  },
    { store:'patients',              label:'Patients (DPI)'        },
    { store:'patients_archives',     label:'Patients archivés'     },
    { store:'constantes',            label:'Constantes vitales', kind:'doc' },
    { store:'prescriptions',         label:'Prescriptions'         },
    { store:'resultats',             label:'Résultats examens'     },
    { store:'labo_critiques',        label:'Valeurs critiques labo'},
    { store:'labo_journal',          label:'Journal interne labo' },
    { store:'labo_cqi',              label:'Contrôle qualité interne (CQI)' },
    { store:'labo_nc',               label:'Non-conformités labo' },
    { store:'labo_eeq',              label:'Programmes EEQ labo' },
    { store:'labo_automates_etat', kind:'doc', label:'État automates labo' },
    { store:'labo_documents',        label:'GED labo (procédures)' },
    { store:'demandes_labo',         label:'Demandes labo'         },
    { store:'resultats_labo',        label:'Résultats labo'        },
    { store:'demandes_img',          label:'Imagerie'              },
    { store:'cr_imagerie',           label:'Comptes rendus imagerie'},
    { store:'img_journal',           label:'Journal interne imagerie'},
    { store:'img_maintenance',       label:'Maintenance imagerie'  },
    { store:'img_equip_etat', kind:'doc', label:'État équipements imagerie' },
    { store:'interventions',         label:'Bloc opératoire'       },
    { store:'stock',                 label:'Stock pharmacie'       },
    { store:'mouvements_stock',      label:'Mouvements stock'      },
    { store:'consommables',          label:'Consommables (dépôts)' },
    { store:'depots_stock',          label:'Dépôts de stock'       },
    { store:'reappro',               label:'Réapprovisionnement'   },
    { store:'mouvements_consommables', label:'Mouvements consommables'},
    { store:'factures',              label:'Facturation'           },
    { store:'ecritures',             label:'Écritures comptables'  },
    { store:'mouvements_tresorerie', label:'Trésorerie'            },
    { store:'comptes_bancaires',     label:'Comptes bancaires'     },
    { store:'bons_commande',         label:'Achats & commandes'    },
    { store:'personnel',             label:'RH — Personnel'        },
    { store:'paie',                  label:'Bulletins de paie'     },
    { store:'immo',                  label:'Immobilisations'       },
    { store:'parametrage',           label:'Paramétrage (config, comptes, droits)', kind:'doc' },
  ],

  _busy:  false,
  _auto:  null,
  _online: navigator.onLine,
  _listeners: [],

  // ── Credentials ─────────────────────────────────────────────────────────────
  creds(){
    let s = {};
    try{ s = JSON.parse(localStorage.getItem('medicore_sb_creds')||'{}'); }catch(e){}
    return {
      url: s.url || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''),
      key: s.key || (typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : ''),
    };
  },
  configured(){ const c = this.creds(); return !!(c.url && c.key); },

  // ── Identité appareil (stable) ────────────────────────────────────────────────
  deviceId(){
    let id = localStorage.getItem('medicore_device_id');
    if(!id){
      id = (crypto.randomUUID ? crypto.randomUUID()
            : 'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
      localStorage.setItem('medicore_device_id', id);
    }
    return id;
  },

  // ── Réseau ──────────────────────────────────────────────────────────────────
  _withTimeout(promise, ms){
    return Promise.race([
      promise,
      new Promise((_, rej)=> setTimeout(()=> rej(new Error('Timeout réseau ('+ms+'ms)')), ms))
    ]);
  },
  async _fetch(path, opts={}){
    const { url, key } = this.creds();
    if(!url || !key) throw new Error('Supabase non configuré');
    // Jeton utilisateur (Supabase Auth) si disponible → RLS par rôle ; sinon clé anon
    let bearer = key;
    if(typeof MEDICORE_AUTH!=='undefined' && MEDICORE_AUTH.isAuthenticated()){
      try{ bearer = (await MEDICORE_AUTH.ensureFresh()) || key; }catch(e){ bearer = key; }
    }
    const headers = {
      'apikey': key, 'Authorization': 'Bearer '+bearer,
      'Content-Type': 'application/json', ...(opts.headers||{})
    };
    const r = await this._withTimeout(
      fetch(url+'/rest/v1/'+path, { ...opts, headers }), this.TIMEOUT
    );
    if(!r.ok && r.status!==201 && r.status!==206) throw new Error('HTTP '+r.status+' — '+(await r.text()).slice(0,140));
    return r;
  },

  // ── Lecture / écriture store (déballe le wrapper {_v,_ts,d}) ─────────────────
  _read(store){
    try{
      const raw = localStorage.getItem(this.NS+store);
      if(raw===null) return { ts:0, rows:[] };
      const p = JSON.parse(raw);
      const rows = (p && p.d!==undefined) ? p.d : p;       // nouveau vs ancien format
      const ts   = (p && p._ts) || 0;
      return { ts, rows: Array.isArray(rows) ? rows : [] };
    }catch(e){ return { ts:0, rows:[] }; }
  },
  _write(store, rows){
    if(typeof MEDICORE_STORE !== 'undefined'){
      MEDICORE_STORE.save(store, rows, true);              // respecte cache + debounce
    } else {
      localStorage.setItem(this.NS+store,
        JSON.stringify({ _v:1, _ts:Date.now(), d:rows }));
    }
  },

  // ── Stores-document (objet entier, ex: constantes, parametrage) ─────────────
  _readDoc(store){
    try{
      const raw = localStorage.getItem(this.NS+store);
      if(raw===null) return { ts:0, data:null };
      const p = JSON.parse(raw);
      const data = (p && p.d!==undefined) ? p.d : p;
      return { ts:(p&&p._ts)||0, data };
    }catch(e){ return { ts:0, data:null }; }
  },
  _writeDoc(store, data){
    if(typeof MEDICORE_STORE !== 'undefined') MEDICORE_STORE.save(store, data, true);
    else localStorage.setItem(this.NS+store, JSON.stringify({ _v:1, _ts:Date.now(), d:data }));
  },

  // ── Identifiant stable d'une ligne ──────────────────────────────────────────
  _docId(row, i){
    return String(row.id || row.ipp || row.code || row.reference || row.numero || ('row_'+i));
  },
  _hash(o){
    const s = JSON.stringify(o);
    let h = 0; for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i))|0; }
    return h.toString(36);
  },

  // ── État sync persistant ──────────────────────────────────────────────────────
  _meta(){ try{ return JSON.parse(localStorage.getItem('medicore_sync_meta')||'{}'); }catch(e){ return {}; } },
  _saveMeta(m){ localStorage.setItem('medicore_sync_meta', JSON.stringify(m)); },

  // Lignes en attente (modifiées depuis dernier push) — sur tous les stores
  pendingCount(){
    const meta = this._meta();
    const hashes = meta.hashes || {};
    let n = 0;
    this.STORES.forEach(({store})=>{
      const { rows } = this._read(store);
      const known = hashes[store] || {};
      rows.forEach((r,i)=>{ const id=this._docId(r,i); if(known[id]!==this._hash(r)) n++; });
    });
    return n;
  },

  // ── PUSH delta : envoie uniquement les lignes modifiées ──────────────────────
  async push(onProgress){
    if(this._busy) throw new Error('Sync déjà en cours');
    if(!this.configured()) throw new Error('Supabase non configuré');
    this._busy = true; this._emit('start','push');
    const meta = this._meta(); meta.hashes = meta.hashes || {};
    const device = this.deviceId(); const nowIso = new Date().toISOString();
    let totalSent = 0, errors = 0;

    try{
      for(const { store, label, kind } of this.STORES){
        const known = meta.hashes[store] || {};
        const fresh = {};
        const batch = [];
        if(kind==='doc'){
          const { data } = this._readDoc(store);
          if(data!=null){
            const h=this._hash(data); fresh['_full']=h;
            if(known['_full']!==h) batch.push({ store, doc_id:'_full', payload:data, updated_at:nowIso, device, deleted:false });
          }
        } else {
          const { rows } = this._read(store);
          rows.forEach((r,i)=>{
            const id = this._docId(r,i);
            const h  = this._hash(r);
            fresh[id] = h;
            if(known[id] !== h){
              batch.push({ store, doc_id:id, payload:r, updated_at:nowIso, device, deleted:false });
            }
          });
        }
        if(batch.length===0){ onProgress && onProgress({store,label,status:'skip',msg:'à jour'}); continue; }
        onProgress && onProgress({store,label,status:'pending',msg:batch.length+' modif.'});
        try{
          await this._fetch(this.TABLE, {
            method:'POST',
            headers:{ 'Prefer':'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(batch)
          });
          meta.hashes[store] = fresh;          // valide seulement après succès
          totalSent += batch.length;
          onProgress && onProgress({store,label,status:'ok',msg:batch.length+' envoyé(s)'});
        }catch(e){
          errors++;
          onProgress && onProgress({store,label,status:'error',msg:e.message});
        }
      }
      meta.lastPush = nowIso;
      this._saveMeta(meta);
      return { sent: totalSent, errors };
    } finally {
      this._busy = false; this._emit('end','push');
    }
  },

  // ── PULL incrémental : récupère ce qui a changé, merge non destructif ────────
  async pull(onProgress){
    if(this._busy) throw new Error('Sync déjà en cours');
    if(!this.configured()) throw new Error('Supabase non configuré');
    this._busy = true; this._emit('start','pull');
    const meta = this._meta();
    const since = meta.lastPull || '1970-01-01T00:00:00Z';
    let totalRecv = 0, errors = 0, maxTs = since;

    try{
      // Récupère tous les docs modifiés depuis le dernier pull (tri ascendant)
      let docs = [];
      try{
        const r = await this._fetch(
          this.TABLE+'?select=store,doc_id,payload,updated_at,deleted'+
          '&updated_at=gt.'+encodeURIComponent(since)+
          '&order=updated_at.asc&limit=10000');
        docs = await r.json();
      }catch(e){
        this._emit('end','pull');
        this._busy=false;
        throw e;
      }

      // Regroupe par store
      const byStore = {};
      docs.forEach(d=>{ (byStore[d.store]=byStore[d.store]||[]).push(d); if(d.updated_at>maxTs) maxTs=d.updated_at; });

      for(const { store, label, kind } of this.STORES){
        const incoming = byStore[store];
        if(!incoming || !incoming.length){ continue; }
        onProgress && onProgress({store,label,status:'pending',msg:incoming.length+' reçu(s)'});
        try{
          if(kind==='doc'){
            const full = incoming.filter(d=>!d.deleted).pop();   // dernier (tri asc)
            if(full) this._writeDoc(store, full.payload);
          } else {
            const { rows } = this._read(store);
            const map = new Map();
            rows.forEach((r,i)=> map.set(this._docId(r,i), r));
            incoming.forEach(d=>{
              if(d.deleted){ map.delete(d.doc_id); }
              else { map.set(d.doc_id, d.payload); }   // last-write-wins (tri asc)
            });
            this._write(store, Array.from(map.values()));
          }
          totalRecv += incoming.length;
          onProgress && onProgress({store,label,status:'ok',msg:incoming.length+' fusionné(s)'});
        }catch(e){
          errors++;
          onProgress && onProgress({store,label,status:'error',msg:e.message});
        }
      }
      meta.lastPull = maxTs;
      this._saveMeta(meta);
      return { received: totalRecv, errors };
    } finally {
      this._busy = false; this._emit('end','pull');
    }
  },

  // ── Sync complète : push puis pull ───────────────────────────────────────────
  async sync(onProgress){
    const p = await this.push(onProgress);
    const q = await this.pull(onProgress);
    const meta = this._meta(); meta.lastSync = new Date().toISOString(); this._saveMeta(meta);
    this._emit('synced', { ...p, ...q });
    return { ...p, ...q };
  },

  // ── Ping latence ──────────────────────────────────────────────────────────────
  async ping(){
    const t0 = Date.now();
    await this._fetch(this.TABLE+'?select=doc_id&limit=1');
    return Date.now()-t0;
  },

  // ── Auto-sync (réseau instable géré) ─────────────────────────────────────────
  startAuto(){
    if(this._auto) return;
    const tick = async ()=>{
      if(!navigator.onLine || this._busy || !this.configured()) return;
      try{ await this.sync(); }catch(e){ /* silencieux — reprise au prochain tick */ }
    };
    this._auto = setInterval(tick, this.AUTO_MS);
    window.addEventListener('online',  this._onUp = ()=>{ this._online=true; this._emit('online'); tick(); });
    window.addEventListener('offline', this._onDown = ()=>{ this._online=false; this._emit('offline'); });
    document.addEventListener('visibilitychange', this._onVis = ()=>{ if(!document.hidden) tick(); });
    localStorage.setItem('medicore_sync_auto','1');
    this._emit('auto', true);
    tick();
  },
  stopAuto(){
    if(this._auto){ clearInterval(this._auto); this._auto=null; }
    if(this._onUp)   window.removeEventListener('online',  this._onUp);
    if(this._onDown) window.removeEventListener('offline', this._onDown);
    if(this._onVis)  document.removeEventListener('visibilitychange', this._onVis);
    localStorage.setItem('medicore_sync_auto','0');
    this._emit('auto', false);
  },
  isAuto(){ return !!this._auto; },

  // ── Observateurs (UI) ─────────────────────────────────────────────────────────
  on(fn){ this._listeners.push(fn); },
  _emit(ev, data){ this._listeners.forEach(fn=>{ try{ fn(ev,data); }catch(e){} }); },

  status(){
    const meta = this._meta();
    return {
      online:   navigator.onLine,
      configured: this.configured(),
      auto:     this.isAuto(),
      busy:     this._busy,
      pending:  this.configured() ? this.pendingCount() : 0,
      lastSync: meta.lastSync || null,
      lastPush: meta.lastPush || null,
      lastPull: meta.lastPull || null,
      device:   this.deviceId(),
    };
  },

  // ── Reset (force re-push intégral) ───────────────────────────────────────────
  resetDeltas(){ const m=this._meta(); m.hashes={}; m.lastPull=null; this._saveMeta(m); },
};

// Reprise auto si activée à la dernière session
if(localStorage.getItem('medicore_sync_auto')==='1'){
  document.addEventListener('DOMContentLoaded', ()=>{ try{ MEDICORE_SYNC.startAuto(); }catch(e){} });
}

window.MEDICORE_SYNC = MEDICORE_SYNC;
