# Comptes et données de test

Aucun mot de passe n'est écrit ici. Les valeurs vivent dans les fichiers indiqués, ou sont choisies au lancement.

## D'où viennent les comptes

| Source | Comptes | Mot de passe | Remarque |
| --- | --- | --- | --- |
| `pnpm db:seed` (`apps/web/prisma/seed.ts`) | `coach@`, `un@`, `deux@`, `trois@demo.tartan.coach`, espace Découverte, 4 séances | `DEMO_PASSWORD`, sinon aléatoire et affiché à la fin | Sans effet si le coach existe. Aucun e-mail envoyé à ce domaine |
| `pnpm --filter @tartan/web demo:fill <e-mail>` | Athlètes `fill.*@demo.tartan.coach` | Pas de mot de passe | Se connecte avec ton compte. `--retirer` pour enlever |
| `pnpm --filter @tartan/web demo:preparation` | `coach@capture.tartan.test` (Club), `athlete@capture.tartan.test` | `apps/web/prisma/demo-preparation.ts` | Base locale seulement. Sert aux captures |
| Playwright | `@e2e.tartan.test`, via `signUp` et `createCoachSpace` | `apps/web/e2e/helpers.ts` | Réinitialisés à chaque lancement |
| Vitest | `@test.tartan.coach`, via `makeUser` | Aucun | Base de test |
| Revue Apple et Google | Mêmes adresses que le seed, sur la production | Fourni par le fondateur, jamais dans le dépôt | `apps/web/prisma/reset-demo-password.ts` pour le changer |

Connexion dans le navigateur : `/connexion`, bouton « Utiliser un mot de passe ». En local sans Resend, les liens de connexion sont dans la console du serveur.

## Obtenir chaque rôle

| Rôle | En local | Dans un test |
| --- | --- | --- |
| Propriétaire | `coach@demo.tartan.coach` | `createCoachSpace` (e2e), `makeOrg` (Vitest) |
| Coach, adjoint | Invitation nominative depuis `/reglages`, lien dans la console | `addStaff(org, n, "coach" \| "assistant")` |
| Athlète | `un@demo.tartan.coach` | `joinAsAthlete` (e2e), `addAthlete` (Vitest) |
| Multi-espaces | `demo:fill <e-mail>` : propriétaire et athlète | Compte à double rôle à construire (T13) |
| Sans date de naissance | Créer le compte, puis `UPDATE profiles SET birth_date = NULL` | Requis par `age-gate` (Maestro) |
| Administrateur | Adresse dans `ADMIN_EMAILS`, ou `platformAdmin`, passkey sur `/verification-admin` | Adresses fixes dans `playwright.config.ts`, step-up coupé par `E2E_DISABLE_ADMIN_STEP_UP` |

## Obtenir chaque offre

| Offre | Comment |
| --- | --- |
| Découverte | Défaut d'un espace créé |
| Pilote | Adresse dans `COACH_SIGNUP_EMAILS` à la création, ou `makeOrg` |
| Coach, Club | Écran `/admin/espaces/[id]` → Accorder, ou en sandbox par Checkout |
| Coach en test | `UPDATE organizations SET plan='coach'`, modèle dans `e2e/ai-planner.spec.ts` |
| Club | `demo:preparation`, ou `organization.update` suivi de `syncEntitlements` |

## Drapeaux par espace

Progression, phases et IA : cases dans `/admin`, ou `UPDATE organizations SET progression_enabled=…, phases_enabled=…, ai_planner_enabled=…`. L'IA demande en plus l'accord de l'utilisateur : `profiles.ai_consent_at`.

## Stripe en test

Sandbox dédiée, identifiant dans `apps/web/tests-sandbox/stripe-cli.ts`. Cartes de test dans [stripe.md](../plans/stripe.md).

## Personas

Pour tester une fonction avec chaque rôle, un appel construit en base les comptes, espaces, groupes et offres : `apps/web/tests/personas.ts` pour Vitest (une persona se connecte par `sessionCookie(email)`, sans simuler la session) et `apps/web/e2e/personas.ts` pour Playwright. La matrice d'accès de toutes les routes s'appuie dessus : `apps/web/tests/api-authz.matrix.ts`. Une route ajoutée sans ligne dans cette matrice fait échouer `pnpm test`.
