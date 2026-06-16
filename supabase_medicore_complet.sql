-- MEDICORE SUITE ERP — Schéma Supabase COMPLET (idempotent)

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


-- ════ VUES ════


-- v_bloc_dmi
drop view if exists public.v_bloc_dmi cascade;
create view public.v_bloc_dmi as
select d.doc_id, d.payload->>'patient' as patient, d.payload->>'chirurgien' as chirurgien,
       d.payload->>'date' as date_intervention,
       dmi->>'designation' as dmi, dmi->>'fabricant' as fabricant, dmi->>'ref' as reference,
       dmi->>'lot' as lot, dmi->>'serie' as numero_serie, dmi->>'peremption' as peremption,
       (dmi->>'cout')::numeric as cout, d.updated_at
from public.medicore_sync_docs d, jsonb_array_elements(coalesce(d.payload->'dmi','[]'::jsonb)) as dmi
where d.store='bloc_interventions' and not d.deleted;

-- v_bloc_interventions
drop view if exists public.v_bloc_interventions cascade;
create view public.v_bloc_interventions as
select doc_id, payload->>'id' as op_id, payload->>'patient' as patient, payload->>'acte' as acte,
       payload->>'chirurgien' as chirurgien, payload->>'salle' as salle, payload->>'date' as date,
       payload->>'heure' as heure, payload->>'priorite' as priorite, payload->>'asa' as classe_asa,
       payload->>'anesthesie' as type_anesthesie, payload->>'anesthesiste' as anesthesiste,
       payload->>'statut' as statut,
       payload->'parcours'->>'incision' as debut_incision, payload->'parcours'->>'fin' as fin_intervention,
       payload->>'cloture_le' as cloture_le, payload->>'cloture_par' as cloture_par,
       jsonb_array_length(coalesce(payload->'equipe','[]'::jsonb)) as nb_equipe,
       jsonb_array_length(coalesce(payload->'dmi','[]'::jsonb)) as nb_dmi, updated_at
from public.medicore_sync_docs where store='bloc_interventions' and not deleted;

-- v_caisse
drop view if exists public.v_caisse cascade;
create view public.v_caisse as
select doc_id, payload->>'service' as service, payload->>'service_label' as caisse,
       payload->>'patient_nom' as patient, (payload->>'total')::numeric as total,
       payload->>'mode' as mode, payload->>'caissier' as caissier,
       payload->>'compte_debit' as compte_debit, payload->>'compte_credit' as compte_credit,
       payload->>'date' as date_enc, updated_at
from public.medicore_sync_docs where store='caisse' and not deleted;

-- v_caisse_sessions
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

-- v_comptes_tiers
drop view if exists public.v_comptes_tiers cascade;
create view public.v_comptes_tiers as
select doc_id, payload->>'compte' as compte_auxiliaire, payload->>'type' as type,
       payload->>'nom' as nom, payload->>'ref' as reference, payload->>'cree_le' as cree_le, updated_at
from public.medicore_sync_docs where store='comptes_tiers' and not deleted;

-- v_connexions
drop view if exists public.v_connexions cascade;
create view public.v_connexions as
select doc_id, payload->>'login' as login, payload->>'nom' as nom, payload->>'role' as role,
       (payload->>'ok')::boolean as succes, payload->>'motif' as motif,
       payload->>'ts' as horodatage, updated_at
from public.medicore_sync_docs where store='connexions' and not deleted;

-- v_consommables
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

-- v_consommables_prix
drop view if exists public.v_consommables_prix cascade;
create view public.v_consommables_prix as
select doc_id, payload->>'produit_id' as produit_id, payload->>'depot' as depot,
       payload->>'designation' as designation, (payload->>'stock')::numeric as stock,
       (payload->>'pmp')::numeric as pmp_cout, (payload->>'prix_vente')::numeric as prix_vente_depot, updated_at
from public.medicore_sync_docs where store='consommables' and not deleted;

-- v_cr_imagerie
drop view if exists public.v_cr_imagerie cascade;
create view public.v_cr_imagerie as
select doc_id, payload->>'demId' as demande_id, payload->>'patient' as patient,
       payload->>'patientId' as patient_id, payload->>'type' as type,
       payload->>'examen' as examen, payload->>'radio' as radiologue,
       payload->>'conclusion' as conclusion, payload->>'date' as date_cr, updated_at
from public.medicore_sync_docs where store='cr_imagerie' and not deleted;

