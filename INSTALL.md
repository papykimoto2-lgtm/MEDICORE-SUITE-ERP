# MediCore ERP — Instructions d'installation

## Structure correcte du dossier

```
medicore/            ← DOSSIER RACINE (ouvrir les .html depuis ici)
├── login.html
├── index.html
├── dpi.html
├── nav.js
├── qr.js
├── supabase.js
├── mobile.css
├── vercel.json
└── ...autres modules...
```

## ⚠️ Ne pas faire

Ne pas extraire le ZIP **dans** le dossier `medicore/` existant.  
Cela crée `medicore/medicore/` et tous les liens cassent.

## Comment mettre à jour un fichier

1. Télécharger le fichier (ex: `dpi.html`)
2. Le copier **directement** dans ton dossier `medicore/`
3. Remplacer l'ancien fichier

## Ouvrir localement

Ouvrir `login.html` dans Chrome — pas `index.html` directement.  
Login : `admin` / `Admin@2025!`

## Déploiement Vercel

Le dépôt GitHub doit avoir les fichiers **à la racine du dossier** `médiocre/`.  
Vercel → Settings → Root Directory → `médiocre`

## URL en production

https://medicore-gilt.vercel.app → login puis portail
