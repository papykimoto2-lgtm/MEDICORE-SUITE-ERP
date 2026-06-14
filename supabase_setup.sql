-- ══════════════════════════════════════════════════════════════════════════════
-- MediCore ERP — Configuration Supabase CONSOLIDÉE (toutes les améliorations)
-- ──────────────────────────────────────────────────────────────────────────────
-- Un seul script, idempotent (ré-exécutable sans risque).
-- Contenu :
--   1) Table de synchro générique (document store JSONB) + index + trigger + RLS
--   2) Vues d'exploitation (BI / exports) pour TOUS les modules améliorés :
--      prestations, factures, prescriptions, demandes, trésorerie, caisse,
--      mouvements de stock, stock, urgences/triage, connexions, audit.
-- ⚠️ Pour le contrôle d'accès par rôle (RBAC serveur) + Auth JWT : exécuter
--    ENSUITE security_schema.sql.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) TABLE DE SYNCHRONISATION ────────────────────────────────────────────────
create table if not exists public.medicore_sync_docs (
  store       text        not null,
  doc_id      text        not null,
  payload     jsonb       not null,
  device      text,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (store, doc_id)
);

create index if not exists idx_sync_docs_updated on public.medicore_sync_docs (updated_at);
create index if not exists idx_sync_docs_store   on public.medicore_sync_docs (store);

create or replace function public.touch_sync_docs()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_sync_docs on public.medicore_sync_docs;
create trigger trg_touch_sync_docs before update on public.medicore_sync_docs
  for each row execute function public.touch_sync_docs();

alter table public.medicore_sync_docs enable row level security;

-- RLS permissive (ouverte) — à REMPLACER par security_schema.sql en production.
drop policy if exists p_sync_all on public.medicore_sync_docs;
create policy p_sync_all on public.medicore_sync_docs
  for all using (true) with check (true);

-- ── 2) VUES D'EXPLOITATION ─────────────────────────────────────────────────────

-- Prestations facturables (labo, imagerie, bloc, pharmacie, urgences…)
drop view if exists public.v_prestations cascade;
create view public.v_prestations as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'module' as module, payload->>'libelle' as libelle, payload->>'code' as code,
       (payload->>'montant')::numeric as montant, payload->>'statut' as statut,
       payload->>'facture_id' as facture_id, payload->>'date' as date_acte, updated_at
from public.medicore_sync_docs where store='prestations' and not deleted;

-- Factures (dont notes de sortie consolidées)
drop view if exists public.v_factures cascade;
create view public.v_factures as
select doc_id, payload->>'id' as facture, payload->>'nom' as patient, payload->>'nss' as ipp,
       payload->>'type' as type, payload->>'am' as prise_en_charge, payload->>'statut' as statut,
       (payload->>'montant')::numeric as montant, payload->>'date' as date_facture, updated_at
from public.medicore_sync_docs where store='factures' and not deleted;

-- Prescriptions / lignes pharmacie (registre RX)
drop view if exists public.v_prescriptions cascade;
create view public.v_prescriptions as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'med' as medicament, payload->>'posologie' as posologie, payload->>'voie' as voie,
       payload->>'duree' as duree, payload->>'statut' as statut, payload->>'medecin' as prescripteur,
       payload->>'groupe' as ordonnance, payload->>'date' as date_presc, updated_at
from public.medicore_sync_docs where store='prescriptions' and not deleted;

-- Demandes inter-services
drop view if exists public.v_demandes cascade;
create view public.v_demandes as
select doc_id, payload->>'module_demandeur' as demandeur, payload->>'module_cible' as cible,
       payload->>'objet' as objet, payload->>'priorite' as priorite, payload->>'statut' as statut,
       payload#>>'{patient,nom}' as patient, payload->>'registreId' as registre_id, updated_at
from public.medicore_sync_docs where store='demandes' and not deleted;

-- Trésorerie (mouvements SYSCOHADA)
drop view if exists public.v_tresorerie cascade;
create view public.v_tresorerie as
select doc_id, payload->>'libelle' as libelle, (payload->>'montant')::numeric as montant,
       payload->>'sens' as sens, payload->>'mode' as mode, payload->>'journal' as journal,
       payload->>'compte_debit' as compte_debit, payload->>'compte_credit' as compte_credit,
       payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_tresorerie' and not deleted;

