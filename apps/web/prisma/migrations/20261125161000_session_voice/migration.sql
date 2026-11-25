-- CreateTable
CREATE TABLE "coach_voice_instructions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_voice_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_voice_debriefs" (
    "session_log_id" UUID NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "session_voice_debriefs_pkey" PRIMARY KEY ("session_log_id")
);

-- CreateTable
CREATE TABLE "_CoachVoiceInstructionToScheduledSession" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CoachVoiceInstructionToScheduledSession_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CoachVoiceInstructionToSessionTemplate" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CoachVoiceInstructionToSessionTemplate_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "coach_voice_instructions_organization_id_created_by_idx" ON "coach_voice_instructions"("organization_id", "created_by");

-- CreateIndex
CREATE INDEX "coach_voice_instructions_created_at_idx" ON "coach_voice_instructions"("created_at");

-- CreateIndex
CREATE INDEX "_CoachVoiceInstructionToScheduledSession_B_index" ON "_CoachVoiceInstructionToScheduledSession"("B");

-- CreateIndex
CREATE INDEX "_CoachVoiceInstructionToSessionTemplate_B_index" ON "_CoachVoiceInstructionToSessionTemplate"("B");

-- AddForeignKey
ALTER TABLE "coach_voice_instructions" ADD CONSTRAINT "coach_voice_instructions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_voice_instructions" ADD CONSTRAINT "coach_voice_instructions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_voice_debriefs" ADD CONSTRAINT "session_voice_debriefs_session_log_id_fkey" FOREIGN KEY ("session_log_id") REFERENCES "session_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoachVoiceInstructionToScheduledSession" ADD CONSTRAINT "_CoachVoiceInstructionToScheduledSession_A_fkey" FOREIGN KEY ("A") REFERENCES "coach_voice_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoachVoiceInstructionToScheduledSession" ADD CONSTRAINT "_CoachVoiceInstructionToScheduledSession_B_fkey" FOREIGN KEY ("B") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoachVoiceInstructionToSessionTemplate" ADD CONSTRAINT "_CoachVoiceInstructionToSessionTemplate_A_fkey" FOREIGN KEY ("A") REFERENCES "coach_voice_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoachVoiceInstructionToSessionTemplate" ADD CONSTRAINT "_CoachVoiceInstructionToSessionTemplate_B_fkey" FOREIGN KEY ("B") REFERENCES "session_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Même borne qu'à la lecture du flux HTTP.
ALTER TABLE "coach_voice_instructions" ADD CHECK (octet_length("bytes") BETWEEN 1 AND 3145728);
ALTER TABLE "session_voice_debriefs" ADD CHECK (octet_length("bytes") BETWEEN 1 AND 3145728);
