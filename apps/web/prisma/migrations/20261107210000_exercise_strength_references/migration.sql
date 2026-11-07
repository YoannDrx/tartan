-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "load_step_kg" DECIMAL(6,3) NOT NULL DEFAULT 1.25,
ADD COLUMN     "strength_load_kind" TEXT;

-- AlterTable
ALTER TABLE "strength_tests" ADD COLUMN     "exercise_id" UUID,
ADD COLUMN     "load_kind" TEXT;

-- CreateTable
CREATE TABLE "strength_references" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "source_test_id" UUID,
    "value_kg" DECIMAL(7,2) NOT NULL,
    "kind" TEXT NOT NULL,
    "load_kind" TEXT NOT NULL,
    "selected_by" UUID,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strength_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_strength_mappings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legacy_key" TEXT NOT NULL,
    "exercise_id" UUID NOT NULL,
    "confirmed_by" UUID,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_strength_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strength_references_organization_id_idx" ON "strength_references"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "strength_references_athlete_id_exercise_id_key" ON "strength_references"("athlete_id", "exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_strength_mappings_organization_id_legacy_key_key" ON "legacy_strength_mappings"("organization_id", "legacy_key");

-- CreateIndex
CREATE INDEX "strength_tests_athlete_id_exercise_id_idx" ON "strength_tests"("athlete_id", "exercise_id");

-- AddForeignKey
ALTER TABLE "strength_tests" ADD CONSTRAINT "strength_tests_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strength_references" ADD CONSTRAINT "strength_references_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strength_references" ADD CONSTRAINT "strength_references_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strength_references" ADD CONSTRAINT "strength_references_source_test_id_fkey" FOREIGN KEY ("source_test_id") REFERENCES "strength_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_strength_mappings" ADD CONSTRAINT "legacy_strength_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_strength_mappings" ADD CONSTRAINT "legacy_strength_mappings_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les lignes historiques restent sans rattachement jusqu'à confirmation explicite.
-- Aucune correspondance par nom, proximité orthographique ou position dans la bibliothèque.
ALTER TABLE exercises ADD CONSTRAINT exercise_load_step_positive CHECK (load_step_kg > 0);
ALTER TABLE strength_references ADD CONSTRAINT strength_reference_positive CHECK (value_kg > 0);
CREATE TRIGGER workspace_strength_reference_activity AFTER INSERT OR UPDATE ON strength_references
  FOR EACH ROW EXECUTE FUNCTION record_workspace_activity();
