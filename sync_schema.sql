-- ══════════════════════════════════════════════════════════════════════════════
-- MediCore ERP — Table de synchronisation générique (document store)
-- À exécuter dans Supabase → SQL Editor.
-- Stocke chaque ligne de chaque module en JSONB, clé = (store, doc_id).
-- Compatible IDs locaux non-UUID (P001, FAC-2026-..., etc.).
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.medicore_sync_docs (
  store       text        not null,
  doc_id      text        not null,
  payload     jsonb       not null,
  device      text,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (store, doc_id)
);

-- Index pull incrémental (filtre updated_at > dernier pull)
create index if not exists idx_sync_docs_updated
  on public.medicore_sync_docs (updated_at);

create index if not exists idx_sync_docs_store
  on public.medicore_sync_docs (store);

-- Met à jour updated_at à chaque upsert serveur-side (sécurité)
create or replace function public.touch_sync_docs()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_sync_docs on public.medicore_sync_docs;
create trigger trg_touch_sync_docs
  before insert or update on public.medicore_sync_docs
  for each row execute function public.touch_sync_docs();

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.medicore_sync_docs enable row level security;

-- Accès complet via clé anon/publishable (ajuster selon politique de sécurité réelle)
drop policy if exists p_sync_all on public.medicore_sync_docs;
create policy p_sync_all on public.medicore_sync_docs
  for all using (true) with check (true);
