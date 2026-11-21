-- Espace de démonstration : trois colonnes ajoutées, rien n'est retiré ni réécrit. Un espace existant reste réel.
ALTER TABLE "organizations" ADD COLUMN     "demo_expires_at" TIMESTAMP(3),
ADD COLUMN     "demo_owner_id" UUID,
ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- Un seul espace de démonstration par coach.
CREATE UNIQUE INDEX "organizations_demo_owner_id_key" ON "organizations"("demo_owner_id");

-- La purge à 14 jours lit les espaces échus.
CREATE INDEX "organizations_demo_expires_at_idx" ON "organizations"("demo_expires_at");
