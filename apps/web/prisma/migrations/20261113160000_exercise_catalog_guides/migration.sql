-- Les identifiants et prescriptions existants restent inchangés.
ALTER TABLE "exercises"
  ADD COLUMN "catalog_key" TEXT,
  ADD COLUMN "source_catalog_key" TEXT,
  ADD COLUMN "catalog_version" INTEGER,
  ADD COLUMN "guide" JSONB;

CREATE UNIQUE INDEX "exercises_catalog_key_key" ON "exercises"("catalog_key");
