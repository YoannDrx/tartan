-- Ajout sans réécriture des choix existants ; les anciens clients omettent ces colonnes.
ALTER TABLE "organizations"
  ADD COLUMN "training_objectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "available_equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
