# MediCore ERP

ERP hospitalier pour unité de soins — Côte d'Ivoire / Zone OHADA

## Stack

- **Frontend** : HTML/CSS/JS vanilla (offline-first)
- **Backend** : Supabase (PostgreSQL + Auth + RLS)
- **Hosting** : Vercel (CDN mondial)

## Modules

| Étape | Modules |
|-------|---------|
| 1 · Parcours patient | DPI, Laboratoire, Imagerie, Bloc opératoire, Pharmacie, Facturation |
| 2 · Finance & support | Comptabilité générale, Analytique, Trésorerie, Immobilisations, Achats, RH & Paie |
| 3 · Pilotage | Tableaux de bord |
| 4 · Administration | Paramétrage |

## Déploiement

```bash
git clone https://github.com/TON_USERNAME/medicore-erp
cd medicore-erp
vercel --prod
```

## Comptes démo

| Rôle | Login | Mot de passe |
|------|-------|-------------|
| Administrateur | `admin` | `Admin@2025!` |
| Médecin | `dr.toure` | `Med@2025!` |
| Pharmacien | `pharma.konan` | `Pharm@2025!` |
| DAF | `daf.gnossoa` | `Finance@2025!` |

## Supabase

Projet : `medicore-erp` · Région : `eu-west-3` (Paris)  
25 tables · RLS activé · SYSCOHADA Révisé 2017 · FCFA
