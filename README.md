# Tartan

Le carnet d'entraînement partagé du coach d'athlé et de son groupe : séances, suivi et vidéo.
Monorepo pnpm : `apps/web` (Next.js 16, site, app et API), `apps/mobile` (Expo, iOS et Android), `packages/*` (contrats, règles métier, client d'API, jetons, textes).

Produit : [PRODUCT.md](PRODUCT.md). Identité : [DESIGN.md](DESIGN.md). Ce qu'il reste à faire de ton côté : [docs/lancement.md](docs/lancement.md).

## Démarrer en local

Prérequis : Node 22, Corepack, Postgres 17 (`brew install postgresql@17`).

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env   # puis renseigner BETTER_AUTH_SECRET
pnpm db:start
pnpm db:migrate
DEMO_PASSWORD=choisir-un-mot-de-passe pnpm --filter @tartan/web exec tsx --env-file=.env prisma/seed.ts
pnpm dev
```

Sans clé Resend, les liens de connexion s'affichent dans le terminal. Sans clé Mux, l'envoi vidéo est désactivé proprement.

## Vérifier

| Commande                      | Rôle                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `pnpm test`                   | Règles métier et contrôles d'accès, sur une base Postgres jetable |
| `pnpm test:e2e`               | Parcours web de bout en bout (Playwright), accessibilité comprise |
| `pnpm typecheck`, `pnpm lint` | Typage et lint                                                    |
| `pnpm design:check`           | Détecteur d'anti-patterns d'Impeccable                            |
