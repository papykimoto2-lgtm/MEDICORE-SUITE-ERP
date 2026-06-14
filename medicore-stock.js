// ══════════════════════════════════════════════════════════════════════════════
// MediCore ERP — Stock & consommables multi-dépôts (niveau ERP)
// ──────────────────────────────────────────────────────────────────────────────
//  • Dépôts paramétrables (créés dans Paramétrage)         → store 'depots_stock'
//  • Valorisation PMP par dépôt (PMP recalculé à l'entrée)
//  • Péremption (FEFO) + alertes par dépôt
//  • Stock mini (point de commande) + stock de sécurité + stock maxi (cible)
//  • Transferts dépôt → dépôt (bon de transfert tracé)
//  • Réapprovisionnement automatique (propositions + exécution depuis le magasin
//    central, sinon bon de commande)                       → store 'reappro'
//  Stores : 'consommables', 'mouvements_consommables', 'depots_stock', 'reappro'
//  Usage  : MEDICORE_STOCK.mount('conteneur', 'laboratoire');
// ══════════════════════════════════════════════════════════════════════════════

const MEDICORE_STOCK = {
  S_ITEMS:'consommables', S_MVT:'mouvements_consommables', S_DEPOTS:'depots_stock', S_REAP:'reappro',
  MAGASIN:'magasin',
  DEPOTS_DEFAUT:{ magasin:'Magasin central', pharmacie_pui:'Pharmacie', laboratoire:'Laboratoire',
    imagerie:'Imagerie', bloc_operatoire:'Bloc opératoire', maternite:'Maternité', urgences:'Urgences' },
  CATEGORIES:['Réactif','Consommable médical','Film / imagerie','Dispositif',
              'Consommable chirurgical','Soluté','Matériel de prélèvement','Autre'],

  _read(s){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(s,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+s)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(s,rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(s,rows,true);
    else localStorage.setItem('medicore_'+s,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _uid(p){ return (p||'CS')+Date.now().toString(36)+Math.random().toString(36).slice(2,4); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  // ── Dépôts (paramétrables) ───────────────────────────────────────────────────
  depots(){
    const custom=this._read(this.S_DEPOTS), map={};
    Object.keys(this.DEPOTS_DEFAUT).forEach(k=>map[k]={ id:k, libelle:this.DEPOTS_DEFAUT[k], actif:true, builtin:true });
    custom.forEach(d=>{ map[d.id]={ id:d.id, libelle:d.libelle, responsable:d.responsable||'', actif:d.actif!==false, builtin:false }; });
    return Object.values(map);
  },
  depotsActifs(){ return this.depots().filter(d=>d.actif); },
  depotLabel(id){ const d=this.depots().find(x=>x.id===id); return d?d.libelle:id; },
  ajouterDepot(o){ const list=this._read(this.S_DEPOTS);
    const id=o.id||(o.libelle||'depot').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    if(list.some(d=>d.id===id) || this.DEPOTS_DEFAUT[id]) return { erreur:'existe déjà' };
    list.push({ id, libelle:o.libelle||id, responsable:o.responsable||'', actif:true }); this._write(this.S_DEPOTS,list); return { id }; },
  modifierDepot(id,patch){ const list=this._read(this.S_DEPOTS); const d=list.find(x=>x.id===id);
    if(d){ Object.assign(d,patch); this._write(this.S_DEPOTS,list); } return d; },
  supprimerDepot(id){ if(this.DEPOTS_DEFAUT[id]) return { erreur:'dépôt système' };
    if(this.items(id).length) return { erreur:'dépôt non vide' };
    this._write(this.S_DEPOTS, this._read(this.S_DEPOTS).filter(d=>d.id!==id)); return { ok:true }; },

  // ── Articles ──────────────────────────────────────────────────────────────────
  items(depot){ return this._read(this.S_ITEMS).filter(i=>i.depot===depot); },
  get(id){ return this._read(this.S_ITEMS).find(i=>i.id===id); },
  _norm(i){ if(i.stock_min==null && i.seuil!=null) i.stock_min=i.seuil; if(i.stock_min==null) i.stock_min=0;
    if(i.stock_secu==null) i.stock_secu=0; if(i.stock_max==null) i.stock_max=0; return i; },
  mouvements(depot){ return this._read(this.S_MVT).filter(m=>m.depot===depot || m.depot_dest===depot); },

  ajouterItem(depot, o){
    const items=this._read(this.S_ITEMS);
    const it=this._norm({ id:this._uid('CS'), depot, designation:o.designation||'', categorie:o.categorie||'Consommable médical',
      unite:o.unite||'unité', stock:+o.stock||0, stock_min:+o.stock_min||+o.seuil||0,
      stock_secu:+o.stock_secu||0, stock_max:+o.stock_max||0, pmp:+o.pmp||0, lot:o.lot||'', peremption:o.peremption||'' });
    items.unshift(it); this._write(this.S_ITEMS, items);
    if(it.stock>0) this._mvt(depot, it, 'Entrée', it.stock, { motif:'Stock initial' });
    return it;
  },
  modifierItem(id,patch){ const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===id);
    if(it){ Object.assign(it,patch); this._norm(it); this._write(this.S_ITEMS,items); } return it; },
  _mvt(depot, item, sens, qte, opt){
    const mv=this._read(this.S_MVT);
    mv.unshift({ id:this._uid('MV'), depot, depot_dest:(opt&&opt.depot_dest)||'', item_id:item.id,
      designation:item.designation, sens, qte:+qte, motif:(opt&&opt.motif)||'', ref:(opt&&opt.ref)||'',
      patient:(opt&&opt.patient)||'', par:this._user().nom||'', date:new Date().toISOString() });
    if(mv.length>5000) mv.length=5000; this._write(this.S_MVT, mv);
  },
  _save(items){ this._write(this.S_ITEMS, items); },

  entree(depot, itemId, qte, opt){
    const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===itemId); if(!it) return null;
    qte=+qte||0; opt=opt||{};
    if(opt.prix!=null && qte>0){ const a=it.stock*(it.pmp||0), n=qte*(+opt.prix);
      it.pmp=Math.round((a+n)/((it.stock+qte)||1)); }
    it.stock+=qte; if(opt.lot) it.lot=opt.lot; if(opt.peremption) it.peremption=opt.peremption;
    this._save(items); this._mvt(depot, it, 'Entrée', qte, opt); return it;
  },
  sortie(depot, itemId, qte, opt){
    const items=this._read(this.S_ITEMS); const it=items.find(i=>i.id===itemId); if(!it) return null;
    qte=+qte||0; if(qte>it.stock) return { erreur:'stock insuffisant', dispo:it.stock };
    it.stock-=qte; this._save(items); this._mvt(depot, it, 'Sortie', qte, opt);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Sortie consommable','MODIFICATION',`${it.designation} ×${qte} (${this.depotLabel(depot)})`);
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
    let dst=items.find(i=>i.depot===depotDest && (i.designation||'').toLowerCase()===(it.designation||'').toLowerCase());
    if(dst) dst.stock+=qte;
    else { dst=this._norm({ id:this._uid('CS'), depot:depotDest, designation:it.designation, categorie:it.categorie,
      unite:it.unite, stock:qte, stock_min:it.stock_min, stock_secu:it.stock_secu, stock_max:it.stock_max,
      pmp:it.pmp, lot:it.lot, peremption:it.peremption }); items.unshift(dst); }
    this._save(items);
    this._mvt(depotSrc, it, 'Transfert', qte, { motif:'Vers '+this.depotLabel(depotDest), depot_dest:depotDest });
    return { src:it, dst };
  },

  alertes(depot){
    const today=new Date(), soon=new Date(Date.now()+30*86400000); const out=[];
    this.items(depot).map(i=>this._norm(i)).forEach(i=>{
      let type='', label='';
      if(i.stock<=0){ type='rupture'; label='Rupture'; }
      else if(i.stock_secu>0 && i.stock<=i.stock_secu){ type='securite'; label='Sous stock de sécurité'; }
      else if(i.stock_min>0 && i.stock<=i.stock_min){ type='mini'; label='À commander (≤ mini)'; }
      if(i.peremption && new Date(i.peremption)<today){ type='perime'; label='Périmé'; }
      else if(i.peremption && new Date(i.peremption)<=soon && new Date(i.peremption)>=today){ if(!type){ type='peremption'; label='Péremption < 30j'; } }
      if(type) out.push(Object.assign({}, i, { _alerte:type, _label:label }));
    });
    return out;
  },
  valeurStock(depot){ return this.items(depot).reduce((s,i)=>s+i.stock*(i.pmp||0),0); },

  // ── Réapprovisionnement automatique ──────────────────────────────────────────
  reapproSuggestions(depot){
    const mag=this.items(this.MAGASIN);
    return this.items(depot).map(i=>this._norm(i)).filter(i=>i.stock_min>0 && i.stock<=i.stock_min).map(i=>{
      const cible=i.stock_max>0?i.stock_max:(i.stock_min+i.stock_secu);
      const qte=Math.max(0, cible-i.stock);
      const src=mag.find(m=>(m.designation||'').toLowerCase()===(i.designation||'').toLowerCase());
      return { item_id:i.id, designation:i.designation, unite:i.unite, stock:i.stock, stock_min:i.stock_min,
        stock_secu:i.stock_secu, cible, qte_proposee:qte, dispo_magasin:src?src.stock:0, magasin_item:src?src.id:null };
    });
  },
  executerReappro(depot, lignes){
    const bons=this._read(this.S_REAP); const res={ transferes:0, commandes:0 };
    lignes.forEach(l=>{ const q=+l.qte||0; if(q<=0) return;
      if(l.magasin_item && l.dispo_magasin>=q){ this.transfert(this.MAGASIN, l.magasin_item, q, depot); res.transferes++; }
      else { bons.unshift({ id:this._uid('REA'), depot, designation:l.designation, qte:q, unite:l.unite||'',
        statut:'À commander', motif:'Réappro auto', date:new Date().toISOString(), par:this._user().nom||'' }); res.commandes++; } });
    if(res.commandes) this._write(this.S_REAP, bons);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Réapprovisionnement','CREATION',
      `${this.depotLabel(depot)} — ${res.transferes} transfert(s), ${res.commandes} à commander`);
    return res;
  },
  bonsReappro(depot){ return this._read(this.S_REAP).filter(b=>!depot||b.depot===depot); },

  // ── UI ───────────────────────────────────────────────────────────────────────
  mount(containerId, depot){ this._depot=depot; this._cid=containerId; this.render(); },
  render(){
    const div=document.getElementById(this._cid); if(!div) return;
    const depot=this._depot, items=this.items(depot).map(i=>this._norm(i)), al=this.alertes(depot);
    const valeur=this.valeurStock(depot), aCmd=this.reapproSuggestions(depot).length;
    div.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div><div style="font-size:15px;font-weight:600">Consommables — ${this.depotLabel(depot)}</div>
          <div style="font-size:12px;color:#6b6b6b">${items.length} référence(s) · valeur stock <b>${valeur.toLocaleString('fr-FR')} FCFA</b></div></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="MEDICORE_STOCK.uiAjout()">＋ Référence</button>
          <button class="btn btn-sm" style="background:#c2410c;color:#fff" onclick="MEDICORE_STOCK.uiReappro()">♻ Réappro${aCmd?' ('+aCmd+')':''}</button>
          <button class="btn btn-secondary btn-sm" onclick="MEDICORE_STOCK.uiMouvements()">📜 Mouvements</button>
        </div>
      </div>
      ${al.length?`<div style="background:#fdf3e7;border:1px solid #f0d4a8;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px">
        ⚠ ${al.length} alerte(s) : ${al.slice(0,4).map(i=>`${i.designation} <b>(${i._label})</b>`).join(' · ')}${al.length>4?' …':''}</div>`:''}
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;border-bottom:2px solid #eee;color:#6b6b6b;font-size:11.5px;text-transform:uppercase">
          <th style="padding:7px">Désignation</th><th>Catégorie</th><th style="text-align:right">Stock</th>
          <th style="text-align:right">Mini</th><th style="text-align:right">Sécu</th><th style="text-align:right">PMP</th>
          <th>Lot / Pérem.</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>${items.length?items.map(i=>{
          const rupture=i.stock<=0, secu=i.stock_secu>0&&i.stock<=i.stock_secu, mini=i.stock_min>0&&i.stock<=i.stock_min;
          const col=rupture?'#b91c1c':secu?'#c2410c':mini?'#b58100':'#15803d';
          return `<tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:7px"><b>${i.designation}</b><div style="font-size:11px;color:#999">${i.unite}</div></td>
            <td style="font-size:12px;color:#6b6b6b">${i.categorie}</td>
            <td style="text-align:right;font-weight:600;color:${col}">${i.stock}</td>
            <td style="text-align:right;color:#999">${i.stock_min||'—'}</td>
            <td style="text-align:right;color:#999">${i.stock_secu||'—'}</td>
            <td style="text-align:right;color:#6b6b6b">${(i.pmp||0).toLocaleString('fr-FR')}</td>
            <td style="font-size:11.5px;color:#6b6b6b">${i.lot||'—'}${i.peremption?'<br>'+new Date(i.peremption).toLocaleDateString('fr-FR'):''}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-xs" style="background:#15803d;color:#fff" onclick="MEDICORE_STOCK.uiEntree('${i.id}')">＋</button>
              <button class="btn btn-xs" style="background:#c2410c;color:#fff" onclick="MEDICORE_STOCK.uiSortie('${i.id}')">−</button>
              <button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.uiTransfert('${i.id}')">⇄</button>
              <button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.uiEdit('${i.id}')">✎</button>
            </td></tr>`; }).join(''):'<tr><td colspan="8" style="padding:22px;text-align:center;color:#999">Aucune référence. Cliquez « ＋ Référence ».</td></tr>'}</tbody>
      </table>`;
  },
  _modal(html,w){ let ov=document.getElementById('ms-modal'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='ms-modal';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
    ov.innerHTML=`<div style="background:#fff;border-radius:10px;width:${w||460}px;max-width:96vw;max-height:84vh;overflow-y:auto;padding:20px">${html}</div>`;
    document.body.appendChild(ov); return ov; },
  _close(){ const m=document.getElementById('ms-modal'); if(m) m.remove(); },
  _fld(id,label,type,val){ return `<div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">${label}</label>
    <input id="${id}" type="${type||'text'}" value="${val==null?'':val}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px"></div>`; },
  _formItem(it){ it=it||{}; return `
      ${this._fld('ms-des','Désignation',null,it.designation)}
      <div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">Catégorie</label>
        <select id="ms-cat" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${this.CATEGORIES.map(c=>`<option ${it.categorie===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        ${this._fld('ms-unite','Unité',null,it.unite||'unité')}${this._fld('ms-pmp','PMP (FCFA)','number',it.pmp)}${this._fld('ms-stock','Stock'+(it.id?' (lecture)':' initial'),'number',it.stock)}
        ${this._fld('ms-min','Stock mini','number',it.stock_min)}${this._fld('ms-secu','Stock sécurité','number',it.stock_secu)}${this._fld('ms-max','Stock maxi (cible)','number',it.stock_max)}
        ${this._fld('ms-lot','Lot',null,it.lot)}${this._fld('ms-perem','Péremption','date',it.peremption)}
      </div>`; },
  uiAjout(){ this._modal(`<h3 style="margin:0 0 14px">Nouvelle référence</h3>${this._formItem()}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.saveAjout()">Enregistrer</button></div>`,520); },
  saveAjout(){ const v=id=>document.getElementById(id).value;
    if(!v('ms-des').trim()){ alert('Désignation requise.'); return; }
    this.ajouterItem(this._depot, { designation:v('ms-des').trim(), categorie:v('ms-cat'), unite:v('ms-unite'),
      pmp:v('ms-pmp'), stock:v('ms-stock'), stock_min:v('ms-min'), stock_secu:v('ms-secu'), stock_max:v('ms-max'),
      lot:v('ms-lot'), peremption:v('ms-perem') });
    this._close(); this.render(); },
  uiEdit(id){ const it=this.get(id); this._modal(`<h3 style="margin:0 0 14px">Modifier — ${it.designation}</h3>${this._formItem(it)}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.saveEdit('${id}')">Enregistrer</button></div>`,520); },
  saveEdit(id){ const v=x=>document.getElementById(x).value;
    this.modifierItem(id,{ designation:v('ms-des').trim(), categorie:v('ms-cat'), unite:v('ms-unite'),
      pmp:+v('ms-pmp')||0, stock_min:+v('ms-min')||0, stock_secu:+v('ms-secu')||0, stock_max:+v('ms-max')||0,
      lot:v('ms-lot'), peremption:v('ms-perem') });
    this._close(); this.render(); },
  uiEntree(id){ const it=this.get(id); this._modal(`<h3 style="margin:0 0 12px">Entrée — ${it.designation}</h3>
    ${this._fld('ms-q','Quantité reçue','number')}${this._fld('ms-prix',"Prix d'achat unitaire (recalcule le PMP)",'number')}${this._fld('ms-lot2','Lot (option)')}${this._fld('ms-pe','Péremption (option)','date')}${this._fld('ms-mo','Motif','text','Réception')}
    <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
    <button class="btn btn-primary" onclick="MEDICORE_STOCK.doEntree('${id}')">Valider</button></div>`); },
  doEntree(id){ const q=+document.getElementById('ms-q').value; if(!q){ this._close(); return; }
    const prix=document.getElementById('ms-prix').value;
    this.entree(this._depot,id,q,{ motif:document.getElementById('ms-mo').value, lot:document.getElementById('ms-lot2').value,
      peremption:document.getElementById('ms-pe').value, prix:prix!==''?+prix:null });
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
  uiTransfert(id){ const it=this.get(id); const opts=this.depotsActifs().filter(d=>d.id!==this._depot).map(d=>`<option value="${d.id}">${d.libelle}</option>`).join('');
    this._modal(`<h3 style="margin:0 0 12px">Transfert — ${it.designation}</h3>
    <div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">Dépôt destination</label>
      <select id="ms-dest" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${opts}</select></div>
    ${this._fld('ms-q','Quantité','number')}
    <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
    <button class="btn btn-primary" onclick="MEDICORE_STOCK.doTransfert('${id}')">Transférer</button></div>`); },
  doTransfert(id){ const q=+document.getElementById('ms-q').value; const dest=document.getElementById('ms-dest').value; if(!q){ this._close(); return; }
    const r=this.transfert(this._depot,id,q,dest); if(r&&r.erreur){ alert('Stock insuffisant (dispo : '+r.dispo+').'); return; }
    this._close(); this.render(); },
  uiReappro(){ const sug=this.reapproSuggestions(this._depot);
    if(!sug.length){ this._modal(`<h3 style="margin:0 0 10px">Réapprovisionnement</h3><div style="color:#15803d;padding:10px 0">✅ Aucun article sous le stock mini.</div>
      <div style="text-align:right"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Fermer</button></div>`); return; }
    this._modal(`<h3 style="margin:0 0 6px">Réapprovisionnement automatique — ${this.depotLabel(this._depot)}</h3>
      <div style="font-size:12px;color:#6b6b6b;margin-bottom:12px">Transfert depuis le magasin si dispo, sinon bon de commande.</div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="text-align:left;color:#6b6b6b;border-bottom:1px solid #eee"><th style="padding:5px">Article</th><th style="text-align:right">Stock</th><th style="text-align:right">Mini</th><th style="text-align:right">Cible</th><th style="text-align:right">Magasin</th><th style="text-align:right">À réappro.</th></tr></thead>
        <tbody>${sug.map((s,idx)=>`<tr style="border-bottom:1px solid #f3f3f3">
          <td style="padding:5px"><b>${s.designation}</b></td><td style="text-align:right">${s.stock}</td><td style="text-align:right">${s.stock_min}</td>
          <td style="text-align:right">${s.cible}</td><td style="text-align:right;color:${s.dispo_magasin>=s.qte_proposee?'#15803d':'#c2410c'}">${s.dispo_magasin}</td>
          <td style="text-align:right"><input id="rea-q-${idx}" type="number" value="${s.qte_proposee}" style="width:64px;padding:5px;border:1px solid #ddd;border-radius:5px;text-align:right"></td></tr>`).join('')}</tbody></table>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.doReappro()">♻ Générer le réappro</button></div>`,640);
    this._sug=sug; },
  doReappro(){ const lignes=this._sug.map((s,idx)=>Object.assign({}, s, { qte:+document.getElementById('rea-q-'+idx).value||0 }));
    const r=this.executerReappro(this._depot, lignes); this._close(); this.render();
    alert('Réappro généré : '+r.transferes+' transfert(s) depuis le magasin, '+r.commandes+' ligne(s) à commander.'); },
  uiMouvements(){ const mv=this.mouvements(this._depot).slice(0,200);
    this._modal(`<h3 style="margin:0 0 12px">Mouvements — ${this.depotLabel(this._depot)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="text-align:left;color:#6b6b6b;border-bottom:1px solid #eee"><th style="padding:5px">Date</th><th>Article</th><th>Sens</th><th style="text-align:right">Qté</th><th>Motif</th></tr></thead>
        <tbody>${mv.length?mv.map(m=>`<tr style="border-bottom:1px solid #f3f3f3"><td style="padding:5px;white-space:nowrap">${new Date(m.date).toLocaleString('fr-FR')}</td>
          <td>${m.designation}</td><td>${m.sens}</td><td style="text-align:right">${m.qte}</td><td style="color:#6b6b6b">${m.motif||''}${m.patient?' · '+m.patient:''}</td></tr>`).join(''):'<tr><td colspan="5" style="padding:18px;text-align:center;color:#999">Aucun mouvement.</td></tr>'}</tbody></table>
      <div style="text-align:right;margin-top:12px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Fermer</button></div>`,640); },
};
if(typeof window!=='undefined') window.MEDICORE_STOCK = MEDICORE_STOCK;
