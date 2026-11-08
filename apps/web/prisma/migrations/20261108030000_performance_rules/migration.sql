-- Additif : les anciens clients peuvent encore écrire une marque avec son unité.
ALTER TABLE "performances"
ADD COLUMN "measurement_type" TEXT,
ADD COLUMN "record_direction" TEXT,
ADD COLUMN "comparison_context" TEXT NOT NULL DEFAULT '',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
UPDATE "performances"
SET "measurement_type" = CASE WHEN "unit" = 's' THEN 'time' ELSE 'distance' END,
    "record_direction" = CASE WHEN "unit" = 's' THEN 'lower' ELSE 'higher' END
WHERE "unit" IN ('s', 'm', 'cm');
ALTER TABLE "performances" ADD CONSTRAINT "performance_measurement_rule" CHECK (
  ("measurement_type" IS NULL AND "record_direction" IS NULL) OR
  ("measurement_type" IS NOT NULL AND "record_direction" IS NOT NULL AND (
    ("measurement_type" = 'time' AND "record_direction" = 'lower' AND "unit" = 's') OR
    ("measurement_type" = 'distance' AND "record_direction" = 'higher' AND "unit" IN ('m', 'cm'))
  ))
);
CREATE TABLE "performance_creations" (
  "id" UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "athlete_id" UUID NOT NULL REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "performance_id" UUID UNIQUE REFERENCES "performances"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
