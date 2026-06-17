// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Audit unifié (traçabilité)
// ──────────────────────────────────────────────────────────────────────────────
// Journalise : CONNEXION, MODIFICATION, SUPPRESSION, CONSULTATION (dossiers), etc.
// Store 'audit' (synchronisé Supabase). Append-only côté usage.
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_AUDIT = {
  STORE:'audit', MAX:2000,
  TYPES:['CONNEXION','CONSULTATION','MODIFICATION','SUPPRESSION','CREATION','VALIDATION','ENCAISSEMENT','ACCES_REFUSE','SECURITE'],

  _read(){
    let raw;
    if(typeof MEDICORE_STORE!=='undefined') raw=MEDICORE_STORE.load(this.STORE, []);
    else { try{ const p=JSON.parse(localStorage.getItem('medicore_'+this.STORE)||'[]'); raw=Array.isArray(p)?p:(p.d||[]); }catch(e){ raw=[]; } }
    if(Array.isArray(raw)) return raw;
    if(raw && Array.isArray(raw.d)) return raw.d;
    return [];
  }
  },
  _write(rows){
    if(rows.length>this.MAX) rows.length=this.MAX;
    if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(this.STORE,rows,true);
    else localStorage.setItem('medicore_'+this.STORE,JSON.stringify({_v:1,_ts:Date.now(),d:rows}));
  },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  // log(action, type, detail, cible)
  log(action, type, detail, cible){
    const u=this._user();
    const rec={
      id:'AUD'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),
      ts:new Date().toISOString(),
      type:(type||'MODIFICATION').toUpperCase(),
      action:action||'', detail:detail||'', cible:cible||'',
      acteur:u.login||'anonyme', nom:u.nom||'', role:u.role||'',
      module:(location.pathname.split('/').pop()||'').replace('.html','')
    };
    const rows=this._read(); rows.unshift(rec); this._write(rows);
    return rec;
  },
  // Raccourcis sémantiques
  consultationDossier(patientId, nom){ return this.log('Consultation dossier patient','CONSULTATION',(nom||'')+' ('+patientId+')', patientId); },
  modification(quoi, detail){ return this.log(quoi,'MODIFICATION',detail||''); },
  suppression(quoi, detail){ return this.log(quoi,'SUPPRESSION',detail||''); },
  accesRefuse(perm){ return this.log('Accès refusé','ACCES_REFUSE','Permission requise : '+perm); },

  recent(n){ return this._read().slice(0, n||200); },
  parType(type){ return this._read().filter(r=>r.type===type); },

  renderTable(n){
    const list=this.recent(n||200);
    const ICON={CONNEXION:'🔑',CONSULTATION:'👁',MODIFICATION:'✎',SUPPRESSION:'🗑',CREATION:'＋',VALIDATION:'✅',ENCAISSEMENT:'💰',ACCES_REFUSE:'⛔',SECURITE:'🛡'};
    if(!list.length) return '<div style="padding:22px;text-align:center;color:var(--text-muted);font-size:13px">Aucune entrée d\'audit.</div>';
    return `<table><thead><tr><th>Date & heure</th><th>Type</th><th>Action</th><th>Détail</th><th>Acteur</th><th>Module</th></tr></thead><tbody>
      ${list.map(r=>`<tr>
        <td style="font-size:12px;white-space:nowrap">${new Date(r.ts).toLocaleString('fr-FR')}</td>
        <td><span class="badge" style="background:var(--surface-alt)">${ICON[r.type]||''} ${r.type}</span></td>
        <td style="font-size:12.5px">${r.action}</td>
        <td style="font-size:12px;color:var(--text-muted)">${r.detail||''}</td>
        <td style="font-size:12px">${r.nom||r.acteur}${r.role?`<div style="font-size:10.5px;color:var(--text-muted)">${r.role}</div>`:''}</td>
        <td style="font-size:11.5px;color:var(--text-muted)">${r.module||''}</td>
      </tr>`).join('')}</tbody></table>`;
  },
};
if(typeof window!=='undefined') window.MEDICORE_AUDIT = MEDICORE_AUDIT;
