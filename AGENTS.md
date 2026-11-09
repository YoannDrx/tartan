# Tartan : règles pour les agents

Ce fichier vaut pour tout agent de développement, Codex comme Claude. Il est la seule source des règles du dépôt.

Tartan est l'application de préparation physique du coach et de son groupe, ancrée dans l'athlétisme. V1 réservée aux adultes, en France. Web et PWA d'abord, iOS et Android ensuite.

## Par où commencer

Lis dans cet ordre, avant toute modification :

1. [docs/ETAT.md](docs/ETAT.md) : où on en est, ce qui est prouvé, ce qui reste à faire.
2. [docs/JOURNAL.md](docs/JOURNAL.md) : les dernières passations entre agents.
3. [docs/README.md](docs/README.md) : la carte des documents. Ouvre seulement le plan de ta tâche.
4. [PRODUCT.md](PRODUCT.md) pour le produit, [DESIGN.md](DESIGN.md) dès que tu touches à l'interface.

## Pile technique

Monorepo pnpm 10, Node 22, via corepack (`corepack pnpm …`).

| Dossier | Rôle |
| --- | --- |
| `apps/web` | Next.js 16 : site, application, API, cron. Prisma 7, Postgres (Neon), Better Auth |
| `apps/mobile` | Expo 55 : iOS et Android |
| `packages/domain` | Règles métier pures, avec tests |
| `packages/contracts` | Contrats Zod partagés |
| `packages/api-client` | Client HTTP du mobile |
| `packages/i18n` | Tous les textes |
| `packages/design-tokens` | Toutes les couleurs |

Prestataires : Vercel, Neon, Stripe, Mux, Resend, OpenAI, Sentry, Expo (EAS).

## Commandes

| But | Commande |
| --- | --- |
| Base locale jetable (port 54329) | `pnpm db:start`, puis `pnpm db:migrate` et `pnpm db:seed` |
| Lancer | `pnpm dev` (web et API), `pnpm dev:mobile` (Expo) |
| Contrôles rapides | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm design:check` |
| Parcours web, comme la CI | `E2E_PROD=1 pnpm test:e2e` |
| Remplir un compte de données fictives | `pnpm --filter @tartan/web demo:fill <e-mail>`, `--retirer` pour les enlever |

Le détail, les comptes de test et les pièges sont dans [docs/tests/README.md](docs/tests/README.md).

## Règles du code

- Aucune requête Prisma hors de `apps/web/src/server/*` et `src/lib`. Tout passe par un service qui appelle `requireOrgMember`.
- Les notes privées du coach ne sont jamais sélectionnées pour un athlète.
- Les règles métier pures vont dans `packages/domain`, avec tests. Les contrats vont dans `packages/contracts`.
- Aucun texte en dur : `packages/i18n`. Aucune couleur en dur : `packages/design-tokens`.
- Aucune donnée de santé dans les journaux, les notifications ou les analyses d'usage. Effort ressenti, douleurs et blessures exigent le consentement santé.
- Migrations additives uniquement. On n'enlève pas une colonne encore lue par un client en circulation.
- Un appel à un SDK asynchrone est toujours attendu, sans `as unknown as`. Le webhook Mux est resté inopérant une semaine à cause de cela.

Dans le code, les commentaires « § 11.4 » renvoient à l'ancien cahier des charges, qui n'est pas dans le dépôt : ils ne sont pas à suivre, et n'en ajoute pas.

## Règles de l'interface

- `DESIGN.md` prime. Thème Tartan par défaut : fond piste, cartes encre, accent citron, lignes blanches.
- Tout écran modifié est regardé rendu à 390, 768 et 1440 px, sans débordement ni erreur axe.
- Sur iOS et Android, aucune mention de prix, d'offre payante ou de lien d'achat (règles Apple 3.1.1 et Google sur les paiements).

## Règles de sécurité

- **Le dépôt est public.** Aucun secret, identifiant de compte, adresse de base ou donnée réelle dans le code, les docs, les commits, les PR ou les journaux de CI.
- Les secrets vivent sur Vercel, EAS et GitHub. Un agent ne les lit pas et ne les saisit pas : il donne au fondateur la commande à lancer.
- Hors production, la base de production et une clé Stripe réelle sont refusées au démarrage (`assertEnvIsolation`). Ne contourne pas cette garde.
- Pas d'essai sur la production avec des comptes créés pour l'occasion. Les essais se font en local ou sur la Preview.
- Toute action payante, légale, ou engageant un compte du fondateur lui revient. Voir la colonne « Qui » de `docs/ETAT.md`.

## Méthode de travail

1. Prends une tâche identifiée dans `docs/ETAT.md` ou un plan. Une tâche, une branche, une PR.
2. Nomme la branche `feat/…`, `fix/…`, `docs/…`, `test/…`. Message de commit en anglais, au format conventionnel.
3. Ne reprends jamais une branche ouverte par un autre agent sans le dire dans le journal.
4. Avant la PR : `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm design:check`, et `E2E_PROD=1 pnpm test:e2e` dès qu'un parcours web change.
5. Une PR se fusionne CI verte, avec accord du fondateur. Après fusion, vérifie le déploiement avec `/api/v1/version` et les journaux Vercel.
6. Dans la PR : mets à jour `docs/ETAT.md` et ajoute une entrée à `docs/JOURNAL.md`.

## Ce que veut dire « fait »

Trois niveaux, à ne jamais confondre : **codé**, **testé automatiquement**, **éprouvé en réel**. Écris le niveau atteint, pas l'intention. Une fonction n'est « éprouvée » que vérifiée en production, ou sur la plateforme réelle pour le mobile. Un test qui simule le prestataire ne prouve pas le prestataire.

## La vente

Les inscriptions restent fermées tant que les portes de [docs/plans/commercialisation.md](docs/plans/commercialisation.md) ne sont pas franchies. Le réglage vit dans `/admin/configuration` et n'appartient qu'au fondateur.

La V1 s'arrête au périmètre décrit dans `PRODUCT.md` : tout ajout passe par une décision explicite du fondateur.
