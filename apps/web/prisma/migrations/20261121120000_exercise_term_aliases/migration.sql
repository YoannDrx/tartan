-- Planificateur en quatre étapes (21 novembre 2026). Tout est ajouté, rien n'est retiré.
-- Alias appris : le terme dit par un coach et la fiche qu'il a choisie, un seul choix par espace et par terme.
CREATE TABLE "exercise_term_aliases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "said" TEXT NOT NULL,
    "exercise_id" UUID NOT NULL,
    "author_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_term_aliases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exercise_term_aliases_organization_id_term_key" ON "exercise_term_aliases"("organization_id", "term");
CREATE INDEX "exercise_term_aliases_exercise_id_idx" ON "exercise_term_aliases"("exercise_id");
ALTER TABLE "exercise_term_aliases" ADD CONSTRAINT "exercise_term_aliases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_term_aliases" ADD CONSTRAINT "exercise_term_aliases_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_term_aliases" ADD CONSTRAINT "exercise_term_aliases_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- L'étape où une génération a échoué, à côté de sa cause.
ALTER TABLE "ai_planner_operations" ADD COLUMN "failure_step" TEXT;
