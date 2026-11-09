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

1. `eas credentials -p ios` : créer ou importer la clé APNs, et une clé API App Store Connect pour l'envoi.
2. App Store Connect : App Privacy, classification 18+, statut de commerçant, fiche, notes de revue. Textes dans `docs/fiches-stores.md`.
3. Essayer le build TestFlight sur un iPhone, puis lancer « Soumettre pour vérification ».

### Google

1. Demander le D-U-N-S de Yodev (SIREN 803 272 590), jusqu'à 30 jours. Sans numéro le 20 novembre, passer en compte personnel.
2. Créer le compte Play Console, déclarer le statut de commerçant, créer l'app `coach.tartan.app`.
3. Firebase, Comptes de service : générer une clé privée, puis `eas credentials -p android` pour l'importer en FCM V1.
4. Créer un compte de service Play, l'importer sur EAS pour `eas submit`.
5. Envoyer l'AAB, relever l'empreinte SHA-256 de signature, la poser dans `ANDROID_SHA256_FINGERPRINTS`.
6. Compte personnel : test fermé, 15 à 20 testeurs, 14 jours. Puis demande d'accès à la production.

## Reste à faire côté Claude, après ces gestes

- Captures iPhone : autoriser l'accès au simulateur iPhone 17 Pro Max dans le panneau.
- Écrans natifs du coach à ouvrir dans le thème Tartan, sur le même simulateur.
- Captures Android en 1080 × 1920 : installer un émulateur.
