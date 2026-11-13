# Tester Tartan

Les volumes et résultats datés vivent dans [ETAT.md](../ETAT.md), avec le commit, le runtime et les limites de preuve ; ils ne sont pas une garantie de couverture exhaustive. Les comptes sont dans [comptes.md](comptes.md), les tests à écrire dans [automatisation.md](automatisation.md).

## Les niveaux

| Niveau      | Outil                                               | Prouve                           | Ne prouve pas                |
| ----------- | --------------------------------------------------- | -------------------------------- | ---------------------------- |
| Règle pure  | Vitest, `packages/domain`                           | Le calcul                        | Rien du reste                |
| Service     | Vitest + Postgres réel, `apps/web/tests`            | Droits, écritures, transactions  | La route, la validation HTTP |
| Handler     | Vitest, `route.ts` importé                          | Authentification et format       | Le serveur réel              |
| Parcours    | Playwright, build de production                     | L'écran, la CSP, l'accessibilité | Le prestataire, simulé       |
| Natif       | Vitest (modules purs), Maestro (simulateur)         | Logique, parcours simulés        | Le téléphone physique        |
| Prestataire | Sandbox Stripe, `eval:planner --live`, `mux-poc.ts` | L'API réelle                     | Le parcours complet          |
| Réel        | [Recette manuelle](recette-reelle.md)               | Tout                             | C'est du temps humain        |

## Commandes

| But                               | Commande                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tout l'unitaire                   | `pnpm test`                                                                                        |
| Un fichier web                    | `pnpm --filter @tartan/web exec vitest run tests/auth.test.ts`                                     |
| Mobile                            | `pnpm --filter @tartan/mobile test`                                                                |
| Qualité                           | `pnpm typecheck`, `pnpm lint`, `pnpm design:check`, `pnpm format:check`                            |
| Navigateurs Playwright            | `pnpm --filter @tartan/web exec playwright install --with-deps chromium webkit`                    |
| Parcours en développement         | `pnpm test:e2e`                                                                                    |
| Parcours comme la CI              | `E2E_PROD=1 pnpm test:e2e`                                                                         |
| Preuve vidéo                      | `pnpm --filter @tartan/web exec playwright test video-poc --project=desktop` (sans `E2E_PROD`)     |
| Collaboration vidéo, Mux simulé   | `E2E_PROD=1 E2E_VIDEO_ENABLED=true pnpm test:e2e e2e/video-collaboration.spec.ts`                  |
| Planificateur, prestataire simulé | `E2E_PROD=1 E2E_AI_PLANNER_ENABLED=true pnpm --filter @tartan/web exec playwright test ai-planner` |
| Évaluation IA hors réseau         | `pnpm --filter @tartan/web eval:planner`                                                           |
| Sandbox Stripe                    | Voir [stripe.md](../plans/stripe.md)                                                               |

## Bases locales

`pnpm db:start` crée `tartan` (développement), `tartan_test` (Vitest), `tartan_e2e` (Playwright). À créer et migrer à la main : `tartan_capture` (captures), `tartan_v11_sandbox` (sandbox Stripe). Les suites réinitialisent leur base à chaque lancement.

## CI (`.github/workflows`)

| Workflow             | Quand                    | Contenu                                                                                              |
| -------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `ci.yml`             | PR, push sur `main`      | Lint, types, tests, design, Playwright sur build de production, preuve vidéo, planificateur simulé   |
| `mobile-native.yml`  | PR mobile, lundi, manuel | `expo-doctor`, prebuild, build Android Release, Maestro sur simulateur iOS, EAS selon le déclencheur |
| `release-mobile.yml` | Manuel                   | `eas update` ou `eas build --auto-submit`                                                            |
| `sauvegarde.yml`     | Chaque nuit              | Copie chiffrée de la base                                                                            |
| `surveillance.yml`   | Toutes les 6 h           | Contrôle de `/api/health` et du site                                                                 |

Hors CI ordinaire : sandbox Stripe, `eval:planner --live`, captures et recette sur téléphones physiques. Maestro compile une app iOS de développement signée ad hoc sur simulateur.

`ci.yml` s'arrête au bout de 60 minutes (une exécution saine peut en prendre 35 à 40) et l'installation des navigateurs au bout de 10. Si les dépôts Ubuntu ne se résolvent plus depuis le serveur GitHub, une étape de secours demande leur adresse à un résolveur public avant l'installation. Une CI qui dépasse ces durées est figée, pas lente : lis le journal de l'étape en cours avant de relancer.

## Drapeaux

