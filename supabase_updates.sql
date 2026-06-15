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

drop view if exists public.v_mouvements_consommables cascade;
create view public.v_mouvements_consommables as
select doc_id, payload->>'depot' as depot, payload->>'depot_dest' as depot_dest,
       payload->>'designation' as article, payload->>'sens' as sens,
       (payload->>'qte')::numeric as quantite, payload->>'motif' as motif,
       payload->>'patient' as patient, payload->>'par' as par,
       payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_consommables' and not deleted;

-- Dépôts de stock paramétrables (Magasin central, services…)
drop view if exists public.v_depots_stock cascade;
create view public.v_depots_stock as
select doc_id, payload->>'id' as depot_id, payload->>'libelle' as libelle,
       payload->>'responsable' as responsable,
       coalesce((payload->>'actif')::boolean,true) as actif, updated_at
from public.medicore_sync_docs where store='depots_stock' and not deleted;

-- Consommables : ajout mini/sécurité/maxi + valorisation
drop view if exists public.v_consommables cascade;
create view public.v_consommables as
select doc_id, payload->>'depot' as depot, payload->>'designation' as designation,
       payload->>'categorie' as categorie, payload->>'unite' as unite,
       (payload->>'stock')::numeric as stock,
       (payload->>'stock_min')::numeric as stock_min,
       (payload->>'stock_secu')::numeric as stock_secu,
       (payload->>'stock_max')::numeric as stock_max,
       (payload->>'pmp')::numeric as pmp, payload->>'lot' as lot,
       payload->>'peremption' as peremption,
       (payload->>'stock')::numeric*(payload->>'pmp')::numeric as valeur, updated_at
from public.medicore_sync_docs where store='consommables' and not deleted;

-- Bons de réapprovisionnement (à commander)
drop view if exists public.v_reappro cascade;
create view public.v_reappro as
select doc_id, payload->>'depot' as depot, payload->>'designation' as designation,
       (payload->>'qte')::numeric as quantite, payload->>'unite' as unite,
       payload->>'statut' as statut, payload->>'motif' as motif,
       payload->>'par' as demande_par, payload->>'date' as date_demande, updated_at
from public.medicore_sync_docs where store='reappro' and not deleted;

-- Articles sous le stock mini ou en rupture, par dépôt (vue de pilotage)
drop view if exists public.v_stock_alertes cascade;
create view public.v_stock_alertes as
select doc_id, payload->>'depot' as depot, payload->>'designation' as designation,
       (payload->>'stock')::numeric as stock,
       (payload->>'stock_min')::numeric as stock_min,
       (payload->>'stock_secu')::numeric as stock_secu,
       case when (payload->>'stock')::numeric<=0 then 'rupture'
            when (payload->>'stock_secu')::numeric>0 and (payload->>'stock')::numeric<=(payload->>'stock_secu')::numeric then 'sous_securite'
            when (payload->>'stock_min')::numeric>0 and (payload->>'stock')::numeric<=(payload->>'stock_min')::numeric then 'sous_mini'
            when (payload->>'peremption') is not null and (payload->>'peremption')::date < current_date then 'perime'
            when (payload->>'peremption') is not null and (payload->>'peremption')::date <= current_date+30 then 'peremption_proche'
            else null end as alerte
from public.medicore_sync_docs
where store='consommables' and not deleted
  and (
    (payload->>'stock')::numeric<=0
    or ((payload->>'stock_secu')::numeric>0 and (payload->>'stock')::numeric<=(payload->>'stock_secu')::numeric)
    or ((payload->>'stock_min')::numeric>0 and (payload->>'stock')::numeric<=(payload->>'stock_min')::numeric)
    or ((payload->>'peremption') is not null and (payload->>'peremption')::date <= current_date+30)
  );

-- Dossiers patients archivés (sortis depuis longtemps, hors liste active)
drop view if exists public.v_patients_archives cascade;
create view public.v_patients_archives as
select doc_id, payload->>'id' as dossier, payload->>'ipp' as ipp, payload->>'nom' as nom,
       payload->>'service' as service, payload->>'sortie' as date_sortie,
       payload->>'archive_le' as date_archivage, payload->>'archive_par' as archive_par, updated_at
from public.medicore_sync_docs where store='patients_archives' and not deleted;

-- Valeurs critiques labo (notification ≤30 min au prescripteur)
drop view if exists public.v_labo_critiques cascade;
create view public.v_labo_critiques as
select doc_id, payload->>'heure' as heure, payload->>'date' as date_resultat,
       payload->>'patient' as patient, payload->>'service' as service,
       payload->>'examen' as examen, payload->>'resultat' as resultat,
       payload->>'reference' as reference, payload->>'presc' as prescripteur,
       payload->>'dossier' as dossier, payload->>'demandeId' as demande_id,
       payload->>'notif' as notification, payload->>'notifPar' as notifie_par,
       payload->>'notifTs' as notifie_le, updated_at
from public.medicore_sync_docs where store='labo_critiques' and not deleted;

-- Comptes rendus d'imagerie validés (registre interne, traçabilité)
drop view if exists public.v_cr_imagerie cascade;
create view public.v_cr_imagerie as
select doc_id, payload->>'demId' as demande_id, payload->>'patient' as patient,
       payload->>'patientId' as patient_id, payload->>'type' as type,
       payload->>'examen' as examen, payload->>'radio' as radiologue,
       payload->>'conclusion' as conclusion, payload->>'date' as date_cr, updated_at
from public.medicore_sync_docs where store='cr_imagerie' and not deleted;

-- Worklist imagerie (demandes, planning, statuts)
drop view if exists public.v_demandes_img cascade;
create view public.v_demandes_img as
select doc_id, payload->>'id' as ref, payload->>'patient' as patient,
       payload->>'presc' as prescripteur, payload->>'type' as type,
       payload->>'examen' as examen, payload->>'equip' as equipement,
       payload->>'priorite' as priorite, payload->>'date' as date_creneau,
       payload->>'statut' as statut, payload->>'ccam' as code_cnam, updated_at
from public.medicore_sync_docs where store='demandes_img' and not deleted;

-- Imagerie — journal interne (audit module)
drop view if exists public.v_img_journal cascade;
create view public.v_img_journal as
select doc_id, payload->>'ts' as horodatage, payload->>'action' as action,
       payload->>'id' as reference, payload->>'detail' as detail,
       payload->>'auteur' as auteur, payload->>'role' as role, updated_at
from public.medicore_sync_docs where store='img_journal' and not deleted;

-- Imagerie — historique de maintenance des équipements
drop view if exists public.v_img_maintenance cascade;
create view public.v_img_maintenance as
select doc_id, payload->>'equip' as equipement, payload->>'type' as type_intervention,
       payload->>'date' as date_intervention, payload->>'prochaine' as prochaine_echeance,
       payload->>'tech' as technicien, payload->>'statut' as statut, updated_at
from public.medicore_sync_docs where store='img_maintenance' and not deleted;
