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
  S_PRODUITS:'produits_catalogue', S_FAMILLES:'familles_produits',
  MAGASIN:'magasin',
  DEPOTS_DEFAUT:{ magasin:'Magasin central', pharmacie_pui:'Pharmacie', laboratoire:'Laboratoire',
    imagerie:'Imagerie', bloc_operatoire:'Bloc opératoire', maternite:'Maternité', urgences:'Urgences' },
  CATEGORIES:['Réactif','Consommable médical','Film / imagerie','Dispositif',
              'Consommable chirurgical','Soluté','Matériel de prélèvement','Autre'],
  // Familles par défaut (paramétrables ensuite). type = nature du produit.
  FAMILLES_DEFAUT:[
    { id:'medicament',   libelle:'Médicament',                 type:'medicament' },
    { id:'reactif',      libelle:'Réactif de laboratoire',     type:'reactif'    },
    { id:'consommable',  libelle:'Consommable médical',        type:'consommable'},
    { id:'dispositif',   libelle:'Dispositif médical',         type:'dispositif' },
    { id:'solute',       libelle:'Soluté & perfusion',         type:'solute'     },
    { id:'imagerie',     libelle:'Film & consommable imagerie',type:'imagerie'   },
    { id:'chirurgie',    libelle:'Consommable chirurgical',    type:'chirurgie'  },
    { id:'prelevement',  libelle:'Matériel de prélèvement',    type:'prelevement'},
  ],
  FORMES:['Comprimé','Gélule','Sirop','Ampoule injectable','Flacon','Poche','Pommade','Crème',
          'Suppositoire','Collyre','Spray','Sachet','Unité','Boîte','Kit','Paire','Rouleau','Autre'],
  UNITES:['unité','boîte','flacon','ampoule','comprimé','gélule','sachet','poche','tube','kit','paire','rouleau','mL','L','g','kg'],

  _read(s){ if(typeof MEDICORE_STORE!=='undefined') return MEDICORE_STORE.load(s,[]);
    try{ const p=JSON.parse(localStorage.getItem('medicore_'+s)||'[]'); return Array.isArray(p)?p:(p.d||[]); }catch(e){ return []; } },
  _write(s,rows){ if(typeof MEDICORE_STORE!=='undefined') MEDICORE_STORE.save(s,rows,true);
    else localStorage.setItem('medicore_'+s,JSON.stringify({_v:1,_ts:Date.now(),d:rows})); },
  _uid(p){ return (p||'CS')+Date.now().toString(36)+Math.random().toString(36).slice(2,4); },
  _user(){ try{ return JSON.parse(sessionStorage.getItem('medicore_user')||'{}'); }catch(e){ return {}; } },

  // ── Familles de produits (paramétrables) ─────────────────────────────────────
  familles(){
    const custom=this._read(this.S_FAMILLES);
    return custom.length?custom:this.FAMILLES_DEFAUT.slice();
  },
  familleLabel(id){ const f=this.familles().find(x=>x.id===id); return f?f.libelle:(id||'—'); },
  ajouterFamille(o){
    const list=this._read(this.S_FAMILLES); const base=list.length?list:this.FAMILLES_DEFAUT.slice();
    const id=o.id||(o.libelle||'fam').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    if(base.some(f=>f.id===id)) return {erreur:'existe'};
    base.push({ id, libelle:o.libelle||id, type:o.type||'consommable' }); this._write(this.S_FAMILLES, base); return {id};
  },
  modifierFamille(id,patch){ const list=this._read(this.S_FAMILLES); const base=list.length?list:this.FAMILLES_DEFAUT.slice();
    const f=base.find(x=>x.id===id); if(f){ Object.assign(f,patch); this._write(this.S_FAMILLES, base); } return f; },
  supprimerFamille(id){ const base=this._read(this.S_FAMILLES); if(!base.length){ this._write(this.S_FAMILLES, this.FAMILLES_DEFAUT.slice()); }
    if(this.produits().some(p=>p.famille===id)) return {erreur:'famille_utilisee'};
    this._write(this.S_FAMILLES, this._read(this.S_FAMILLES).filter(f=>f.id!==id)); return {ok:true}; },

  // ── Catalogue produits (défini une fois, affecté à plusieurs dépôts) ──────────
  produits(){ return this._read(this.S_PRODUITS); },
  produit(id){ return this._read(this.S_PRODUITS).find(p=>p.id===id); },
  _genCode(famille){
    const prefix=(famille||'PRD').slice(0,3).toUpperCase();
    const n=this.produits().filter(p=>(p.code||'').startsWith(prefix)).length+1;
    return prefix+'-'+String(n).padStart(4,'0');
  },
  // Fiche produit complète (médical & paramédical)
  ajouterProduit(o){
    const list=this._read(this.S_PRODUITS);
    if(o.code && list.some(p=>p.code===o.code)) return {erreur:'code_existe'};
    const p={ id:this._uid('PRD'),
      code:o.code||this._genCode(o.famille), designation:o.designation||'',
      famille:o.famille||'consommable', categorie:o.categorie||'',
      dci:o.dci||'', forme:o.forme||'', dosage:o.dosage||'', conditionnement:o.conditionnement||'',
      unite:o.unite||'unité', code_barre:o.code_barre||'',
      fournisseur:o.fournisseur||'', prix_achat:+o.prix_achat||0, tva:o.tva!=null?+o.tva:0,
      stupefiant:!!o.stupefiant, thermosensible:!!o.thermosensible, gere_lot:o.gere_lot!==false, gere_peremption:o.gere_peremption!==false,
      stock_min:+o.stock_min||0, stock_secu:+o.stock_secu||0, stock_max:+o.stock_max||0,
      actif:true, created_at:new Date().toISOString(), created_par:this._user().nom||'' };
    list.unshift(p); this._write(this.S_PRODUITS, list);
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Création produit','CREATION',`${p.code} — ${p.designation}`, p.code);
    return p;
  },
  modifierProduit(id,patch){ const list=this._read(this.S_PRODUITS); const p=list.find(x=>x.id===id);
    if(p){ Object.assign(p,patch); this._write(this.S_PRODUITS, list); } return p; },
  supprimerProduit(id){ const p=this.produit(id); if(!p) return {erreur:'introuvable'};
    // Vérifie qu'aucun stock affecté ne subsiste
    if(this._read(this.S_ITEMS).some(i=>i.produit_id===id && i.stock>0)) return {erreur:'stock_present'};
    this._write(this.S_PRODUITS, this._read(this.S_PRODUITS).filter(x=>x.id!==id));
    this._write(this.S_ITEMS, this._read(this.S_ITEMS).filter(i=>i.produit_id!==id));
    return {ok:true};
  },

  // Affecter un produit du catalogue à un dépôt (crée la ligne de stock si absente)
  affecterProduit(produitId, depot, opt){
    opt=opt||{}; const p=this.produit(produitId); if(!p) return {erreur:'produit_introuvable'};
    const items=this._read(this.S_ITEMS);
    let it=items.find(i=>i.produit_id===produitId && i.depot===depot);
    if(it){ return {erreur:'deja_affecte', item:it}; }
    it=this._norm({ id:this._uid('CS'), produit_id:produitId, depot,
      designation:p.designation, categorie:p.categorie||this.familleLabel(p.famille), unite:p.unite,
      stock:+opt.stock||0, stock_min:opt.stock_min!=null?+opt.stock_min:p.stock_min,
      stock_secu:opt.stock_secu!=null?+opt.stock_secu:p.stock_secu, stock_max:opt.stock_max!=null?+opt.stock_max:p.stock_max,
      pmp:p.prix_achat||0, lot:opt.lot||'', peremption:opt.peremption||'' });
    items.unshift(it); this._write(this.S_ITEMS, items);
    if(it.stock>0) this._mvt(depot, it, 'Entrée', it.stock, {motif:'Stock initial (affectation)'});
    if(typeof MEDICORE_AUDIT!=='undefined') MEDICORE_AUDIT.log('Affectation produit','CREATION',`${p.designation} → ${this.depotLabel(depot)}`, p.code);
    return {item:it};
  },
  // Dépôts où un produit est présent
  depotsDuProduit(produitId){ return this._read(this.S_ITEMS).filter(i=>i.produit_id===produitId)
    .map(i=>({depot:i.depot, libelle:this.depotLabel(i.depot), stock:i.stock})); },
  // Stock total d'un produit tous dépôts confondus
  stockTotalProduit(produitId){ return this._read(this.S_ITEMS).filter(i=>i.produit_id===produitId).reduce((s,i)=>s+(i.stock||0),0); },

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
          <button class="btn btn-primary btn-sm" onclick="MEDICORE_STOCK.uiAffecter()">＋ Affecter un produit</button>
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

  // ── Affecter un produit du catalogue au dépôt courant ────────────────────────
  uiAffecter(){
    const dejaIds=this.items(this._depot).map(i=>i.produit_id).filter(Boolean);
    const dispo=this.produits().filter(p=>p.actif!==false && !dejaIds.includes(p.id));
    if(!this.produits().length){
      this._modal(`<h3 style="margin:0 0 10px">Aucun produit au catalogue</h3>
        <div style="font-size:13px;color:#6b6b6b;margin-bottom:14px">Créez d'abord vos produits dans <b>Paramétrage → Catalogue produits</b>, puis affectez-les aux dépôts.</div>
        <div style="text-align:right"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Fermer</button></div>`); return;
    }
    const opts=dispo.map(p=>`<option value="${p.id}">${p.code} — ${p.designation}${p.dosage?' '+p.dosage:''} (${p.unite})</option>`).join('');
    this._modal(`<h3 style="margin:0 0 14px">Affecter un produit — ${this.depotLabel(this._depot)}</h3>
      ${dispo.length?`
      <div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">Produit du catalogue</label>
        <select id="af-prod" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${opts}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        ${this._fld('af-stock','Stock initial','number',0)}${this._fld('af-min','Stock mini (dépôt)','number',0)}${this._fld('af-secu','Stock sécurité','number',0)}
        ${this._fld('af-max','Stock maxi','number',0)}${this._fld('af-lot','Lot (option)')}${this._fld('af-perem','Péremption','date')}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.saveAffecter()">Affecter</button></div>`
      :`<div style="font-size:13px;color:#6b6b6b">Tous les produits du catalogue sont déjà présents dans ce dépôt.</div>
        <div style="text-align:right;margin-top:12px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Fermer</button></div>`}`,520);
  },
  saveAffecter(){
    const v=id=>document.getElementById(id).value;
    const r=this.affecterProduit(v('af-prod'), this._depot, { stock:v('af-stock'), stock_min:v('af-min'),
      stock_secu:v('af-secu'), stock_max:v('af-max'), lot:v('af-lot'), peremption:v('af-perem') });
    if(r.erreur==='deja_affecte'){ alert('Ce produit est déjà présent dans ce dépôt.'); return; }
    this._close(); this.render();
  },

  // ══ CATALOGUE PRODUITS — interface de gestion (Paramétrage) ══════════════════
  mountCatalogue(containerId){ this._ccid=containerId; this.renderCatalogue(); },
  renderCatalogue(){
    const div=document.getElementById(this._ccid); if(!div) return;
    const prods=this.produits(), familles=this.familles();
    const fFiltre=this._catFiltre||'';
    const list=fFiltre?prods.filter(p=>p.famille===fFiltre):prods;
    div.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div style="display:flex;gap:8px;align-items:center">
          <select onchange="MEDICORE_STOCK._catFiltre=this.value;MEDICORE_STOCK.renderCatalogue()" style="padding:7px 10px;border:1px solid var(--border,#ddd);border-radius:6px;font-size:13px">
            <option value="">Toutes les familles (${prods.length})</option>
            ${familles.map(f=>`<option value="${f.id}"${fFiltre===f.id?' selected':''}>${f.libelle} (${prods.filter(p=>p.famille===f.id).length})</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="MEDICORE_STOCK.uiFamilles()">🗂 Familles</button>
          <button class="btn btn-primary btn-sm" onclick="MEDICORE_STOCK.uiProduit()">＋ Nouveau produit</button>
        </div>
      </div>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:880px">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--border,#eee);color:#6b6b6b;font-size:11px;text-transform:uppercase">
          <th style="padding:7px">Code</th><th>Désignation</th><th>Famille</th><th>Forme / Dosage</th>
          <th>Unité</th><th style="text-align:right">Px achat</th><th style="text-align:right">Stock total</th><th>Dépôts</th><th></th></tr></thead>
        <tbody>${list.length?list.map(p=>{
          const dep=this.depotsDuProduit(p.id), tot=this.stockTotalProduit(p.id);
          return `<tr style="border-bottom:1px solid var(--border,#f0f0f0)">
            <td style="padding:7px"><span style="font-family:monospace;font-size:12px">${p.code}</span>${p.stupefiant?' <span title="Stupéfiant" style="color:#b91c1c">⚠</span>':''}${p.thermosensible?' <span title="Thermosensible">❄</span>':''}</td>
            <td><b>${p.designation}</b>${p.dci?`<div style="font-size:11px;color:#999">DCI : ${p.dci}</div>`:''}</td>
            <td style="font-size:12px;color:#6b6b6b">${this.familleLabel(p.famille)}</td>
            <td style="font-size:12px;color:#6b6b6b">${[p.forme,p.dosage].filter(Boolean).join(' ')||'—'}</td>
            <td style="font-size:12px">${p.unite}</td>
            <td style="text-align:right;color:#6b6b6b">${(p.prix_achat||0).toLocaleString('fr-FR')}</td>
            <td style="text-align:right;font-weight:600">${tot}</td>
            <td style="font-size:11.5px;color:#6b6b6b">${dep.length?dep.map(d=>d.libelle.split(' ')[0]+':'+d.stock).join(' · '):'<span style="color:#b58100">non affecté</span>'}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.uiProduit('${p.id}')">✎</button>
              <button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.uiAffecterDepuisCatalogue('${p.id}')">📦 Affecter</button>
              <button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.supprimerProduitUI('${p.id}')">🗑</button>
            </td></tr>`;
        }).join(''):'<tr><td colspan="9" style="padding:22px;text-align:center;color:#999">Aucun produit. Cliquez « ＋ Nouveau produit ».</td></tr>'}</tbody>
      </table></div>`;
  },
  _formProduit(p){ p=p||{}; const fam=this.familles();
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${this._fld('pr-code','Code article (auto si vide)',null,p.code)}
        ${this._fld('pr-des','Désignation',null,p.designation)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div><label style="font-size:12px;color:#6b6b6b">Famille</label>
          <select id="pr-fam" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${fam.map(f=>`<option value="${f.id}"${p.famille===f.id?' selected':''}>${f.libelle}</option>`).join('')}</select></div>
        <div><label style="font-size:12px;color:#6b6b6b">Forme galénique</label>
          <select id="pr-forme" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px"><option value="">—</option>${this.FORMES.map(f=>`<option${p.forme===f?' selected':''}>${f}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        ${this._fld('pr-dci','DCI (dénomination commune)',null,p.dci)}
        ${this._fld('pr-dosage','Dosage',null,p.dosage)}
        ${this._fld('pr-cond','Conditionnement',null,p.conditionnement)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        <div><label style="font-size:12px;color:#6b6b6b">Unité</label>
          <select id="pr-unite" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${this.UNITES.map(u=>`<option${(p.unite||'unité')===u?' selected':''}>${u}</option>`).join('')}</select></div>
        ${this._fld('pr-prix','Prix achat (FCFA)','number',p.prix_achat)}
        ${this._fld('pr-tva','TVA (%)','number',p.tva!=null?p.tva:0)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        ${this._fld('pr-fourn','Fournisseur préféré',null,p.fournisseur)}
        ${this._fld('pr-barre','Code-barres',null,p.code_barre)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        ${this._fld('pr-min','Stock mini (défaut)','number',p.stock_min)}
        ${this._fld('pr-secu','Stock sécurité','number',p.stock_secu)}
        ${this._fld('pr-max','Stock maxi','number',p.stock_max)}
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:12.5px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="pr-stup"${p.stupefiant?' checked':''}> Stupéfiant / réglementé</label>
        <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="pr-thermo"${p.thermosensible?' checked':''}> Thermosensible (chaîne du froid)</label>
        <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="pr-lot"${p.gere_lot!==false?' checked':''}> Suivi par lot</label>
        <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="pr-perem"${p.gere_peremption!==false?' checked':''}> Suivi péremption</label>
      </div>`;
  },
  _produitFromForm(){ const v=id=>document.getElementById(id).value, c=id=>document.getElementById(id).checked;
    return { code:v('pr-code').trim(), designation:v('pr-des').trim(), famille:v('pr-fam'), forme:v('pr-forme'),
      dci:v('pr-dci').trim(), dosage:v('pr-dosage').trim(), conditionnement:v('pr-cond').trim(), unite:v('pr-unite'),
      prix_achat:v('pr-prix'), tva:v('pr-tva'), fournisseur:v('pr-fourn').trim(), code_barre:v('pr-barre').trim(),
      stock_min:v('pr-min'), stock_secu:v('pr-secu'), stock_max:v('pr-max'),
      stupefiant:c('pr-stup'), thermosensible:c('pr-thermo'), gere_lot:c('pr-lot'), gere_peremption:c('pr-perem') }; },
  uiProduit(id){ const p=id?this.produit(id):null;
    this._modal(`<h3 style="margin:0 0 14px">${id?'Modifier le produit':'Nouveau produit'}</h3>${this._formProduit(p)}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.saveProduit('${id||''}')">Enregistrer</button></div>`,640); },
  saveProduit(id){ const o=this._produitFromForm();
    if(!o.designation){ alert('Désignation requise.'); return; }
    if(id){ this.modifierProduit(id,o); }
    else { const r=this.ajouterProduit(o); if(r&&r.erreur==='code_existe'){ alert('Code article déjà utilisé.'); return; } }
    this._close(); this.renderCatalogue(); },
  supprimerProduitUI(id){ const p=this.produit(id); if(!p) return;
    if(!confirm('Supprimer le produit « '+p.designation+' » du catalogue ?')) return;
    const r=this.supprimerProduit(id);
    if(r.erreur==='stock_present'){ alert('Impossible : ce produit a encore du stock dans un dépôt.'); return; }
    this.renderCatalogue(); },
  uiAffecterDepuisCatalogue(id){ const p=this.produit(id); if(!p) return;
    const depots=this.depotsActifs(); const dejaIds=this._read(this.S_ITEMS).filter(i=>i.produit_id===id).map(i=>i.depot);
    const dispo=depots.filter(d=>!dejaIds.includes(d.id));
    if(!dispo.length){ alert('Ce produit est déjà présent dans tous les dépôts actifs.'); return; }
    this._modal(`<h3 style="margin:0 0 12px">Affecter « ${p.designation} » à un dépôt</h3>
      <div style="margin-bottom:10px"><label style="font-size:12px;color:#6b6b6b">Dépôt</label>
        <select id="ac-depot" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px">${dispo.map(d=>`<option value="${d.id}">${d.libelle}</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${this._fld('ac-stock','Stock initial','number',0)}${this._fld('ac-perem','Péremption','date')}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
        <button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Annuler</button>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.saveAffecterCatalogue('${id}')">Affecter</button></div>`);
  },
  saveAffecterCatalogue(id){ const depot=document.getElementById('ac-depot').value;
    this.affecterProduit(id, depot, { stock:document.getElementById('ac-stock').value, peremption:document.getElementById('ac-perem').value });
    this._close(); this.renderCatalogue(); },

  // ── Gestion des familles ──────────────────────────────────────────────────────
  uiFamilles(){ const fam=this.familles();
    this._modal(`<h3 style="margin:0 0 12px">Familles de produits</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px">
        <thead><tr style="text-align:left;color:#6b6b6b;border-bottom:1px solid #eee"><th style="padding:5px">Famille</th><th>Produits</th><th></th></tr></thead>
        <tbody>${fam.map(f=>`<tr style="border-bottom:1px solid #f3f3f3">
          <td style="padding:5px"><b>${f.libelle}</b></td>
          <td style="color:#6b6b6b">${this.produits().filter(p=>p.famille===f.id).length}</td>
          <td style="text-align:right"><button class="btn btn-xs btn-secondary" onclick="MEDICORE_STOCK.supprimerFamilleUI('${f.id}')">🗑</button></td></tr>`).join('')}</tbody></table>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1"><label style="font-size:12px;color:#6b6b6b">Nouvelle famille</label>
          <input id="fam-lib" placeholder="ex : Vaccins" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px"></div>
        <button class="btn btn-primary" onclick="MEDICORE_STOCK.ajouterFamilleUI()">Ajouter</button></div>
      <div style="text-align:right;margin-top:12px"><button class="btn btn-secondary" onclick="MEDICORE_STOCK._close()">Fermer</button></div>`,520); },
  ajouterFamilleUI(){ const lib=document.getElementById('fam-lib').value.trim(); if(!lib){ alert('Nom requis.'); return; }
    const r=this.ajouterFamille({libelle:lib}); if(r.erreur){ alert('Famille déjà existante.'); return; }
    this.uiFamilles(); },
  supprimerFamilleUI(id){ const r=this.supprimerFamille(id);
    if(r.erreur==='famille_utilisee'){ alert('Impossible : des produits utilisent cette famille.'); return; }
    this.uiFamilles(); },
};
if(typeof window!=='undefined') window.MEDICORE_STOCK = MEDICORE_STOCK;
