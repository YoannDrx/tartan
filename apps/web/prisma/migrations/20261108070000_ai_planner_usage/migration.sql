-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "time_zone" TEXT NOT NULL DEFAULT 'Europe/Paris';

-- CreateTable
CREATE TABLE "ai_planner_quotas" (
    "organization_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "reserved_proposals" INTEGER NOT NULL DEFAULT 0,
    "used_proposals" INTEGER NOT NULL DEFAULT 0,
    "reserved_audio_seconds" INTEGER NOT NULL DEFAULT 0,
    "used_audio_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_planner_quotas_pkey" PRIMARY KEY ("organization_id","month")
);

-- CreateTable
CREATE TABLE "ai_planner_operations" (
    "organization_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "kind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "proposal_cost" INTEGER NOT NULL,
    "audio_seconds" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "lease_token" UUID,
    "lease_until" TIMESTAMP(3) NOT NULL,
    "result" JSONB,
    "failure_code" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_planner_operations_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateIndex
CREATE INDEX "ai_planner_operations_state_lease_until_idx" ON "ai_planner_operations"("state", "lease_until");

-- CreateIndex
CREATE INDEX "ai_planner_operations_expires_at_idx" ON "ai_planner_operations"("expires_at");

-- CreateIndex
CREATE INDEX "ai_planner_operations_actor_id_idx" ON "ai_planner_operations"("actor_id");

-- AddForeignKey
ALTER TABLE "ai_planner_quotas" ADD CONSTRAINT "ai_planner_quotas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_planner_operations" ADD CONSTRAINT "ai_planner_operations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_planner_operations" ADD CONSTRAINT "ai_planner_operations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Défense en profondeur : un remboursement ne rend jamais les compteurs négatifs.
ALTER TABLE ai_planner_quotas ADD CONSTRAINT ai_planner_quotas_nonnegative CHECK (reserved_proposals >= 0 AND used_proposals >= 0 AND reserved_audio_seconds >= 0 AND used_audio_seconds >= 0);
ALTER TABLE ai_planner_operations ADD CONSTRAINT ai_planner_operations_cost CHECK ((kind = 'proposal' AND proposal_cost = 1 AND audio_seconds = 0) OR (kind = 'transcription' AND proposal_cost = 0 AND audio_seconds BETWEEN 1 AND 180));
ALTER TABLE ai_planner_operations ADD CONSTRAINT ai_planner_operations_state CHECK (state IN ('pending', 'succeeded', 'refunded'));
ALTER TABLE ai_planner_operations ADD CONSTRAINT ai_planner_operations_lease CHECK ((state = 'pending' AND lease_token IS NOT NULL) OR (state <> 'pending' AND lease_token IS NULL));