-- Caisse / encaissements (pharmacie, labo, imagerie, bloc…)
drop view if exists public.v_caisse cascade;
create view public.v_caisse as
select doc_id, payload->>'service' as service, payload->>'service_label' as caisse,
       payload->>'patient_nom' as patient, (payload->>'total')::numeric as total,
       payload->>'mode' as mode, payload->>'caissier' as caissier,
       payload->>'compte_debit' as compte_debit, payload->>'compte_credit' as compte_credit,
       payload->>'date' as date_enc, updated_at
from public.medicore_sync_docs where store='caisse' and not deleted;

-- Recette de caisse par service et par jour (agrégat prêt pour tableau de bord)
drop view if exists public.v_caisse_jour cascade;
create view public.v_caisse_jour as
select (payload->>'date')::date as jour, payload->>'service_label' as caisse,
       count(*) as nb_operations, sum((payload->>'total')::numeric) as recette,
       payload->>'compte_credit' as compte_vente
from public.medicore_sync_docs where store='caisse' and not deleted
group by 1,2,5 order by 1 desc;

-- Mouvements de stock pharmacie
drop view if exists public.v_mouvements_stock cascade;
create view public.v_mouvements_stock as
select doc_id, payload->>'produit' as produit, payload->>'mvt' as sens,
       (payload->>'qte')::numeric as quantite, payload->>'motif' as motif,
       payload->>'patient' as patient, payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_stock' and not deleted;

-- État du stock PUI
drop view if exists public.v_stock cascade;
create view public.v_stock as
select doc_id, payload->>'dci' as produit, (payload->>'stock')::numeric as quantite,
       (payload->>'pmp')::numeric as pmp, payload->>'lot' as lot, payload->>'code' as code, updated_at
from public.medicore_sync_docs where store='stock' and not deleted;

-- Urgences / triage
drop view if exists public.v_urgences cascade;
create view public.v_urgences as
select doc_id, payload->>'nom' as patient, payload->>'ipp' as ipp, payload->>'motif' as motif,
       (payload->>'niveau')::int as niveau_triage, payload->>'statut' as statut,
       payload->>'arrivee' as arrivee, payload->>'orientation' as orientation,
       payload->>'soignant' as soignant, updated_at
from public.medicore_sync_docs where store='urgences' and not deleted;

-- Historique de connexion (sécurité)
drop view if exists public.v_connexions cascade;
create view public.v_connexions as
select doc_id, payload->>'login' as login, payload->>'nom' as nom, payload->>'role' as role,
       (payload->>'ok')::boolean as succes, payload->>'motif' as motif,
       payload->>'ts' as horodatage, updated_at
from public.medicore_sync_docs where store='connexions' and not deleted;

-- Journal d'audit (connexions, consultations, modifications, suppressions)
drop view if exists public.v_audit cascade;
create view public.v_audit as
select doc_id, payload->>'ts' as horodatage, payload->>'type' as type, payload->>'action' as action,
       payload->>'detail' as detail, payload->>'cible' as cible,
       payload->>'acteur' as acteur, payload->>'nom' as nom, payload->>'role' as role,
       payload->>'module' as module, updated_at
from public.medicore_sync_docs where store='audit' and not deleted;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIN. Stores synchronisés couverts : patients, constantes, prescriptions,
--   demandes, prestations, caisse, urgences, audit, connexions, factures,
--   mouvements_tresorerie, mouvements_stock, stock, comptes_bancaires, ecritures,
--   bons_commande, personnel, paie, immo, parametrage, demandes_labo, etc.
-- Étape suivante (production) : security_schema.sql (RBAC serveur + Auth JWT).
-- ══════════════════════════════════════════════════════════════════════════════

-- Résultats d'examens rendus au dossier (biologie / imagerie)
drop view if exists public.v_resultats cascade;
create view public.v_resultats as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'type' as type, payload->>'libelle' as libelle,
       payload->>'conclusion' as conclusion, payload->>'par' as valide_par,
       payload->>'date' as date_res, updated_at
from public.medicore_sync_docs where store='resultats' and not deleted;
