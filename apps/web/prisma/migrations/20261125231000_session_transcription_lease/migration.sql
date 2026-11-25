CREATE TABLE "session_transcription_leases" (
  "voice_version" UUID PRIMARY KEY,
  "token" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "session_transcription_leases_expires_at_idx" ON "session_transcription_leases" ("expires_at");
