# Tester Tartan

Volume actuel : environ 700 tests serveur, 240 de domaine, 190 mobile, 80 parcours Playwright (multipliés par projet), 8 parcours Maestro. Les comptes sont dans [comptes.md](comptes.md), les tests à écrire dans [automatisation.md](automatisation.md).

## Les niveaux

| Niveau | Outil | Prouve | Ne prouve pas |
| --- | --- | --- | --- |
| Règle pure | Vitest, `packages/domain` | Le calcul | Rien du reste |
| Service | Vitest + Postgres réel, `apps/web/tests` | Droits, écritures, transactions | La route, la validation HTTP |
| Handler | Vitest, `route.ts` importé | Authentification et format | Le serveur réel |
| Parcours | Playwright, build de production | L'écran, la CSP, l'accessibilité | Le prestataire, simulé |
| Natif | Vitest (modules purs), Maestro (simulateur) | Logique, parcours simulés | Le téléphone physique |
| Prestataire | Sandbox Stripe, `eval:planner --live`, `mux-poc.ts` | L'API réelle | Le parcours complet |
| Réel | [Recette manuelle](recette-reelle.md) | Tout | C'est du temps humain |

## Commandes

| But | Commande |
| --- | --- |
| Tout l'unitaire | `pnpm test` |
| Un fichier web | `pnpm --filter @tartan/web exec vitest run tests/auth.test.ts` |
| Mobile | `pnpm --filter @tartan/mobile test` |
| Qualité | `pnpm typecheck`, `pnpm lint`, `pnpm design:check`, `pnpm format:check` |
| Navigateurs Playwright | `pnpm --filter @tartan/web exec playwright install --with-deps chromium webkit` |
| Parcours en développement | `pnpm test:e2e` |
| Parcours comme la CI | `E2E_PROD=1 pnpm test:e2e` |
| Preuve vidéo | `pnpm --filter @tartan/web exec playwright test video-poc --project=desktop` (sans `E2E_PROD`) |
| Planificateur, prestataire simulé | `E2E_PROD=1 E2E_AI_PLANNER_ENABLED=true pnpm --filter @tartan/web exec playwright test ai-planner` |
| Évaluation IA hors réseau | `pnpm --filter @tartan/web eval:planner` |
| Sandbox Stripe | Voir [stripe.md](../plans/stripe.md) |

## Bases locales

`pnpm db:start` crée `tartan` (développement), `tartan_test` (Vitest), `tartan_e2e` (Playwright). À créer et migrer à la main : `tartan_capture` (captures), `tartan_v11_sandbox` (sandbox Stripe). Les suites réinitialisent leur base à chaque lancement.

## CI (`.github/workflows`)

| Workflow | Quand | Contenu |
| --- | --- | --- |
| `ci.yml` | PR, push sur `main` | Lint, types, tests, design, Playwright sur build de production, preuve vidéo, planificateur simulé |
| `mobile-native.yml` | PR mobile, lundi, manuel | `expo-doctor`, prebuild, build Android Release, EAS |
| `release-mobile.yml` | Manuel | `eas update` ou `eas build --auto-submit` |
| `sauvegarde.yml` | Chaque nuit | Copie chiffrée de la base |
| `surveillance.yml` | Toutes les 6 h | Contrôle de `/api/health` et du site |

Hors CI : Maestro, sandbox Stripe, `eval:planner --live`, captures, compilation iOS sur PR.

## Drapeaux

| Variable | Effet |
| --- | --- |
| `E2E_PROD` | `next build` puis `next start`. Active CSP et hors ligne, désactive `video-poc` |
| `E2E_DATABASE_URL` | Base des parcours, défaut `tartan_e2e` |
| `TEST_DATABASE_URL` | Base de Vitest, défaut `tartan_test` |
| `E2E_AI_PLANNER_ENABLED=true` | Ouvre le planificateur simulé |
| `E2E_DISABLE_ADMIN_STEP_UP`, `E2E_DISABLE_RATE_LIMIT` | Posées par la configuration de Playwright, interdites en production |
| `RUN_STRIPE_SANDBOX=1` | Autorise la suite sandbox |
| `CAPTURE_BASE_URL` | Mode captures : sans serveur ni réinitialisation |
| `VIDEO_DEV_MP4_URL` | Clip local à la place de Mux, inerte en production |

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

Non installé par défaut, absent de la CI. Depuis `apps/mobile`, après `pnpm db:start`, migration, `DEMO_PASSWORD=… pnpm db:seed`, `pnpm dev` et un build de développement sur simulateur :

```sh
maestro test -e APP_ID=coach.tartan.app.dev -e COACH_EMAIL=… -e ATHLETE_EMAIL=… -e NO_AGE_EMAIL=… -e PASSWORD=… .maestro
```

Le dossier `.maestro/destructive/` n'est pas lu par cette commande. Il contient `account-delete.yml`, qui supprime réellement le compte donné : à lancer seul, sur un compte jetable créé pour l'occasion, jamais avec `COACH_EMAIL`, `ATHLETE_EMAIL` ni un compte de production.

```sh
maestro test -e APP_ID=coach.tartan.app.dev -e DISPOSABLE_EMAIL=… -e PASSWORD=… .maestro/destructive/account-delete.yml
```

Le script `maestro:test` ne transmet pas ces variables. `athlete-validate` et `athlete-session-mode` passent au vert si aucune séance n'est visible, et `coach-tracking` n'ouvre pas l'appel : voir T09.

## Couverture par domaine

« Complet » : parcours ou handler réel. « Service » : seul le service est testé.

| Domaine | Web | API native | Mobile natif | Manque principal |
| --- | --- | --- | --- | --- |
| Connexion, âge | Complet | Complet | Maestro | Google et Apple sans test |
| Invitations | Lien de groupe complet | Service | Refus de lien seulement | Invitation nominative de coach (T12) |
| Séances, calendrier | Complet | Complet | Modules purs | Écrans natifs (T24) |
| Suivi, athlète | Complet | Partiel | Maestro conditionnel | Routes `athlete/*`, `tracking` (T04) |
| Force, progression | Complet, sauf `/progres` | Partiel | Rien | T19 |
| Phases | Complet | Complet | Module pur | T24 |
| Vidéo | Parcours avec clip simulé | Service | Modules purs | T10 |
| Planificateur IA | Parcours, génération simulée | Handler | Écrans non joués | T23, T24 |
| Notifications | Service | Service | Modules purs | T18, T21 |
| Facturation | Accessibilité seulement | Service | Sans objet | T01, T03, T14 |
| Suppression, export | Web complet | Service | Avant confirmation | T07 |
| Administration | Lecture et accès | Sans objet | Sans objet | T05, T06, T20 |
| Site, légal | Complet | Sans objet | Pages `/mobile/*` | T25 |
| Hors ligne | Complet en `E2E_PROD` | Sans objet | File, simulateur | Stade réel |

Point structurel : les server actions (`*.action.ts`) ne sont couvertes que par l'interface, et aucun écran natif n'a de test de rendu.
