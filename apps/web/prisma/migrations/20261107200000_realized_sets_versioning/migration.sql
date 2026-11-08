ALTER TABLE "organizations"
  ADD COLUMN "progression_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phases_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ai_planner_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scheduled_sessions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "session_logs"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "session_version" INTEGER,
  ADD COLUMN "prescription_snapshot" JSONB,
  ADD COLUMN "recorded_by" UUID;
ALTER TABLE "set_logs"
  ADD COLUMN "exercise_id" UUID,
  ADD COLUMN "set_kind" TEXT,
  ADD COLUMN "load_kind" TEXT,
  ADD COLUMN "repetition_scope" TEXT,
  ADD COLUMN "side_count" INTEGER,
  ADD COLUMN "ground_contacts" INTEGER;

CREATE TABLE "session_log_mutations" (
  "id" UUID NOT NULL,
  "session_log_id" UUID NOT NULL,
  "client_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_log_mutations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_log_mutations_session_log_id_fkey" FOREIGN KEY ("session_log_id")
    REFERENCES "session_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "session_log_mutations_session_log_id_client_id_key"
  ON "session_log_mutations"("session_log_id", "client_id");
-- Conserver aussi la dernière mutation connue des anciennes applications.
INSERT INTO "session_log_mutations" ("id", "session_log_id", "client_id", "version")
  SELECT gen_random_uuid(), "id", "client_id", "version" FROM "session_logs" WHERE "client_id" IS NOT NULL
  ON CONFLICT DO NOTHING;
