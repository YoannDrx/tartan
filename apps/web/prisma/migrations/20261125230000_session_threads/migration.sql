ALTER TABLE "coach_voice_instructions"
  ADD COLUMN "duration_seconds" DOUBLE PRECISION,
  ADD COLUMN "transcript" TEXT;
ALTER TABLE "session_voice_debriefs"
  ADD COLUMN "author_id" UUID REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD COLUMN "duration_seconds" DOUBLE PRECISION,
  ADD COLUMN "transcript" TEXT,
  ADD COLUMN "voice_version" UUID NOT NULL DEFAULT gen_random_uuid();

-- Le débrief historique ne pouvait être déposé que par le titulaire de la fiche.
UPDATE session_voice_debriefs d SET author_id = a.user_id
  FROM session_logs l JOIN athletes a ON a.id = l.athlete_id WHERE d.session_log_id = l.id;

-- Un serveur d'une version précédente peut encore remplacer un débrief.
-- La transcription et la durée associées à l'ancien audio doivent disparaître.
CREATE FUNCTION invalidate_debrief_transcript() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.author_id IS NULL OR NEW.voice_version = OLD.voice_version THEN
    SELECT a.user_id INTO NEW.author_id FROM session_logs l JOIN athletes a ON a.id = l.athlete_id WHERE l.id = NEW.session_log_id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.voice_version = OLD.voice_version THEN
    NEW.voice_version := gen_random_uuid();
    NEW.duration_seconds := NULL;
  END IF;
  NEW.transcript := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invalidate_debrief_transcript BEFORE INSERT OR UPDATE OF bytes, mime_type ON session_voice_debriefs
  FOR EACH ROW EXECUTE FUNCTION invalidate_debrief_transcript();

CREATE TABLE "session_thread_messages" (
  "id" UUID PRIMARY KEY,
  "position" BIGSERIAL NOT NULL,
  "scheduled_session_id" UUID NOT NULL REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "athlete_id" UUID NOT NULL REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "item_ref" TEXT,
  "debrief_log_id" UUID REFERENCES "session_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "author_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "author_is_athlete" BOOLEAN NOT NULL,
  "client_id" UUID NOT NULL,
  "content_hash" TEXT NOT NULL,
  "text" TEXT,
  "mime_type" TEXT,
  "bytes" BYTEA,
  "duration_seconds" DOUBLE PRECISION,
  "transcript" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("item_ref" IS NULL) <> ("debrief_log_id" IS NULL)),
  CHECK (("bytes" IS NULL AND "mime_type" IS NULL AND "duration_seconds" IS NULL AND "transcript" IS NULL
                          AND "text" IS NOT NULL AND char_length("text") BETWEEN 1 AND 2000)
      OR ("bytes" IS NOT NULL AND octet_length("bytes") BETWEEN 1 AND 3145728 AND "mime_type" IS NOT NULL
                          AND "duration_seconds" IS NOT NULL AND "text" IS NULL))
);
CREATE UNIQUE INDEX "session_thread_messages_author_id_client_id_key" ON "session_thread_messages"("author_id", "client_id");
CREATE INDEX "session_thread_messages_scheduled_session_id_athlete_id_ite_idx" ON "session_thread_messages"("scheduled_session_id","athlete_id","item_ref","position");
CREATE INDEX "session_thread_messages_athlete_id_idx" ON "session_thread_messages"("athlete_id");
CREATE INDEX "session_thread_messages_debrief_log_id_idx" ON "session_thread_messages"("debrief_log_id");

-- Une ancienne application peut aussi corriger une validation terminée.
CREATE FUNCTION erase_reopened_debrief_thread() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM session_thread_messages WHERE debrief_log_id = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER erase_reopened_debrief_thread AFTER UPDATE OF status ON session_logs
  FOR EACH ROW WHEN (OLD.status = 'done' AND NEW.status <> 'done') EXECUTE FUNCTION erase_reopened_debrief_thread();