-- v_demandes
drop view if exists public.v_demandes cascade;
create view public.v_demandes as
select doc_id, payload->>'module_demandeur' as demandeur, payload->>'module_cible' as cible,
       payload->>'objet' as objet, payload->>'priorite' as priorite, payload->>'statut' as statut,
       payload#>>'{patient,nom}' as patient, payload->>'registreId' as registre_id, updated_at
from public.medicore_sync_docs where store='demandes' and not deleted;

-- v_demandes_img
drop view if exists public.v_demandes_img cascade;
create view public.v_demandes_img as
select doc_id, payload->>'id' as ref, payload->>'patient' as patient,
       payload->>'presc' as prescripteur, payload->>'type' as type,
       payload->>'examen' as examen, payload->>'equip' as equipement,
       payload->>'priorite' as priorite, payload->>'date' as date_creneau,
       payload->>'statut' as statut, payload->>'ccam' as code_cnam, updated_at
from public.medicore_sync_docs where store='demandes_img' and not deleted;

-- v_depots_stock
drop view if exists public.v_depots_stock cascade;
create view public.v_depots_stock as
select doc_id, payload->>'id' as depot_id, payload->>'libelle' as libelle,
       payload->>'responsable' as responsable,
       coalesce((payload->>'actif')::boolean,true) as actif, updated_at
from public.medicore_sync_docs where store='depots_stock' and not deleted;

-- v_ecarts_caisse
drop view if exists public.v_ecarts_caisse cascade;
create view public.v_ecarts_caisse as
select (payload->>'cloturee_le')::date as jour, payload->>'caissier' as caissier,
       payload->>'service' as service,
       count(*) as nb_clotures,
       sum((payload->>'recette')::numeric) as recette_totale,
       sum((payload->>'ecart')::numeric)   as ecart_total
from public.medicore_sync_docs where store='caisse_sessions' and not deleted
group by 1,2,3 order by 1 desc;

-- v_ecritures
drop view if exists public.v_ecritures cascade;
create view public.v_ecritures as
select doc_id, payload->>'piece' as piece, payload->>'journal' as journal, payload->>'date' as date,
       payload->>'compte' as compte, payload->>'intitule' as intitule, payload->>'libelle' as libelle,
       (payload->>'debit')::numeric as debit, (payload->>'credit')::numeric as credit,
       payload->>'compte_aux' as compte_auxiliaire, payload->>'tiers_nom' as tiers,
       payload->>'centre' as centre_analytique, payload->>'source' as module_source,
       coalesce((payload->>'valide')::boolean,false) as valide,
       payload->>'cree_par' as cree_par, payload->>'cree_le' as cree_le, updated_at
from public.medicore_sync_docs where store='ecritures' and not deleted;

-- v_factures
drop view if exists public.v_factures cascade;
create view public.v_factures as
select doc_id, payload->>'id' as facture, payload->>'nom' as patient, payload->>'nss' as ipp,
       payload->>'type' as type, payload->>'am' as prise_en_charge, payload->>'statut' as statut,
       (payload->>'montant')::numeric as montant, payload->>'date' as date_facture, updated_at
from public.medicore_sync_docs where store='factures' and not deleted;

-- v_familles_produits
drop view if exists public.v_familles_produits cascade;
create view public.v_familles_produits as
select doc_id, payload->>'id' as famille_id, payload->>'libelle' as libelle,
       payload->>'type' as type, updated_at
from public.medicore_sync_docs where store='familles_produits' and not deleted;

-- v_img_doses
drop view if exists public.v_img_doses cascade;
create view public.v_img_doses as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient' as patient,
       payload->>'examen' as examen, (payload->>'dose')::numeric as dose_mgy,
       payload->>'date' as date, payload->>'par' as operateur, updated_at
from public.medicore_sync_docs where store='img_doses' and not deleted;

-- v_img_journal
drop view if exists public.v_img_journal cascade;
create view public.v_img_journal as
select doc_id, payload->>'ts' as horodatage, payload->>'action' as action,
       payload->>'id' as reference, payload->>'detail' as detail,
       payload->>'auteur' as auteur, payload->>'role' as role, updated_at
from public.medicore_sync_docs where store='img_journal' and not deleted;

