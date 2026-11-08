-- Additive. Existing sessions keep an unknown phase context; no historical assignment is inferred.
ALTER TABLE "scheduled_sessions" ADD COLUMN "phase_context" JSONB;
ALTER TABLE "session_prescriptions" ADD COLUMN "phase_id" UUID, ADD COLUMN "phase_version" INTEGER;
ALTER TABLE "session_prescriptions" ADD CONSTRAINT "session_prescriptions_phase_pair" CHECK (
  ("phase_id" IS NULL AND "phase_version" IS NULL) OR ("phase_id" IS NOT NULL AND "phase_version" IS NOT NULL AND "phase_version" > 0)
);
-- No phase foreign key: an explicit historical reference survives phase retirement.
-- Athlete/session deletion still cascades through the existing prescription relations.
CREATE INDEX "session_prescriptions_phase_id_idx" ON "session_prescriptions"("phase_id");
