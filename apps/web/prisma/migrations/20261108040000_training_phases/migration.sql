CREATE TABLE "training_phases" (
  "id" UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "group_id" UUID REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "athlete_id" UUID REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_by" UUID REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "start_date" DATE NOT NULL, "end_date" DATE NOT NULL,
  "objective" TEXT NOT NULL DEFAULT '', "description" TEXT NOT NULL DEFAULT '', "private_note" TEXT NOT NULL DEFAULT '',
  "published_at" TIMESTAMP(3), "deleted_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "creation_fingerprint" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_phase_one_target" CHECK (("group_id" IS NULL) <> ("athlete_id" IS NULL)),
  CONSTRAINT "training_phase_dates" CHECK ("start_date" <= "end_date"),
  CONSTRAINT "training_phase_kind" CHECK ("kind" IN ('general', 'development', 'intensification', 'taper', 'competition', 'recovery', 'custom'))
);
CREATE INDEX "training_phases_organization_id_start_date_end_date_idx" ON "training_phases"("organization_id", "start_date", "end_date");
CREATE INDEX "training_phases_group_id_idx" ON "training_phases"("group_id");
CREATE INDEX "training_phases_athlete_id_idx" ON "training_phases"("athlete_id");
