-- CreateTable
CREATE TABLE "ai_planner_transcriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'processing',
    "version" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT,
    "audio_seconds" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_planner_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_planner_transcriptions_organization_id_actor_id_idx" ON "ai_planner_transcriptions"("organization_id", "actor_id");

-- CreateIndex
CREATE INDEX "ai_planner_transcriptions_expires_at_idx" ON "ai_planner_transcriptions"("expires_at");

-- AddForeignKey
ALTER TABLE "ai_planner_transcriptions" ADD CONSTRAINT "ai_planner_transcriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_planner_transcriptions" ADD CONSTRAINT "ai_planner_transcriptions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE ai_planner_transcriptions ADD CONSTRAINT ai_planner_transcriptions_bounds CHECK (audio_seconds BETWEEN 1 AND 180 AND version > 0);
ALTER TABLE ai_planner_transcriptions ADD CONSTRAINT ai_planner_transcriptions_state CHECK ((state = 'ready' AND text IS NOT NULL AND length(text) BETWEEN 1 AND 12000) OR (state IN ('processing', 'failed') AND text IS NULL));
