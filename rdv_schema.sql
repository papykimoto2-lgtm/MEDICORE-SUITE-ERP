-- ════════════════════════════════════════════════════════════════════
-- MediCore — Table planning RDV patients (store 'rdv')
-- Alimentée par : validation portail (rdv_portail_admin) + saisie agenda
-- ════════════════════════════════════════════════════════════════════

create table if not exists rdv (
  id           text primary key,
  patient_id   text,
  patient_nom  text not null,
  ipp          text,
  service      text not null,
  medecin      text,
  date         date not null,
  heure        text,
  motif        text,
  statut       text default 'Planifié',  -- Planifié | Honoré | Absent | Annulé
  origine      text default 'agenda',    -- agenda | portail
  ref_portail  text,                      -- réf RDV-XXXXXX si issu du portail
  cree_le      timestamptz default now(),
  maj_le       timestamptz
);

create index if not exists idx_rdv_date    on rdv(date);
create index if not exists idx_rdv_service on rdv(service);
create index if not exists idx_rdv_medecin on rdv(medecin);
create index if not exists idx_rdv_statut  on rdv(statut);

alter table rdv enable row level security;
create policy "staff all rdv plan" on rdv for all to authenticated using (true) with check (true);
-- Si l'agenda tourne avec la clé anon (pas d'auth Supabase), décommenter :
-- create policy "anon rdv plan" on rdv for all to anon using (true) with check (true);
