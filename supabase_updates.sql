-- ══════════════════════════════════════════════════════════════════════════════
-- MediCore ERP — Mises à jour Supabase (dernières améliorations)
-- ──────────────────────────────────────────────────────────────────────────────
-- Delta à exécuter si supabase_setup.sql a déjà été appliqué auparavant.
-- Couvre : résultats d'examens rendus au dossier, sessions de caisse (écarts).
-- Idempotent (DROP VIEW IF EXISTS … CASCADE puis CREATE).
-- La table générique medicore_sync_docs absorbe déjà les nouveaux stores
-- ('resultats', 'caisse_sessions') : aucune table à créer.
-- ══════════════════════════════════════════════════════════════════════════════

-- Résultats d'examens rendus au dossier (biologie / imagerie)
drop view if exists public.v_resultats cascade;
create view public.v_resultats as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'type' as type, payload->>'libelle' as libelle,
       payload->>'conclusion' as conclusion, payload->>'par' as valide_par,
       payload->>'date' as date_res, updated_at
from public.medicore_sync_docs where store='resultats' and not deleted;

-- Sessions de caisse (ouverture/clôture, fond, écart) — par caissier
drop view if exists public.v_caisse_sessions cascade;
create view public.v_caisse_sessions as
select doc_id, payload->>'service' as service, payload->>'caissier' as caissier,
       (payload->>'fond')::numeric          as fond_initial,
       (payload->>'recette')::numeric       as recette,
       (payload->>'attendu')::numeric       as attendu,
       (payload->>'compte_especes')::numeric as compte_especes,
       (payload->>'versement')::numeric     as versement,
       (payload->>'ecart')::numeric         as ecart,
       (payload->>'nb_operations')::int     as nb_operations,
       payload->>'ouverte_le'  as ouverte_le,
       payload->>'cloturee_le' as cloturee_le, updated_at
from public.medicore_sync_docs where store='caisse_sessions' and not deleted;

-- Synthèse des écarts de caisse par caissier et par jour
drop view if exists public.v_ecarts_caisse cascade;
create view public.v_ecarts_caisse as
select (payload->>'cloturee_le')::date as jour, payload->>'caissier' as caissier,
       payload->>'service' as service,
       count(*) as nb_clotures,
       sum((payload->>'recette')::numeric) as recette_totale,
       sum((payload->>'ecart')::numeric)   as ecart_total
from public.medicore_sync_docs where store='caisse_sessions' and not deleted
group by 1,2,3 order by 1 desc;
