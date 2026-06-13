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

-- ══════════════════════════════════════════════════════════════════════════════
-- MISE À NIVEAU — Vues d'exploitation (BI / exports)
-- La synchro reste sur la table générique medicore_sync_docs (JSONB).
-- Ces vues "déplient" le JSONB en colonnes pour les requêtes SQL et tableaux de bord.
-- Idempotent : ré-exécutable.
-- ══════════════════════════════════════════════════════════════════════════════

-- Prestations facturables (labo, imagerie, bloc, pharmacie…)
create or replace view public.v_prestations as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'module' as module, payload->>'libelle' as libelle, payload->>'code' as code,
       (payload->>'montant')::numeric as montant, payload->>'statut' as statut,
       payload->>'facture_id' as facture_id, payload->>'date' as date_acte, updated_at
from public.medicore_sync_docs where store='prestations' and not deleted;

-- Factures (dont notes de sortie consolidées)
create or replace view public.v_factures as
select doc_id, payload->>'id' as facture, payload->>'nom' as patient, payload->>'nss' as ipp,
       payload->>'type' as type, payload->>'am' as prise_en_charge, payload->>'statut' as statut,
       (payload->>'montant')::numeric as montant, payload->>'date' as date_facture, updated_at
from public.medicore_sync_docs where store='factures' and not deleted;

-- Prescriptions / lignes pharmacie (registre RX)
create or replace view public.v_prescriptions as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'med' as medicament, payload->>'posologie' as posologie, payload->>'voie' as voie,
       payload->>'duree' as duree, payload->>'statut' as statut, payload->>'medecin' as prescripteur,
       payload->>'groupe' as ordonnance, payload->>'date' as date_presc, updated_at
from public.medicore_sync_docs where store='prescriptions' and not deleted;

-- Demandes inter-services
create or replace view public.v_demandes as
select doc_id, payload->>'module_demandeur' as demandeur, payload->>'module_cible' as cible,
       payload->>'objet' as objet, payload->>'priorite' as priorite, payload->>'statut' as statut,
       payload#>>'{patient,nom}' as patient, payload->>'registreId' as registre_id, updated_at
from public.medicore_sync_docs where store='demandes' and not deleted;

-- Mouvements de caisse / trésorerie (SYSCOHADA)
create or replace view public.v_tresorerie as
select doc_id, payload->>'libelle' as libelle, (payload->>'montant')::numeric as montant,
       payload->>'sens' as sens, payload->>'mode' as mode, payload->>'journal' as journal,
       payload->>'compte_debit' as compte_debit, payload->>'compte_credit' as compte_credit,
       payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_tresorerie' and not deleted;

-- Mouvements de stock pharmacie
create or replace view public.v_mouvements_stock as
select doc_id, payload->>'produit' as produit, payload->>'mvt' as sens,
       (payload->>'qte')::numeric as quantite, payload->>'motif' as motif,
       payload->>'patient' as patient, payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_stock' and not deleted;

-- Historique de connexion (sécurité / audit)
create or replace view public.v_connexions as
select doc_id, payload->>'login' as login, payload->>'nom' as nom, payload->>'role' as role,
       (payload->>'ok')::boolean as succes, payload->>'motif' as motif,
       payload->>'ts' as horodatage, updated_at
from public.medicore_sync_docs where store='connexions' and not deleted;

-- Caisse / encaissements (pharmacie, labo, imagerie…)
create or replace view public.v_caisse as
select doc_id, payload->>'service' as service, payload->>'service_label' as caisse,
       payload->>'patient_nom' as patient, (payload->>'total')::numeric as total,
       payload->>'mode' as mode, payload->>'caissier' as caissier,
       payload->>'compte_debit' as compte_debit, payload->>'compte_credit' as compte_credit,
       payload->>'date' as date_enc, updated_at
from public.medicore_sync_docs where store='caisse' and not deleted;
