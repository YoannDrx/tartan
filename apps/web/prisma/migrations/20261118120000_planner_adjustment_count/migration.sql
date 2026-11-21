-- Les ajustements d'une proposition ont leur propre compteur, distinct des précisions. Colonne ajoutée, rien n'est retiré.
ALTER TABLE "ai_planner_proposals" ADD COLUMN "adjustment_count" INTEGER NOT NULL DEFAULT 0;
