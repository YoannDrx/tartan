# Tartan

Suivi d'entraînement pour coachs d'athlétisme. Référence produit : `PRODUCT.md`, identité : `DESIGN.md`.

## Commandes

Pnpm 10 via corepack (`corepack pnpm …`).

- `pnpm db:start` : Postgres local jetable (port 54329) ; `pnpm db:migrate`, `pnpm db:seed`.
- `pnpm --filter @tartan/web demo:fill <e-mail>` : remplit un compte coach de données fictives, sans notification ; `--retirer` les enlève.
- `pnpm dev` : web et API ; `pnpm dev:mobile` : Expo.
- `pnpm test` : règles métier et contrôles d'accès (base `tartan_test`).
- `pnpm test:e2e` : Playwright ; `pnpm typecheck`, `pnpm lint`, `pnpm design:check`.

## Règles du dépôt

- Aucune requête Prisma hors de `apps/web/src/server/*` et `src/lib` : tout passe par un service qui appelle `requireOrgMember` (§ 11.4). Les notes privées ne sont jamais sélectionnées pour un athlète.
- Les règles métier pures vont dans `packages/domain`, avec tests. Les contrats (Zod) dans `packages/contracts`.
- Textes dans `packages/i18n`, couleurs dans `packages/design-tokens`.
- Aucune donnée de santé dans les journaux, notifications ou analyses d'usage. Effort ressenti, douleurs et blessures exigent le consentement santé.
- Direction artistique : rouge piste en fond, cartes encre, pas de mode clair (`DESIGN.md` prime sur le § 9.9 du cahier).
- Chaque écran passe par UI/UX Pro Max, Frontend Design puis Impeccable (§ 9.12).
- La V1 s'arrête à la roadmap du § 8 : tout ajout passe par une décision explicite.
