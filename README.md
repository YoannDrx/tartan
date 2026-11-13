# Tartan

La préparation physique du coach et de son groupe, ancrée dans l'athlétisme : séances, suivi, charges, vidéo.

Monorepo pnpm : `apps/web` (Next.js 16 : site, application et API), `apps/mobile` (Expo : iOS et Android), `packages/*` (contrats, règles métier, client d'API, jetons, textes).

Produit : [PRODUCT.md](PRODUCT.md). Identité : [DESIGN.md](DESIGN.md). Règles de développement : [AGENTS.md](AGENTS.md). État et plans : [docs/README.md](docs/README.md).

## Démarrer en local

Prérequis : Node indiqué par `.nvmrc`, Corepack, Postgres 17 (`brew install postgresql@17`).

```bash
corepack enable
corepack pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env   # puis renseigner BETTER_AUTH_SECRET
pnpm db:start
pnpm db:migrate
DEMO_PASSWORD=choisir-un-mot-de-passe pnpm db:seed
pnpm dev
```

Le workspace fixe aussi la version Node utilisée par les scripts et vérifie la version exacte de pnpm de `package.json`. Les scripts racine passent par Corepack, y compris leurs sous-commandes. Vérifier `node -v`, `corepack pnpm -v` et `corepack pnpm exec node -v` avant la recette.

Sans clé Resend, les liens de connexion s'affichent dans le terminal. Sans clé Mux, l'envoi vidéo est désactivé proprement.

## Vérifier

| Commande | Rôle |
| --- | --- |
| `pnpm test` | Règles métier et contrôles d'accès, sur une base Postgres jetable |
| `E2E_PROD=1 pnpm test:e2e` | Parcours web de bout en bout, sur build de production |
| `pnpm typecheck`, `pnpm lint` | Typage et lint |
| `pnpm design:check` | Détecteur d'anti-patterns visuels |

Le détail est dans [docs/tests/README.md](docs/tests/README.md).
