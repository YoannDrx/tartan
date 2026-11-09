-- Ouverture : progression, phases et planificateur actifs par défaut.
-- Le planificateur reste inerte tant que la variable globale AI_PLANNER_ENABLED ne vaut pas true.
ALTER TABLE "organizations" ALTER COLUMN "progression_enabled" SET DEFAULT true;
ALTER TABLE "organizations" ALTER COLUMN "phases_enabled" SET DEFAULT true;
ALTER TABLE "organizations" ALTER COLUMN "ai_planner_enabled" SET DEFAULT true;
UPDATE "organizations" SET "progression_enabled" = true, "phases_enabled" = true, "ai_planner_enabled" = true;
