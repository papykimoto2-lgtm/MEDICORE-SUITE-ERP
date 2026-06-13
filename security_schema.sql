-- ══════════════════════════════════════════════════════════════════════════════
-- MediCore ERP — Sécurisation côté serveur (Supabase)
-- ──────────────────────────────────────────────────────────────────────────────
-- Met en place le contrôle d'accès RÉEL (impossible à contourner depuis le client) :
--   • Authentification : Supabase Auth (JWT signés serveur, sessions, expiration).
--   • RBAC : table de profils (rôle par utilisateur) + politiques RLS par rôle.
--   • Audit : table append-only, écriture autorisée à tous, lecture admin/direction.
-- Idempotent. À exécuter dans Supabase (SQL Editor) APRÈS sync_schema.sql.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Rôles applicatifs ----------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname='medicore_role') then
    create type medicore_role as enum
      ('administrateur','direction','medecin','infirmier','pharmacien',
       'laborantin','caissier','comptable','rh','archiviste');
  end if;
end $$;

-- 2) Profils : 1 ligne par utilisateur Auth, portant son rôle -------------------
create table if not exists public.medicore_profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  login     text,
  nom       text,
  role      medicore_role not null default 'archiviste',
  actif     boolean not null default true,
  created_at timestamptz default now()
);
alter table public.medicore_profiles enable row level security;

-- Helpers : rôle de l'utilisateur courant
create or replace function public.current_role() returns medicore_role
language sql stable as $$ select role from public.medicore_profiles where user_id = auth.uid() $$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.current_role() in ('administrateur','direction'), false) $$;

-- Chacun lit son profil ; admin gère tout
drop policy if exists prof_self_read on public.medicore_profiles;
create policy prof_self_read on public.medicore_profiles for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists prof_admin_all on public.medicore_profiles;
create policy prof_admin_all on public.medicore_profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- 3) Droits d'écriture par store, selon le rôle --------------------------------
-- Renvoie TRUE si le rôle courant peut écrire dans ce store applicatif.
create or replace function public.can_write(p_store text) returns boolean
language sql stable as $$
  select case
    when public.current_role() = 'administrateur' then true
    when public.current_role() = 'direction' then p_store in ('parametrage','audit')
    when public.current_role() = 'medecin' then p_store in ('patients','constantes','prescriptions','demandes','urgences','audit')
    when public.current_role() = 'infirmier' then p_store in ('constantes','urgences','audit')
    when public.current_role() = 'pharmacien' then p_store in ('prescriptions','stock','mouvements_stock','caisse','mouvements_tresorerie','audit')
    when public.current_role() = 'laborantin' then p_store in ('demandes_labo','resultats_labo','prestations','demandes','audit')
    when public.current_role() = 'caissier' then p_store in ('caisse','factures','prestations','mouvements_tresorerie','audit')
    when public.current_role() = 'comptable' then p_store in ('ecritures','mouvements_tresorerie','comptes_bancaires','immo','factures','audit')
    when public.current_role() = 'rh' then p_store in ('personnel','paie','audit')
    when public.current_role() = 'archiviste' then p_store in ('audit')
    else false
  end;
$$;

-- 4) RLS sur la table de synchro générique -------------------------------------
-- (créée par sync_schema.sql : medicore_sync_docs)
alter table if exists public.medicore_sync_docs enable row level security;

-- Lecture : tout utilisateur authentifié (les dossiers patients sont tracés via audit).
drop policy if exists sync_read on public.medicore_sync_docs;
create policy sync_read on public.medicore_sync_docs for select
  using (auth.role() = 'authenticated');

-- Écriture / mise à jour : seulement si le rôle peut écrire ce store.
drop policy if exists sync_insert on public.medicore_sync_docs;
create policy sync_insert on public.medicore_sync_docs for insert
  with check (public.can_write(store));
drop policy if exists sync_update on public.medicore_sync_docs;
create policy sync_update on public.medicore_sync_docs for update
  using (public.can_write(store)) with check (public.can_write(store));

-- Suppression (soft-delete) : admin uniquement.
drop policy if exists sync_delete on public.medicore_sync_docs;
create policy sync_delete on public.medicore_sync_docs for delete
  using (public.is_admin());

-- 5) Audit serveur : append-only ------------------------------------------------
create table if not exists public.medicore_audit (
  id         bigint generated always as identity primary key,
  ts         timestamptz default now(),
  acteur     uuid default auth.uid(),
  login      text,
  role       text,
  type       text,         -- CONNEXION / CONSULTATION / MODIFICATION / SUPPRESSION …
  action     text,
  detail     text,
  cible      text,
  module     text
);
alter table public.medicore_audit enable row level security;
-- Tout authentifié peut écrire une trace ; nul ne peut modifier/supprimer.
drop policy if exists audit_insert on public.medicore_audit;
create policy audit_insert on public.medicore_audit for insert with check (auth.role()='authenticated');
-- Lecture réservée à l'administration.
drop policy if exists audit_read on public.medicore_audit;
create policy audit_read on public.medicore_audit for select using (public.is_admin());

-- 6) Vue d'audit lisible --------------------------------------------------------
create or replace view public.v_audit as
  select ts, type, action, detail, cible, login, role, module
  from public.medicore_audit order by ts desc;

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION CÔTÉ CLIENT (à faire pour activer le contrôle serveur) :
--   1. Créer les utilisateurs dans Supabase Auth (email/mot de passe) → JWT gérés
--      par Supabase (expiration, refresh, révocation côté serveur).
--   2. Insérer leur rôle dans medicore_profiles.
--   3. Le client envoie le JWT (Authorization: Bearer …) sur chaque appel REST :
--      les politiques RLS ci-dessus s'appliquent automatiquement, AUCUN contournement
--      possible depuis le navigateur.
--   4. La couche RBAC client (medicore-rbac.js) ne sert plus qu'au confort d'UI.
-- ══════════════════════════════════════════════════════════════════════════════