-- v_img_maintenance
drop view if exists public.v_img_maintenance cascade;
create view public.v_img_maintenance as
select doc_id, payload->>'equip' as equipement, payload->>'type' as type_intervention,
       payload->>'date' as date_intervention, payload->>'prochaine' as prochaine_echeance,
       payload->>'tech' as technicien, payload->>'statut' as statut, updated_at
from public.medicore_sync_docs where store='img_maintenance' and not deleted;

-- v_labo_automates_etat
drop view if exists public.v_labo_automates_etat cascade;
create view public.v_labo_automates_etat as
select d.doc_id, kv.key as automate, kv.value->>'statut' as statut,
       kv.value->>'motif' as motif, kv.value->>'depuis' as depuis,
       kv.value->>'par' as par, d.updated_at
from public.medicore_sync_docs d, jsonb_each(d.payload) as kv(key,value)
where d.store='labo_automates_etat' and d.doc_id='_full' and not d.deleted;

-- v_labo_cqi
drop view if exists public.v_labo_cqi cascade;
create view public.v_labo_cqi as
select doc_id, payload->>'date' as date, payload->>'param' as parametre, payload->>'automate' as automate,
       payload->>'niveau' as niveau, (payload->>'valeur')::numeric as valeur,
       (payload->>'cible')::numeric as cible, (payload->>'sd')::numeric as sd,
       (payload->>'z')::numeric as z_score, payload->>'statut' as statut,
       payload->>'regle' as regle, payload->>'par' as operateur, updated_at
from public.medicore_sync_docs where store='labo_cqi' and not deleted;

-- v_labo_critiques
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

-- v_labo_documents
drop view if exists public.v_labo_documents cascade;
create view public.v_labo_documents as
select doc_id, payload->>'doc' as document, payload->>'version' as version,
       payload->>'date' as date_revision, payload->>'statut' as statut, updated_at
from public.medicore_sync_docs where store='labo_documents' and not deleted;

-- v_labo_eeq
drop view if exists public.v_labo_eeq cascade;
create view public.v_labo_eeq as
select doc_id, payload->>'programme' as programme, payload->>'cycle' as cycle,
       payload->>'statut' as statut, payload->>'resultat' as resultat,
       payload->>'date_soumission' as date_soumission, updated_at
from public.medicore_sync_docs where store='labo_eeq' and not deleted;

-- v_labo_nc
drop view if exists public.v_labo_nc cascade;
create view public.v_labo_nc as
select doc_id, payload->>'date' as date, payload->>'type' as type,
       payload->>'automate' as automate, payload->>'description' as description,
       payload->>'regle' as regle, payload->>'action' as action_corrective,
       payload->>'statut' as statut, payload->>'cloture_par' as cloture_par,
       payload->>'cloture_le' as cloture_le, updated_at
from public.medicore_sync_docs where store='labo_nc' and not deleted;

-- v_mouvements_consommables
drop view if exists public.v_mouvements_consommables cascade;
create view public.v_mouvements_consommables as
select doc_id, payload->>'depot' as depot, payload->>'depot_dest' as depot_dest,
       payload->>'designation' as article, payload->>'sens' as sens,
       (payload->>'qte')::numeric as quantite, payload->>'motif' as motif,
       payload->>'patient' as patient, payload->>'par' as par,
       payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_consommables' and not deleted;

-- v_mouvements_stock
drop view if exists public.v_mouvements_stock cascade;
create view public.v_mouvements_stock as
select doc_id, payload->>'produit' as produit, payload->>'mvt' as sens,
       (payload->>'qte')::numeric as quantite, payload->>'motif' as motif,
       payload->>'patient' as patient, payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_stock' and not deleted;

-- v_patients_archives
drop view if exists public.v_patients_archives cascade;
create view public.v_patients_archives as
select doc_id, payload->>'id' as dossier, payload->>'ipp' as ipp, payload->>'nom' as nom,
       payload->>'service' as service, payload->>'sortie' as date_sortie,
       payload->>'archive_le' as date_archivage, payload->>'archive_par' as archive_par, updated_at
from public.medicore_sync_docs where store='patients_archives' and not deleted;

-- v_prescriptions
drop view if exists public.v_prescriptions cascade;
create view public.v_prescriptions as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'med' as medicament, payload->>'posologie' as posologie, payload->>'voie' as voie,
       payload->>'duree' as duree, payload->>'statut' as statut, payload->>'medecin' as prescripteur,
       payload->>'groupe' as ordonnance, payload->>'date' as date_presc, updated_at
