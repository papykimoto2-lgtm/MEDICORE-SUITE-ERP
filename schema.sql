-- ═══════════════════════════════════════════════════════════════════════════════
-- MediCore ERP — Schéma PostgreSQL complet
-- Projet Supabase : bjsgivzfarknjfdxhqth (eu-west-3 · Paris)
-- Zone OHADA · SYSCOHADA Révisé 2017 · FCFA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PATIENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ipp             TEXT UNIQUE NOT NULL,               -- Identifiant Permanent Patient
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  date_naissance  DATE,
  sexe            TEXT CHECK (sexe IN ('M','F','Autre')),
  groupe_sanguin  TEXT,
  allergies       TEXT,
  adresse         TEXT,
  telephone       TEXT,
  contact_urgence TEXT,
  assurance       TEXT,
  num_assurance   TEXT,
  medecin_ref     TEXT,
  statut          TEXT DEFAULT 'Actif' CHECK (statut IN ('Actif','Hospitalisé','Urgences','Consultation','Ambulatoire','Sorti','Décédé')),
  service         TEXT,
  lit             TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SÉJOURS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sejours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  num_dossier     TEXT UNIQUE NOT NULL,
  date_entree     DATE NOT NULL DEFAULT CURRENT_DATE,
  date_sortie     DATE,
  motif           TEXT,
  service         TEXT,
  lit             TEXT,
  medecin         TEXT,
  mode_entree     TEXT DEFAULT 'Programmé' CHECK (mode_entree IN ('Programmé','Urgences','Transfert','Ambulatoire')),
  statut          TEXT DEFAULT 'Actif' CHECK (statut IN ('Actif','Sorti','Transféré','Décédé')),
  type_prise_en_charge TEXT DEFAULT 'Privé',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRESCRIPTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sejour_id       UUID REFERENCES sejours(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id),
  medicament      TEXT NOT NULL,
  dci             TEXT,
  posologie       TEXT,
  voie            TEXT DEFAULT 'Orale' CHECK (voie IN ('Orale','IV','IM','SC','Topique','Autre')),
  duree           TEXT,
  quantite        NUMERIC(10,2),
  prescripteur    TEXT,
  prescripteur_id UUID,
  statut          TEXT DEFAULT 'En attente validation' CHECK (statut IN ('En attente validation','Validée','Refusée','Dispensée','Terminée')),
  validee_par     UUID,
  validee_at      TIMESTAMPTZ,
  refuse_par      UUID,
  refuse_at       TIMESTAMPTZ,
  motif_refus     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LABORATOIRE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demandes_labo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  sejour_id       UUID REFERENCES sejours(id),
  type_examen     TEXT NOT NULL,
  urgence         BOOLEAN DEFAULT FALSE,
  demandeur       TEXT,
  demandeur_id    UUID,
  statut          TEXT DEFAULT 'En attente' CHECK (statut IN ('En attente','En cours','Validé','Annulé')),
  valide_par      UUID,
  valide_at       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resultats_labo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id      UUID NOT NULL REFERENCES demandes_labo(id) ON DELETE CASCADE,
  parametre       TEXT NOT NULL,
  valeur          TEXT,
  unite           TEXT,
  valeur_ref      TEXT,
  critique        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. IMAGERIE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demandes_imagerie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  sejour_id       UUID REFERENCES sejours(id),
  type_examen     TEXT NOT NULL,
  region          TEXT,
  urgence         BOOLEAN DEFAULT FALSE,
  demandeur       TEXT,
  radiologue      TEXT,
  statut          TEXT DEFAULT 'En attente' CHECK (statut IN ('En attente','Planifié','En cours','Rendu','Annulé')),
  compte_rendu    TEXT,
  conclusion      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BLOC OPÉRATOIRE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interventions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  sejour_id       UUID REFERENCES sejours(id),
  type_acte       TEXT NOT NULL,
  code_ccam       TEXT,
  salle           TEXT,
  date_prevue     DATE,
  heure_prevue    TIME,
  duree_prevue    INTEGER,  -- minutes
  chirurgien      TEXT,
  anesthesiste    TEXT,
  statut          TEXT DEFAULT 'Planifié' CHECK (statut IN ('Planifié','En cours','Terminé','Annulé','Reporté')),
  compte_rendu    TEXT,
  complications   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STOCK PHARMACIE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  dci             TEXT NOT NULL,
  designation     TEXT NOT NULL,
  forme           TEXT,
  dosage          TEXT,
  categorie       TEXT DEFAULT 'Médicament' CHECK (categorie IN ('Médicament','Consommable','DM','Stupéfiant','Autre')),
  unite           TEXT DEFAULT 'comprimé',
  stock_actuel    NUMERIC(10,2) DEFAULT 0,
  stock_mini      NUMERIC(10,2) DEFAULT 10,
  stock_maxi      NUMERIC(10,2) DEFAULT 1000,
  prix_achat      NUMERIC(14,0) DEFAULT 0,   -- FCFA
  prix_vente      NUMERIC(14,0) DEFAULT 0,   -- FCFA
  tva             NUMERIC(5,2) DEFAULT 0,
  fournisseur     TEXT,
  lot_numero      TEXT,
  date_peremption DATE,
  statut          TEXT DEFAULT 'Actif' CHECK (statut IN ('Actif','Inactif','Rupture')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id      UUID NOT NULL REFERENCES produits(id),
  type_mvt        TEXT NOT NULL CHECK (type_mvt IN ('Entrée','Sortie','Retour','Ajustement','Péremption')),
  quantite        NUMERIC(10,2) NOT NULL,
  stock_avant     NUMERIC(10,2),
  stock_apres     NUMERIC(10,2),
  reference       TEXT,
  patient_id      UUID REFERENCES patients(id),
  prescription_id UUID REFERENCES prescriptions(id),
  utilisateur     TEXT,
  utilisateur_id  UUID,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FACTURATION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_facture     TEXT UNIQUE NOT NULL,
  patient_id      UUID REFERENCES patients(id),
  sejour_id       UUID REFERENCES sejours(id),
  date_facture    DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance   DATE,
  montant_ht      NUMERIC(14,0) DEFAULT 0,
  tva             NUMERIC(14,0) DEFAULT 0,
  montant_ttc     NUMERIC(14,0) DEFAULT 0,
  montant_paye    NUMERIC(14,0) DEFAULT 0,
  montant_reste   NUMERIC(14,0) DEFAULT 0,
  mode_paiement   TEXT DEFAULT 'Espèces',
  tiers_payant    BOOLEAN DEFAULT FALSE,
  assurance       TEXT,
  taux_prise_en_charge NUMERIC(5,2) DEFAULT 0,
  statut          TEXT DEFAULT 'En attente' CHECK (statut IN ('En attente','Partielle','Payée','Annulée','Contentieux')),
  paie_par        UUID,
  paie_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lignes_facture (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id      UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation     TEXT NOT NULL,
  code_acte       TEXT,
  quantite        NUMERIC(10,2) DEFAULT 1,
  prix_unitaire   NUMERIC(14,0) DEFAULT 0,
  tva             NUMERIC(5,2) DEFAULT 0,
  montant         NUMERIC(14,0) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. COMPTABILITÉ GÉNÉRALE — SYSCOHADA Révisé 2017
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_comptable (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_compte      TEXT UNIQUE NOT NULL,
  libelle         TEXT NOT NULL,
  classe          TEXT,
  type_compte     TEXT CHECK (type_compte IN ('Actif','Passif','Charge','Produit','Résultat')),
  actif           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecritures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_piece       TEXT,
  date_ecrit      DATE NOT NULL DEFAULT CURRENT_DATE,
  journal         TEXT NOT NULL DEFAULT 'VT' CHECK (journal IN ('VT','ACH','BQ','CA','OD','AN','EX')),
  num_compte      TEXT NOT NULL,
  libelle         TEXT NOT NULL,
  debit           NUMERIC(14,0) DEFAULT 0,
  credit          NUMERIC(14,0) DEFAULT 0,
  lettrage        TEXT,
  rapproche       BOOLEAN DEFAULT FALSE,
  rapproche_at    TIMESTAMPTZ,
  reference_id    UUID,                    -- lien facture / commande
  reference_type  TEXT,
  exercice        INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  saisi_par       TEXT,
  saisi_par_id    UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. COMPTABILITÉ ANALYTIQUE — Classe 9 SYSCOHADA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS centres_cout (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  libelle         TEXT NOT NULL,
  type_centre     TEXT DEFAULT 'Principal',
  responsable     TEXT,
  actif           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecritures_analytiques (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecriture_id     UUID REFERENCES ecritures(id),
  centre_cout_id  UUID REFERENCES centres_cout(id),
  num_compte_ana  TEXT,
  libelle         TEXT,
  montant         NUMERIC(14,0) DEFAULT 0,
  sens            TEXT CHECK (sens IN ('Charge','Produit')),
  date_ecrit      DATE NOT NULL DEFAULT CURRENT_DATE,
  exercice        INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. TRÉSORERIE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comptes_tresorerie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  libelle         TEXT NOT NULL,
  type_compte     TEXT DEFAULT 'Banque' CHECK (type_compte IN ('Banque','Caisse','Pétite caisse')),
  num_compte_sysc TEXT,
  banque          TEXT,
  num_rib         TEXT,
  solde_initial   NUMERIC(14,0) DEFAULT 0,
  solde_actuel    NUMERIC(14,0) DEFAULT 0,
  actif           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mouvements_tresorerie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_id       UUID NOT NULL REFERENCES comptes_tresorerie(id),
  date_mvt        DATE NOT NULL DEFAULT CURRENT_DATE,
  type_mvt        TEXT NOT NULL CHECK (type_mvt IN ('Encaissement','Décaissement','Virement')),
  libelle         TEXT NOT NULL,
  reference       TEXT,
  montant         NUMERIC(14,0) DEFAULT 0,
  solde_avant     NUMERIC(14,0),
  solde_apres     NUMERIC(14,0),
  rapproche       BOOLEAN DEFAULT FALSE,
  date_valeur     DATE,
  saisi_par       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. IMMOBILISATIONS — Classe 2 SYSCOHADA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS immobilisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_immo       TEXT UNIQUE NOT NULL,
  designation     TEXT NOT NULL,
  famille         TEXT,
  num_serie       TEXT,
  num_inventaire  TEXT,
  localisation    TEXT,
  service         TEXT,
  date_acquisition DATE,
  valeur_brute    NUMERIC(14,0) DEFAULT 0,
  duree_amort     INTEGER,                -- mois
  taux_amort      NUMERIC(5,2),
  valeur_nette    NUMERIC(14,0) DEFAULT 0,
  amort_cumule    NUMERIC(14,0) DEFAULT 0,
  num_compte_sysc TEXT DEFAULT '224',
  statut          TEXT DEFAULT 'En service' CHECK (statut IN ('En service','En maintenance','Hors service','Cédé','Mis au rebut')),
  fournisseur     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dotations_amortissement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immobilisation_id UUID NOT NULL REFERENCES immobilisations(id) ON DELETE CASCADE,
  exercice        INTEGER NOT NULL,
  mois            INTEGER,
  montant         NUMERIC(14,0) DEFAULT 0,
  valeur_nette    NUMERIC(14,0) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. ACHATS & LOGISTIQUE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fournisseurs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  raison_sociale  TEXT NOT NULL,
  contact         TEXT,
  telephone       TEXT,
  email           TEXT,
  adresse         TEXT,
  num_compte_sysc TEXT DEFAULT '401',
  delai_livraison INTEGER DEFAULT 7,
  conditions_paiement TEXT DEFAULT '30 jours',
  statut          TEXT DEFAULT 'Actif' CHECK (statut IN ('Actif','Inactif','Suspendu')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commandes_achat (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_commande    TEXT UNIQUE NOT NULL,
  fournisseur_id  UUID REFERENCES fournisseurs(id),
  date_commande   DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_prevue DATE,
  montant_ht      NUMERIC(14,0) DEFAULT 0,
  tva             NUMERIC(14,0) DEFAULT 0,
  montant_ttc     NUMERIC(14,0) DEFAULT 0,
  statut          TEXT DEFAULT 'Brouillon' CHECK (statut IN ('Brouillon','Validée','Envoyée','Livrée partielle','Livrée','Annulée')),
  valide_par      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lignes_commande (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id     UUID NOT NULL REFERENCES commandes_achat(id) ON DELETE CASCADE,
  produit_id      UUID REFERENCES produits(id),
  designation     TEXT NOT NULL,
  quantite        NUMERIC(10,2) DEFAULT 1,
  quantite_livree NUMERIC(10,2) DEFAULT 0,
  prix_unitaire   NUMERIC(14,0) DEFAULT 0,
  tva             NUMERIC(5,2) DEFAULT 18,
  montant         NUMERIC(14,0) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RH & PAIE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personnel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule       TEXT UNIQUE NOT NULL,
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  date_naissance  DATE,
  sexe            TEXT CHECK (sexe IN ('M','F')),
  fonction        TEXT,
  grade           TEXT,
  service         TEXT,
  specialite      TEXT,
  date_embauche   DATE,
  type_contrat    TEXT DEFAULT 'CDI' CHECK (type_contrat IN ('CDI','CDD','Vacataire','Stage','Prestataire')),
  salaire_base    NUMERIC(14,0) DEFAULT 0,   -- FCFA
  cnps            TEXT,
  num_ordre       TEXT,
  diplome         TEXT,
  telephone       TEXT,
  email           TEXT,
  statut          TEXT DEFAULT 'Actif' CHECK (statut IN ('Actif','Congé','Absent','Suspendu','Retraité','Démissionnaire')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulletins_paie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id    UUID NOT NULL REFERENCES personnel(id),
  mois            INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee           INTEGER NOT NULL,
  salaire_base    NUMERIC(14,0) DEFAULT 0,
  primes          NUMERIC(14,0) DEFAULT 0,
  heures_sup      NUMERIC(14,0) DEFAULT 0,
  astreintes      NUMERIC(14,0) DEFAULT 0,
  brut            NUMERIC(14,0) DEFAULT 0,
  cnps_salarie    NUMERIC(14,0) DEFAULT 0,   -- 6,3%
  its             NUMERIC(14,0) DEFAULT 0,   -- Impôt sur traitement
  retenues        NUMERIC(14,0) DEFAULT 0,
  net_a_payer     NUMERIC(14,0) DEFAULT 0,
  cnps_patronal   NUMERIC(14,0) DEFAULT 0,   -- 7,7%
  statut          TEXT DEFAULT 'Brouillon' CHECK (statut IN ('Brouillon','Validé','Payé')),
  paye_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id    UUID NOT NULL REFERENCES personnel(id),
  type_conge      TEXT DEFAULT 'Annuel' CHECK (type_conge IN ('Annuel','Maladie','Maternité','Sans solde','Récupération')),
  date_debut      DATE NOT NULL,
  date_fin        DATE NOT NULL,
  nb_jours        INTEGER,
  statut          TEXT DEFAULT 'En attente' CHECK (statut IN ('En attente','Approuvé','Refusé','Annulé')),
  approuve_par    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL,
  module          TEXT,
  entite_id       TEXT,
  detail          TEXT,
  auteur_id       UUID,
  auteur_nom      TEXT,
  role            TEXT,
  ip              TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. BUS ÉVÉNEMENTS INTER-MODULES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bus_evenements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  payload         JSONB DEFAULT '{}',
  source          TEXT,
  lu              BOOLEAN DEFAULT FALSE,
  lu_at           TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. PARAMÉTRAGE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parametrage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle             TEXT UNIQUE NOT NULL,
  valeur          TEXT,
  description     TEXT,
  module          TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_ipp          ON patients(ipp);
CREATE INDEX IF NOT EXISTS idx_patients_statut       ON patients(statut);
CREATE INDEX IF NOT EXISTS idx_sejours_patient       ON sejours(patient_id);
CREATE INDEX IF NOT EXISTS idx_sejours_statut        ON sejours(statut);
CREATE INDEX IF NOT EXISTS idx_prescriptions_sejour  ON prescriptions(sejour_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_statut  ON prescriptions(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_labo_patient ON demandes_labo(patient_id);
CREATE INDEX IF NOT EXISTS idx_demandes_labo_statut  ON demandes_labo(statut);
CREATE INDEX IF NOT EXISTS idx_factures_patient      ON factures(patient_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut       ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_ecritures_date        ON ecritures(date_ecrit);
CREATE INDEX IF NOT EXISTS idx_ecritures_compte      ON ecritures(num_compte);
CREATE INDEX IF NOT EXISTS idx_mouvements_produit    ON mouvements_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_bus_lu                ON bus_evenements(lu, type);
CREATE INDEX IF NOT EXISTS idx_audit_created         ON audit_log(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- FONCTION RPC : get_balance (balance des comptes SYSCOHADA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_balance()
RETURNS TABLE(num_compte TEXT, libelle TEXT, debit NUMERIC, credit NUMERIC, solde NUMERIC)
LANGUAGE SQL
AS $$
  SELECT
    e.num_compte,
    COALESCE(p.libelle, e.num_compte) AS libelle,
    SUM(e.debit)  AS debit,
    SUM(e.credit) AS credit,
    SUM(e.debit) - SUM(e.credit) AS solde
  FROM ecritures e
  LEFT JOIN plan_comptable p ON p.num_compte = e.num_compte
  GROUP BY e.num_compte, p.libelle
  ORDER BY e.num_compte;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : Row Level Security (activé, accès via clé anon autorisé)
-- Adapter selon vos rôles Supabase Auth en production
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sejours                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandes_labo            ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultats_labo           ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandes_imagerie        ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock         ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_facture           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comptable           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecritures                ENABLE ROW LEVEL SECURITY;
ALTER TABLE centres_cout             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecritures_analytiques    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptes_tresorerie       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_tresorerie    ENABLE ROW LEVEL SECURITY;
ALTER TABLE immobilisations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dotations_amortissement  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes_achat          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_commande          ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletins_paie           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conges                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_evenements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametrage              ENABLE ROW LEVEL SECURITY;

-- Politique temporaire : accès complet via clé anon (phase développement)
-- ⚠️ Remplacer par des politiques rôle-based avant mise en production
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'patients','sejours','prescriptions','demandes_labo','resultats_labo',
    'demandes_imagerie','interventions','produits','mouvements_stock',
    'factures','lignes_facture','plan_comptable','ecritures','centres_cout',
    'ecritures_analytiques','comptes_tresorerie','mouvements_tresorerie',
    'immobilisations','dotations_amortissement','fournisseurs','commandes_achat',
    'lignes_commande','personnel','bulletins_paie','conges',
    'audit_log','bus_evenements','parametrage'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DONNÉES INITIALES — Plan comptable SYSCOHADA (comptes clés CHU)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO plan_comptable (num_compte, libelle, classe, type_compte) VALUES
('101', 'Capital',                              '1', 'Passif'),
('106', 'Réserves',                             '1', 'Passif'),
('164', 'Emprunts établissements de crédit',    '1', 'Passif'),
('211', 'Terrains',                             '2', 'Actif'),
('213', 'Constructions',                        '2', 'Actif'),
('224', 'Matériel médical & technique',         '2', 'Actif'),
('226', 'Matériel informatique',                '2', 'Actif'),
('228', 'Mobilier de bureau',                   '2', 'Actif'),
('244', 'Matériel de transport',                '2', 'Actif'),
('281', 'Amortissements immobilisations incorp.','2', 'Actif'),
('284', 'Amortissements matériel & outillage',  '2', 'Actif'),
('371', 'Stocks médicaments',                   '3', 'Actif'),
('372', 'Stocks consommables médicaux',         '3', 'Actif'),
('401', 'Fournisseurs',                         '4', 'Passif'),
('404', 'Fournisseurs immobilisations',         '4', 'Passif'),
('411', 'Clients / Patients',                   '4', 'Actif'),
('421', 'Personnel — Rémunérations dues',       '4', 'Passif'),
('431', 'Sécurité sociale & organismes',        '4', 'Passif'),
('437', 'Autres organismes sociaux',            '4', 'Passif'),
('441', 'État — Subventions à recevoir',        '4', 'Actif'),
('511', 'Banque BGFIBANK',                      '5', 'Actif'),
('512', 'Banque ECOBANK',                       '5', 'Actif'),
('513', 'Banque BNI CI',                        '5', 'Actif'),
('530', 'Caisse principale',                    '5', 'Actif'),
('601', 'Achats matières premières',            '6', 'Charge'),
('602', 'Achats produits pharmaceutiques',      '6', 'Charge'),
('604', 'Achats études & prestations',          '6', 'Charge'),
('606', 'Achats non stockés',                   '6', 'Charge'),
('641', 'Rémunérations personnel médical',      '6', 'Charge'),
('644', 'Rémunérations personnel non-médical',  '6', 'Charge'),
('645', 'Charges sécurité sociale',             '6', 'Charge'),
('681', 'Dotations aux amortissements',         '6', 'Charge'),
('706', 'Prestations soins — CNAM-CI',          '7', 'Produit'),
('707', 'Ventes produits (rétrocession)',        '7', 'Produit'),
('731', 'Subventions exploitation',             '7', 'Produit'),
('741', 'Dotations globales financement',       '7', 'Produit'),
('901', 'Charges analytiques personnel',        '9', 'Charge'),
('902', 'Charges analytiques médicaments',      '9', 'Charge'),
('971', 'Produits analytiques soins',           '9', 'Produit')
ON CONFLICT (num_compte) DO NOTHING;

-- Paramètres établissement par défaut
INSERT INTO parametrage (cle, valeur, description, module) VALUES
('etablissement_nom',     'CHU MediCore',              'Nom de l''établissement',      'general'),
('etablissement_pays',    'Côte d''Ivoire',             'Pays',                        'general'),
('etablissement_ville',   'Abidjan',                   'Ville',                        'general'),
('exercice_courant',      '2025',                      'Exercice comptable courant',   'comptabilite'),
('devise',                'FCFA',                      'Devise',                       'general'),
('tva_taux_defaut',       '18',                        'Taux TVA par défaut (%)',      'facturation'),
('cnps_salarie',          '6.3',                       'Taux CNPS salarié (%)',        'rh'),
('cnps_patronal',         '7.7',                       'Taux CNPS patronal (%)',       'rh'),
('stock_alerte_auto',     'true',                      'Alertes stock automatiques',   'pharmacie')
ON CONFLICT (cle) DO NOTHING;

-- Centres de coût analytiques par défaut
INSERT INTO centres_cout (code, libelle, type_centre) VALUES
('MED',  'Médecine Générale',    'Principal'),
('CHIR', 'Chirurgie',            'Principal'),
('URG',  'Urgences',             'Principal'),
('LABO', 'Laboratoire',          'Principal'),
('IMG',  'Imagerie',             'Principal'),
('PUI',  'Pharmacie (PUI)',      'Principal'),
('ADM',  'Administration',       'Support'),
('TECH', 'Services Techniques',  'Support')
ON CONFLICT (code) DO NOTHING;

-- Comptes de trésorerie par défaut
INSERT INTO comptes_tresorerie (code, libelle, type_compte, num_compte_sysc, banque) VALUES
('CAISSE',    'Caisse principale',   'Caisse',  '530',  NULL),
('BGFI',      'BGFIBANK',            'Banque',  '511',  'BGFIBANK CI'),
('ECOBANK',   'ECOBANK CI',          'Banque',  '512',  'ECOBANK CI'),
('BNI',       'BNI Côte d''Ivoire',  'Banque',  '513',  'BNI CI')
ON CONFLICT (code) DO NOTHING;
