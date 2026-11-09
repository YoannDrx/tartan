# Publication App Store et Google Play : suivi

Analyse complète, règles et sources : [Tartan, publication sur l'App Store et Google Play](https://claude.ai/artifact/8XTHiePpbBt8qg1g67Rag2). Ce fichier suit l'exécution.

## Fait le 9 novembre 2026

- Liens universels iOS en ligne sur les deux domaines.
- `discovery_limit` neutralisé dans l'app : plus aucune incitation à payer.
- `docs/fiches-stores.md` corrigé, OpenAI ajouté à `docs/conformite.md`.
- Bannière Google 1024 × 500 : `apps/mobile/store/android/feature-graphic.png`.
- `pnpm captures --store` : captures iPhone en 1320 × 2868 dans `apps/mobile/store/ios`.
- Projet Firebase `tartan-coach-app`, app Android `coach.tartan.app`, `GOOGLE_SERVICES_JSON` sur EAS.
- `EXPO_PUBLIC_SENTRY_DSN` sur EAS en production.
- Clé de signature Android créée sur EAS.
- `@sentry/cli` ajouté à `apps/mobile` : sans lui, l'archive iOS échouait.
- Archive iOS signée 1.1.0 (12), commit `8e9f9a3`, construite en local : `.local/stores/tartan-1.1.0-12.ipa` à la racine du dépôt principal.
- Build Android de production lancé sur EAS, encore en file d'attente à 18 h.

- App Store Connect : fiche 1.1.0, nom, sous-titre, catégories, classification 18+, prix gratuit, disponibilité France, URL de confidentialité. Publication réglée sur manuelle.
- App Privacy : 12 types de données saisis, non publiés. Apple demande à ce moment de garantir leur exactitude.
- Captures iPhone 1320 × 2868 dans `apps/mobile/store/ios`, dont la grille du coach. La capture de l'analyse vidéo manque : il faut un clip de démonstration.
- Écrans natifs du coach ouverts dans le thème Tartan sur simulateur : Suivi, Calendrier, Exercices, Annonces.

- Clé API « Tartan EAS Submit » (`C55W628W32`, Gestionnaire d'apps), rangée dans `~/.appstoreconnect/private_keys`, hors du dépôt.
- Archive 1.1.0 (12) envoyée à Apple le 9 novembre 2026 avec `xcrun altool`. 8 captures iPhone envoyées par l'API.

## Gestes réservés au fondateur

Compte, mot de passe, paiement ou engagement légal : Claude ne les fait pas.

### Pour débloquer les deux stores

1. GitHub, Billing : régulariser le paiement. Toute la CI est à l'arrêt.
2. Mux : ajouter une carte, puis relever le plafond vidéo depuis Configuration.
3. Faire tourner la clé OpenAI et la poser sur Vercel (`OPENAI_API_KEY`).
4. Juriste : avis écrit sur HDS, vidéos, OpenAI. Il conditionne la soumission publique.
5. Choisir le téléphone public, affiché avec l'adresse sur les deux stores.
6. Créer les comptes de revue en production, depuis ta machine :

   ```bash
   DEMO_PASSWORD='<mot de passe fort>' VERCEL_ENV=production pnpm --filter @tartan/web db:seed
   ```

   Puis accorder l'offre Coach à l'espace « Coaching Démo » depuis l'administration.

### Apple

1. `eas credentials -p ios` : créer la clé APNs. Sans elle, pas de notification iOS.
2. App Store Connect : publier les réponses App Privacy, Apple y demande ta garantie. Puis notes de revue, identifiants et coordonnées. Textes dans `docs/fiches-stores.md`.
3. Essayer le build TestFlight sur un iPhone, puis lancer « Soumettre pour vérification ».

### Google

1. Demander le D-U-N-S de Yodev (SIREN 803 272 590), jusqu'à 30 jours. Sans numéro le 20 novembre, passer en compte personnel.
2. Créer le compte Play Console, déclarer le statut de commerçant, créer l'app `coach.tartan.app`.
3. Firebase, Comptes de service : générer une clé privée, puis `eas credentials -p android` pour l'importer en FCM V1.
4. Créer un compte de service Play, l'importer sur EAS pour `eas submit`.
5. Envoyer l'AAB, relever l'empreinte SHA-256 de signature, la poser dans `ANDROID_SHA256_FINGERPRINTS`.
6. Compte personnel : test fermé, 15 à 20 testeurs, 14 jours. Puis demande d'accès à la production.

## Reste à faire côté Claude, après ces gestes

- Captures Android en 1080 × 1920 : installer un émulateur.
- Comprendre l'échec des builds iOS et Android sur EAS à l'étape « Read app config » : le même commit se construit en local en iOS. Journal lisible sur expo.dev, builds `a865c35b` et `72fbbe05`. Sans cela, pas d'AAB Android.
- Changement de compte par lien magique sans déconnexion : le simulateur est resté sur l'accueil de l'ancien rôle.
