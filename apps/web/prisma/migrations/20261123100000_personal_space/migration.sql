-- Espace personnel de l'athlète autonome : un type d'espace, une offre et deux colonnes ajoutés, rien n'est retiré
-- ni réécrit. Un espace existant reste l'espace d'un coach.

-- Offre gratuite de l'espace personnel. Une valeur ajoutée à l'énumération n'est utilisée qu'après cette migration.
ALTER TYPE "organization_plan" ADD VALUE IF NOT EXISTS 'personal';

CREATE TYPE "organization_kind" AS ENUM ('coach', 'personal');

ALTER TABLE "organizations" ADD COLUMN     "kind" "organization_kind" NOT NULL DEFAULT 'coach',
ADD COLUMN     "personal_owner_id" UUID;

-- Un seul espace personnel par compte.
CREATE UNIQUE INDEX "organizations_personal_owner_id_key" ON "organizations"("personal_owner_id");
