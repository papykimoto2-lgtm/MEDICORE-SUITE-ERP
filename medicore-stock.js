// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Stock & consommables par dépôt
// ──────────────────────────────────────────────────────────────────────────────
// Gestion des consommables des départements (laboratoire, imagerie, bloc, autres) :
//   • inventaire par dépôt, entrées / sorties / transferts / ajustements
//   • seuils d'alerte + péremption, valorisation PMP, traçabilité des mouvements
// Distinct de la PUI (pharmacie) qui garde ses stores 'stock' / 'mouvements_stock'.
// Stores synchronisés : 'consommables' (items) et 'mouvements_consommables'.
// Usage : MEDICORE_STOCK.mount('id-conteneur', 'laboratoire');
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_STOCK = {
  S_ITEMS:'consommables', S_MVT:'mouvements_consommables',
  DEPOTS:{ laboratoire:'Laboratoire', imagerie:'Imagerie', bloc_operatoire:'Bloc opératoire',
           pharmacie_pui:'Pharmacie', maternite:'Maternité', urgences:'Urgences', magasin:'Magasin central' },
  CATEGORIES:['Réactif','Consommable médical','Film / imagerie','Dispositif',
              'Consommable chirurgical','Soluté','Matériel de prélèvement','Autre'],

  _read(s){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(s,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+s)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(s,rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(s,rows,true);
    else localStorage.setItem('medicore_'+s,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _uid(p){ return (p||'CS')+Date.now().toString(36)+Math.random().toString(36).slice(2,4); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  items(depot){ return this._read(this.S_ITEMS).filter(i=>i.depot===depot); },
  get(id){ return this._read(this.S_ITEMS).find(i=>i.id===id); },
  mouvements(depot){ return this._read(this.S_MVT).filter(m=>m.depot===depot || m.depot_dest===depot); },

  ajouterItem(depot, o){
    const items=this._read(this.S_ITEMS);
    const it={ id:this._uid('CS'), depot, designation:o.designation||'', categorie:o.categorie||'Consommable médical',
      unite:o.unite||'unité', stock:+o.stock||0, seuil:+o.seuil||0, pmp:+o.pmp||0,
      lot:o.lot||'', peremption:o.peremption||'' };
    items.unshift(it); this._write(this.S_ITEMS, items);
    if(it.stock>0) this._mvt(depot, it, 'Entrée', it.stock, { motif:'Stock initial' });
    return it;
  },
  _mvt(depot, item, sens, qte, opt){
    const mv=this._read(this.S_MVT);
    mv.unshift({ id:this._uid('MV'), depot, depot_dest:(opt&&opt.depot_dest)||'', item_id:item.id,
      designation:item.designation, sens, qte:+qte, motif:(opt&&opt.motif)||'', ref:(opt&&opt.ref)||'',
      patient:(opt&&opt.patient)||'', par:this._user().nom||'', date:new Date().toISOString() });
    if(mv.length>5000) mv.length=5000;
    this._write(this.S_MVT, mv);
  },
  _save(items){ this._write(this.S_ITEMS, items); },

  entree(depot, itemId, qte, opt){
    const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===itemId); if(!it) return null;
    it.stock+=(+qte||0); if(opt&&opt.lot) it.lot=opt.lot; if(opt&&opt.peremption) it.peremption=opt.peremption;
    this._save(items); this._mvt(depot, it, 'Entrée', qte, opt); return it;
  },
  sortie(depot, itemId, qte, opt){
    const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===itemId); if(!it) return null;
    qte=+qte||0; if(qte>it.stock) return { erreur:'stock insuffisant', dispo:it.stock };
    it.stock-=qte; this._save(items); this._mvt(depot, it, 'Sortie', qte, opt);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Sortie consommable','MODIFICATION',`${it.designation} ×${qte} (${this.DEPOTS[depot]||depot})`);
    return it;
  },
  ajuster(depot, itemId, nouveau, motif){
    const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===itemId); if(!it) return null;
    const diff=(+nouveau||0)-it.stock; it.stock=+nouveau||0; this._save(items);
    this._mvt(depot, it, 'Ajustement', diff, { motif:motif||'Inventaire' }); return it;
  },
  transfert(depotSrc, itemId, qte, depotDest){
    const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===itemId); if(!it) return null;
    qte=+qte||0; if(qte>it.stock) return { erreur:'stock insuffisant', dispo:it.stock };
    it.stock-=qte;
    let dst=items.find(i=>i.depot===depotDest && i.designation.toLowerCase()===it.designation.toLowerCase());
    if(dst) dst.stock+=qte;
    else { dst={ id:this._uid('CS'), depot:depotDest, designation:it.designation, categorie:it.categorie,
      unite:it.unite, stock:qte, seuil:it.seuil, pmp:it.pmp, lot:it.lot, peremption:it.peremption }; items.unshift(dst); }
    this._save(items);
    this._mvt(depotSrc, it, 'Transfert', qte, { motif:'Vers '+(this.DEPOTS[depotDest]||depotDest), depot_dest:depotDest });
    return { src:it, dst };
  },

  alertes(depot){
    const today=new Date(); const soon=new Date(Date.now()+30*86400000);
    return this.items(depot).filter(i=>{
      const rupture=i.stock<=0, bas=i.seuil>0 && i.stock<=i.seuil;
      const perime=i.peremption && new Date(i.peremption)<today;
      const perimeBientot=i.peremption && new Date(i.peremption)<=soon && new Date(i.peremption)>=today;
      return rupture||bas||perime||perimeBientot;
    }).map(i=>{
      const today2=new Date();
      let type='', label='';
      if(i.stock<=0){ type='rupture'; label='Rupture'; }
      else if(i.seuil>0 && i.stock<=i.seuil){ type='bas'; label='Stock bas'; }
      if(i.peremption && new Date(i.peremption)<today2){ type='perime'; label='Périmé'; }
      else if(i.peremption && new Date(i.peremption)<=new Date(Date.now()+30*86400000)){ type=type||'peremption'; label=label||'Péremption proche'; }
      return Object.assign({}, i, { _alerte:type, _label:label });
    });
  },
  valeurStock(depot){ return this.items(depot).reduce((s,i)=>s+i.stock*(i.pmp||0),0); },

  // ── UI : monte un panneau complet dans un conteneur ──────────────────────────
  mount(containerId, depot){
    this._depot=depot; this._cid=containerId; this.render();
  },
  render(){
    const div=document.getElementById(this._cid); if(!div) return;
    const depot=this._depot, items=this.items(depot), al=this.alertes(depot);
    const valeur=this.valeurStock(depot);
    div.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div><div style="font-size:15px;font-weight:600">Consommables — ${this.DEPOTS[depot]||depot}</div>
          <div style="font-size:12px;color:#6b6b6b">${items.length} référence(s) · valeur stock ${valeur.toLocaleString('fr-FR')} FCFA</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="MEDICORE_STOCK.uiAjout()">＋ Référence</button>
          <button class="btn btn-secondary btn-sm" onclick="MEDICORE_STOCK.uiMouvements()">📜 Mouvements</button>
        </div>
      </div>
      ${al.length?`<div style="background:#fdf3e7;border:1px solid #f0d4a8;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px">
        ⚠ ${al.length} alerte(s) : ${al.slice(0,4).map(i=>`${i.designation} <b>(${i._label})</b>`).join(' · ')}${al.length>4?' …':''}</div>`:''}
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;border-bottom:2px solid #eee;color:#6b6b6b;font-size:11.5px;text-transform:uppercase">
          <th style="padding:7px">Désignation</th><th>Catégorie</th><th style="text-align:right">Stock</th><th style="text-align:right">Seuil</th><th>Lot / Pérem.</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${items.length?items.map(i=>{
          const bas=i.seuil>0&&i.stock<=i.seuil, rupture=i.stock<=0;
          return `<tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:7px"><b>${i.designation}</b><div style="font-size:11px;color:#999">${i.unite}${i.pmp?' · '+i.pmp.toLocaleString('fr-FR')+' F':''}</div></td>
            <td style="font-size:12px;color:#6b6b6b">${i.categorie}</td>
            <td style="text-align:right;font-weight:600;color:${rupture?'#b91c1c':bas?'#c2410c':'#15803d'}">${i.stock}</td>
            <td style="text-align:right;color:#999">${i.seuil||'—'}</td>
            <td style="font-size:11.5px;color:#6b6b6b">${i.lot||'—'}${i.peremption?'<br>'+new Date(i.peremption).toLocaleDateString('fr-FR'):''}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-xs" style="background:#15803d;color:#fff" onclick="MEDICORE_STOCK.uiEntree('${i.id}')">＋</button>
              <button class="btn btn-xs" style="background:#c2410c;color:#fff" onclick="MEDICORE_STOCK.uiSortie('${i.id}')">−</button>
              <button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.uiTransfert('${i.id}')">⇄</button>
            </td></tr>`; }).join(''):'<tr><td colspan="6" style="padding:22px;text-align:center;color:#999">Aucune référence. Cliquez « ＋ Référence ».</td></tr>'}</tbody>
      </table>`;
  },
  _modal(html){ let ov=document.getElementById('ms-modal'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='ms-modal';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
    ov.innerHTML=`<div style="background:#fff;border-radius:10px;width:460px;max-width:96vw;max-height:84vh;overflow-y:auto;padding:20px">${html}</div>`;
    document.body.appendChild(ov); return ov;
  },
  _close(){ const m=document.getElementById('ms-modal'); if(m) m.remove(); },
  _fld(id,label,type,val){ return `<div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">${label}</label>
    <input id="${id}" type="${type||'text'}" value="${val||''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px"></div>`; },

  uiAjout(){
    this._modal(`<h3 style="margin:0 0 14px">Nouvelle référence</h3>
      ${this._fld('ms-des','Désignation')}
      <div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">Catégorie</label>
        <select id="ms-cat" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${this.CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${this._fld('ms-unite','Unité','text','unité')}${this._fld('ms-pmp','Prix unitaire (PMP)','number')}
        ${this._fld('ms-stock','Stock initial','number')}${this._fld('ms-seuil','Seuil d\'alerte','number')}
        ${this._fld('ms-lot','Lot')}${this._fld('ms-perem','Péremption','date')}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.saveAjout()">Enregistrer</button></div>`);
  },
  saveAjout(){
    const v=id=>document.getElementById(id).value;
    if(!v('ms-des').trim()){ alert('Désignation requise.'); return; }
    this.ajouterItem(this._depot, { designation:v('ms-des').trim(), categorie:v('ms-cat'), unite:v('ms-unite'),
      pmp:v('ms-pmp'), stock:v('ms-stock'), seuil:v('ms-seuil'), lot:v('ms-lot'), peremption:v('ms-perem') });
    this._close(); this.render();
  },
  uiEntree(id){ const it=this.get(id); this._modal(`<h3 style="margin:0 0 12px">Entrée — ${it.designation}</h3>
    ${this._fld('ms-q','Quantité reçue','number')}${this._fld('ms-lot2','Lot (option)')}${this._fld('ms-pe','Péremption (option)','date')}${this._fld('ms-mo','Motif','text','Réception')}
    <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
    <button class="btn btn-primary" onclick="MEDICORE_STOCK.doEntree('${id}')">Valider</button></div>`); },
  doEntree(id){ const q=+document.getElementById('ms-q').value; if(!q){ this._close(); return; }
    this.entree(this._depot,id,q,{ motif:document.getElementById('ms-mo').value, lot:document.getElementById('ms-lot2').value, peremption:document.getElementById('ms-pe').value });
    this._close(); this.render(); },
  uiSortie(id){ const it=this.get(id); this._modal(`<h3 style="margin:0 0 12px">Sortie — ${it.designation}</h3>
    <div style="font-size:12px;color:#6b6b6b;margin-bottom:8px">Stock actuel : <b>${it.stock} ${it.unite}</b></div>
    ${this._fld('ms-q','Quantité consommée','number')}${this._fld('ms-mo','Motif / acte','text','Consommation')}${this._fld('ms-pat','Patient (option)')}
    <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
    <button class="btn btn-primary" onclick="MEDICORE_STOCK.doSortie('${id}')">Valider</button></div>`); },
  doSortie(id){ const q=+document.getElementById('ms-q').value; if(!q){ this._close(); return; }
    const r=this.sortie(this._depot,id,q,{ motif:document.getElementById('ms-mo').value, patient:document.getElementById('ms-pat').value });
    if(r&&r.erreur){ alert('Stock insuffisant (dispo : '+r.dispo+').'); return; }
    this._close(); this.render(); },
  uiTransfert(id){ const it=this.get(id); const opts=Object.keys(this.DEPOTS).filter(d=>d!==this._depot).map(d=>`<option value="${d}">${this.DEPOTS[d]}</option>`).join('');
    this._modal(`<h3 style="margin:0 0 12px">Transfert — ${it.designation}</h3>
    <div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">Dépôt destination</label>
      <select id="ms-dest" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${opts}</select></div>
    ${this._fld('ms-q','Quantité','number')}
    <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
    <button class="btn btn-primary" onclick="MEDICORE_STOCK.doTransfert('${id}')">Transférer</button></div>`); },
  doTransfert(id){ const q=+document.getElementById('ms-q').value; const dest=document.getElementById('ms-dest').value; if(!q){ this._close(); return; }
    const r=this.transfert(this._depot,id,q,dest); if(r&&r.erreur){ alert('Stock insuffisant (dispo : '+r.dispo+').'); return; }
    this._close(); this.render(); },
  uiMouvements(){ const mv=this.mouvements(this._depot).slice(0,200);
    this._modal(`<h3 style="margin:0 0 12px">Mouvements — ${this.DEPOTS[this._depot]||this._depot}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="text-align:left;color:#6b6b6b;border-bottom:1px solid #eee"><th style="padding:5px">Date</th><th>Article</th><th>Sens</th><th style="text-align:right">Qté</th><th>Motif</th></tr></thead>
        <tbody>${mv.length?mv.map(m=>`<tr style="border-bottom:1px solid #f3f3f3"><td style="padding:5px;white-space:nowrap">${new Date(m.date).toLocaleString('fr-FR')}</td>
          <td>${m.designation}</td><td>${m.sens}</td><td style="text-align:right">${m.qte}</td><td style="color:#6b6b6b">${m.motif||''}${m.patient?' · '+m.patient:''}</td></tr>`).join(''):'<tr><td colspan="5" style="padding:18px;text-align:center;color:#999">Aucun mouvement.</td></tr>'}</tbody></table>
      <div style="text-align:right;margin-top:12px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Fermer</button></div>`); },
};
if(typeof window!=='undefined') window.MEDICORE_STOCK = MEDICORE_STOCK;
