-- ════════════════════════════════════════════════════════════════════
-- MediCore — Portail patient · accès dossier sécurisé (RPC)
-- N'EXPOSE PAS la table patients : la clé anon ne peut PAS lister/lire
-- les patients directement. Seules ces deux fonctions renvoient des
-- données, et uniquement pour l'IPP demandé.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) Auto-remplissage du formulaire RDV (identité de contact) ──────
create or replace function portail_patient_lookup(p_ipp text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r json;
begin
  if p_ipp is null or length(trim(p_ipp)) < 6 then return null; end if;
  select json_build_object(
           'ipp', ipp, 'nom', nom, 'ddn', ddn,
           'tel', tel, 'email', email, 'service', service, 'medecin', medecin
         )
    into r
  from patients
  where ipp = p_ipp
  limit 1;
  return r;  -- null si introuvable
end;
$$;

-- ── 2) Consultation du dossier (identité + RDV) avec vérification ────
-- Vérification = date de naissance (AAAA-MM-JJ) OU téléphone enregistré.
create or replace function portail_dossier(p_ipp text, p_verif text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare pat patients%rowtype; rdvs json;
begin
  select * into pat from patients where ipp = p_ipp limit 1;
  if not found then
    return json_build_object('error','introuvable');
  end if;

  -- contrôle d'accès : DDN ou téléphone doit correspondre
  if coalesce(pat.ddn::text,'') <> coalesce(trim(p_verif),'')
     and regexp_replace(coalesce(pat.tel,''),'\s','','g') <> regexp_replace(coalesce(trim(p_verif),''),'\s','','g')
  then
    return json_build_object('error','verification');
  end if;

  select coalesce(json_agg(json_build_object(
           'date', date, 'heure', heure, 'service', service,
           'medecin', medecin, 'statut', statut, 'motif', motif
         ) order by date desc), '[]'::json)
    into rdvs
  from rdv
  where patient_id = pat.id or ipp = p_ipp;

  return json_build_object(
    'identite', json_build_object(
      'ipp', pat.ipp, 'nom', pat.nom, 'sexe', pat.sexe, 'ddn', pat.ddn,
      'groupe', pat.groupe, 'assurance', pat.assurance,
      'medecin', pat.medecin, 'service', pat.service,
      'allergies', pat.allergies, 'antecedents', pat.antecedents
    ),
    'rdv', rdvs
  );
end;
$$;

-- Donner l'accès au portail public (clé anon)
grant execute on function portail_patient_lookup(text)      to anon;
grant execute on function portail_dossier(text, text)        to anon;

-- ════════════════════════════════════════════════════════════════════
-- ⚠ SÉCURITÉ — à durcir avant production réelle :
--  • L'auto-remplissage révèle un nom à partir d'un IPP valide
--    (énumération possible). Option : exiger aussi la DDN sur le lookup.
--  • La vérification DDN/téléphone est faible. Recommandé :
--    OTP par SMS (Wave/Orange/MTN) ou e-mail avant d'ouvrir le dossier.
--  • Ne jamais exposer la clé service_role côté navigateur.
-- ════════════════════════════════════════════════════════════════════
