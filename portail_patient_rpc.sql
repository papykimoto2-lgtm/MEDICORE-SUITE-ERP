-- ════════════════════════════════════════════════════════════════════
-- MediCore — Portail patient · accès dossier sécurisé (RPC)
-- IMPORTANT : MediCore synchronise tout dans la table générique JSONB
--   public.medicore_sync_docs (store, doc_id, payload, deleted, updated_at)
-- Les patients (store='patients') et résultats (store='resultats') y vivent.
-- Ces fonctions SECURITY DEFINER lisent ce store et ne renvoient que
-- l'IPP demandé, sans exposer l'ensemble des données.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) Auto-remplissage du formulaire RDV (identité de contact) ──────
create or replace function portail_patient_lookup(p_ipp text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pat jsonb;
begin
  if p_ipp is null or length(trim(p_ipp)) < 6 then return null; end if;
  select payload into pat
  from medicore_sync_docs
  where store='patients' and not deleted and payload->>'ipp' = p_ipp
  limit 1;
  if pat is null then return null; end if;
  return jsonb_build_object(
    'ipp', pat->>'ipp', 'nom', pat->>'nom', 'ddn', pat->>'ddn',
    'tel', pat->>'tel', 'email', pat->>'email',
    'service', pat->>'service', 'medecin', pat->>'medecin'
  );
end;
$$;

-- ── 2) Consultation du dossier (identité + RDV + résultats d'analyse) ─
-- Vérification = date de naissance (AAAA-MM-JJ) OU téléphone enregistré.
create or replace function portail_dossier(p_ipp text, p_verif text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pat jsonb; pid text; rdvs jsonb; res jsonb;
begin
  select payload into pat
  from medicore_sync_docs
  where store='patients' and not deleted and payload->>'ipp' = p_ipp
  limit 1;

  if pat is null then
    return jsonb_build_object('error','introuvable');
  end if;

  -- contrôle d'accès : DDN ou téléphone doit correspondre
  if coalesce(pat->>'ddn','') <> coalesce(trim(p_verif),'')
     and regexp_replace(coalesce(pat->>'tel',''),'\s','','g')
         <> regexp_replace(coalesce(trim(p_verif),''),'\s','','g')
  then
    return jsonb_build_object('error','verification');
  end if;

  pid := pat->>'id';   -- identifiant local du patient (ex. D300004), clé des résultats

  -- ── Résultats d'analyse validés (biologie / imagerie) ──
  select coalesce(jsonb_agg(jsonb_build_object(
           'date',       payload->>'date',
           'type',       payload->>'type',
           'libelle',    payload->>'libelle',
           'conclusion', payload->>'conclusion',
           'params',     payload->'params'
         ) order by payload->>'date' desc), '[]'::jsonb)
    into res
  from medicore_sync_docs
  where store='resultats' and not deleted
    and payload->>'patientId' = pid
    and coalesce(payload->>'statut','validé') = 'validé';

  -- ── Rendez-vous (table dédiée rdv ; vide si absente) ──
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'date', date, 'heure', heure, 'service', service,
             'medecin', medecin, 'statut', statut, 'motif', motif
           ) order by date desc), '[]'::jsonb)
      into rdvs
    from rdv
    where ipp = p_ipp or patient_id = pid;
  exception when undefined_table then
    rdvs := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'identite', jsonb_build_object(
      'ipp', pat->>'ipp', 'nom', pat->>'nom', 'sexe', pat->>'sexe', 'ddn', pat->>'ddn',
      'groupe', pat->>'groupe', 'assurance', pat->>'assurance',
      'medecin', pat->>'medecin', 'service', pat->>'service',
      'allergies', pat->>'allergies', 'antecedents', pat->>'antecedents'
    ),
    'rdv', rdvs,
    'resultats', res
  );
end;
$$;

grant execute on function portail_patient_lookup(text)  to anon;
grant execute on function portail_dossier(text, text)    to anon;

-- ════════════════════════════════════════════════════════════════════
-- ⚠ SÉCURITÉ — à durcir avant production réelle :
--  • La policy p_sync_all (medicore_sync_docs) autorise déjà la clé anon
--    à TOUT lire. À restreindre en production (RLS par rôle / Auth JWT).
--  • L'auto-remplissage révèle un nom à partir d'un IPP valide
--    (énumération). Option : exiger aussi la DDN sur le lookup.
--  • La vérification DDN/téléphone est faible → OTP SMS (Wave/Orange/MTN)
--    ou e-mail recommandé avant d'ouvrir le dossier.
--  • Ne jamais exposer la clé service_role côté navigateur.
-- ════════════════════════════════════════════════════════════════════