from public.medicore_sync_docs where store='prescriptions' and not deleted;

-- v_prestations
drop view if exists public.v_prestations cascade;
create view public.v_prestations as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'module' as module, payload->>'libelle' as libelle, payload->>'code' as code,
       (payload->>'montant')::numeric as montant, payload->>'statut' as statut,
       payload->>'facture_id' as facture_id, payload->>'date' as date_acte, updated_at
from public.medicore_sync_docs where store='prestations' and not deleted;

-- v_produits_catalogue
drop view if exists public.v_produits_catalogue cascade;
create view public.v_produits_catalogue as
select doc_id, payload->>'code' as code, payload->>'designation' as designation,
       payload->>'famille' as famille, payload->>'dci' as dci, payload->>'forme' as forme,
       payload->>'dosage' as dosage, payload->>'conditionnement' as conditionnement,
       payload->>'unite' as unite, payload->>'fournisseur' as fournisseur,
       (payload->>'prix_achat')::numeric as prix_achat, (payload->>'prix_vente')::numeric as prix_vente,
       (payload->>'tva')::numeric as tva,
       coalesce((payload->>'stupefiant')::boolean,false) as stupefiant,
       coalesce((payload->>'thermosensible')::boolean,false) as thermosensible,
       (payload->>'stock_min')::numeric as stock_min, (payload->>'stock_secu')::numeric as stock_secu,
       (payload->>'stock_max')::numeric as stock_max,
       coalesce((payload->>'actif')::boolean,true) as actif, updated_at
from public.medicore_sync_docs where store='produits_catalogue' and not deleted;

-- v_reappro
drop view if exists public.v_reappro cascade;
create view public.v_reappro as
select doc_id, payload->>'depot' as depot, payload->>'designation' as designation,
       (payload->>'qte')::numeric as quantite, payload->>'unite' as unite,
       payload->>'statut' as statut, payload->>'motif' as motif,
       payload->>'par' as demande_par, payload->>'date' as date_demande, updated_at
from public.medicore_sync_docs where store='reappro' and not deleted;

-- v_resultats
drop view if exists public.v_resultats cascade;
create view public.v_resultats as
select doc_id, payload->>'patientId' as patient_id, payload->>'patient_nom' as patient,
       payload->>'type' as type, payload->>'libelle' as libelle,
       payload->>'conclusion' as conclusion, payload->>'par' as valide_par,
       payload->>'date' as date_res, updated_at
from public.medicore_sync_docs where store='resultats' and not deleted;

-- v_stock_alertes
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

-- v_tresorerie
drop view if exists public.v_tresorerie cascade;
create view public.v_tresorerie as
select doc_id, payload->>'libelle' as libelle, (payload->>'montant')::numeric as montant,
       payload->>'sens' as sens, payload->>'mode' as mode, payload->>'journal' as journal,
       payload->>'compte_debit' as compte_debit, payload->>'compte_credit' as compte_credit,
       payload->>'date' as date_mvt, updated_at
from public.medicore_sync_docs where store='mouvements_tresorerie' and not deleted;

-- v_urgences
drop view if exists public.v_urgences cascade;
create view public.v_urgences as
select doc_id, payload->>'nom' as patient, payload->>'ipp' as ipp, payload->>'motif' as motif,
       (payload->>'niveau')::int as niveau_triage, payload->>'statut' as statut,
       payload->>'arrivee' as arrivee, payload->>'orientation' as orientation,
       payload->>'soignant' as soignant, updated_at
from public.medicore_sync_docs where store='urgences' and not deleted;

-- v_utilisateurs
drop view if exists public.v_utilisateurs cascade;
create view public.v_utilisateurs as
select doc_id, payload->>'login' as login, payload->>'nom' as nom,
       payload->>'email' as email, payload->>'telephone' as telephone,
       payload->>'service' as service, payload->>'role' as role,
       coalesce((payload->>'notif_email')::boolean,true) as notif_email,
       coalesce((payload->>'notif_whatsapp')::boolean,true) as notif_whatsapp,
       coalesce((payload->>'twofa')::boolean,false) as twofa,
       coalesce((payload->>'actif')::boolean,true) as actif,
       coalesce((payload->>'must_change')::boolean,false) as doit_changer_mdp,
       payload->>'created_at' as cree_le, payload->>'created_par' as cree_par, updated_at
from public.medicore_sync_docs where store='utilisateurs' and not deleted;
