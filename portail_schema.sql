-- ════════════════════════════════════════════════════════════════════
-- MediCore — Portail Patient · tables Supabase
-- À exécuter dans l'éditeur SQL Supabase du projet medicore-erp
-- ════════════════════════════════════════════════════════════════════

create table if not exists rdv_portail (
  id              text primary key,
  ref             text unique not null,
  type_patient    text default 'nouveau',   -- nouveau | ancien
  ipp             text,
  nom             text not null,
  tel             text not null,
  email           text,
  ddn             date,
  service         text not null,
  medecin         text,
  date_souhaitee  date not null,
  creneau         text,
  motif           text,
  statut          text default 'En attente', -- En attente | Confirmé | Refusé
  source          text default 'portail',
  nb_documents    int  default 0,
  cree_le         timestamptz default now(),
  traite_par      text,
  traite_le       timestamptz
);

create table if not exists portail_documents (
  id        text primary key,
  rdv_ref   text references rdv_portail(ref) on delete cascade,
  nom       text,
  type      text,
  taille    bigint,
  data      text,            -- base64 dataURL
  cree_le   timestamptz default now()
);

create index if not exists idx_rdvp_statut on rdv_portail(statut);
create index if not exists idx_rdvp_tel    on rdv_portail(tel);
create index if not exists idx_docs_ref     on portail_documents(rdv_ref);

-- ── RLS : insertion publique (portail anonyme), lecture/maj réservées ──
alter table rdv_portail        enable row level security;
alter table portail_documents  enable row level security;

-- Le portail public (clé anon) peut INSÉRER une demande + ses documents
create policy "portail insert rdv"  on rdv_portail       for insert to anon with check (true);
create policy "portail insert docs" on portail_documents for insert to anon with check (true);

-- Le patient peut relire SA demande via la clé anon (suivi par réf/tel côté app)
create policy "portail select rdv"  on rdv_portail       for select to anon using (true);

-- Le personnel (authenticated) gère tout
create policy "staff all rdv"   on rdv_portail       for all to authenticated using (true) with check (true);
create policy "staff all docs"  on portail_documents for all to authenticated using (true) with check (true);