| Variable                                              | Effet                                                                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_PROD`                                            | `next build` puis `next start`. Active CSP et hors ligne, désactive `video-poc`                                                                     |
| `E2E_DATABASE_URL`                                    | Base des parcours, défaut `tartan_e2e`                                                                                                              |
| `TEST_DATABASE_URL`                                   | Base de Vitest, défaut `tartan_test`                                                                                                                |
| `E2E_AI_PLANNER_ENABLED=true`                         | Ouvre le planificateur simulé                                                                                                                       |
| `E2E_VIDEO_ENABLED=true`                              | Lance un serveur SDK Mux local, ouvre l'envoi et teste les webhooks signés ; aucun appel au prestataire réel. Activé dans la recette CI principale. |
| `E2E_DISABLE_ADMIN_STEP_UP`, `E2E_DISABLE_RATE_LIMIT` | Posées par la configuration de Playwright, interdites en production                                                                                 |
| `RUN_STRIPE_SANDBOX=1`                                | Autorise la suite sandbox                                                                                                                           |
| `CAPTURE_BASE_URL`                                    | Mode captures : sans serveur ni réinitialisation                                                                                                    |
| `VIDEO_DEV_MP4_URL`                                   | Clip local à la place de Mux, inerte en production                                                                                                  |

## Pièges

- Hors CI, `reuseExistingServer` réutilise un serveur déjà lancé sur le port 3100, avec ses variables : arrête-le avant de changer de drapeau.
- `globalSetup` fait un `prisma migrate reset --force` de la base E2E à chaque lancement.
- `enforceRateLimit` n'a pas de contournement en E2E : utilise des adresses différentes.
- Un test d'administration doit utiliser une adresse de `ADMIN_EMAILS` dans `playwright.config.ts`, ou compléter cette liste.
- Les tests de passkey ne tournent que sous Chromium, avec l'authentificateur virtuel (`e2e/admin-passkey.spec.ts`).
- Sans `RESEND_API_KEY`, `next dev` écrit le lien de chaque e-mail dans la console.
- Tests hors ligne de `terrain.spec.ts` : `E2E_PROD` obligatoire.
- Les webhooks se testent avec une **vraie signature** : modèle dans `tests/mux-webhook.test.ts`.
- Mouvement réduit : `await page.emulateMedia({ reducedMotion: "reduce" })`, puis `expectNoMotion(page)` de `e2e/helpers.ts`. Tout écran animé y passe ; modèle dans `e2e/reduced-motion.spec.ts`.

## Maestro

Installé par le job `maestro` de la CI mobile ; installation locale nécessaire pour le rejouer. Depuis `apps/mobile`, après `pnpm db:start`, migration, `DEMO_PASSWORD=… pnpm db:seed`, `pnpm dev` et un build de développement sur simulateur :

```sh
maestro test -e APP_ID=coach.tartan.app.dev -e COACH_EMAIL=… -e ATHLETE_EMAIL=… -e NO_AGE_EMAIL=… -e PASSWORD=… .maestro
```

Le dossier `.maestro/destructive/` n'est pas lu par cette commande. Il contient `account-delete.yml`, qui supprime réellement le compte donné : à lancer seul, sur un compte jetable créé pour l'occasion, jamais avec `COACH_EMAIL`, `ATHLETE_EMAIL` ni un compte de production.

```sh
maestro test -e APP_ID=coach.tartan.app.dev -e DISPOSABLE_EMAIL=… -e PASSWORD=… .maestro/destructive/account-delete.yml
```

Le script `maestro:test` ne transmet pas ces variables. Les parcours exigent des séances issues de la graine ; l'absence de données ne doit pas les faire passer. Le job exécute treize flux puis la suppression d'un compte jetable, vérifiée en base.

## Couverture par domaine

« Complet » : parcours ou handler réel. « Service » : seul le service est testé.

| Domaine             | Web                                          | API native                | Mobile natif                     | Manque principal                        |
| ------------------- | -------------------------------------------- | ------------------------- | -------------------------------- | --------------------------------------- |
| Connexion, âge      | Complet                                      | Complet                   | Maestro                          | Google et Apple sans test               |
| Invitations         | Groupe et invitation nominative              | Service                   | Lien testé sur simulateur        | Réception réelle des invitations        |
| Séances, calendrier | Parcours automatisés                         | Routes testées            | Constructeur sur simulateur      | Terrain et nouveau constructeur F4      |
| Suivi, athlète      | Complet                                      | Partiel                   | Maestro                          | Routes `athlete/*`, `tracking` (T04)    |
| Force, progression  | Services et pages remplies                   | Routes et permissions     | Modules purs                     | Valeurs et provenance en recette réelle |
| Phases              | Parcours automatisés                         | Routes testées            | Maestro                          | Appareil physique                       |
| Vidéo               | Parcours avec clip simulé                    | Services et webhook signé | Capture sur simulateur           | Mux réel, upload athlète F6             |
| Planificateur IA    | Parcours, génération simulée                 | Handler                   | Maestro avec fournisseur factice | Qualification réelle F5                 |
| Notifications       | Centre et services                           | Services                  | Modules purs                     | Livraison et push physiques             |
| Facturation         | Page abonnement, services et sandbox séparée | Webhooks signés           | Sans objet                       | Checkout navigateur et paiement réel    |
| Suppression, export | Parcours et services                         | Routes testées            | Suppression jetable en CI        | Prestataires et appareil physique       |
| Administration      | Actions, accès et fiches                     | Sans objet                | Sans objet                       | Opérations réelles contrôlées           |
| Site, légal         | Complet                                      | Sans objet                | Pages `/mobile/*`                | T25                                     |
| Hors ligne          | Complet en `E2E_PROD`                        | Sans objet                | File, simulateur                 | Stade réel                              |

Point structurel : les server actions (`*.action.ts`) ne sont couvertes que par l'interface, et les parcours Maestro ne remplacent pas la recette sur appareil physique.
