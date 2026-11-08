-- AlterTable
ALTER TABLE "ai_planner_operations" ADD COLUMN     "proposal_id" UUID;

-- CreateTable
CREATE TABLE "ai_planner_proposals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "creation_fingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'processing',
    "version" INTEGER NOT NULL DEFAULT 1,
    "clarification_count" INTEGER NOT NULL DEFAULT 0,
    "selection" JSONB NOT NULL,
    "bindings" JSONB NOT NULL,
    "messages" JSONB NOT NULL,
    "interpretation" JSONB,
    "active_operation_id" UUID NOT NULL,
    "pending_message" TEXT,
    "committed_at" TIMESTAMP(3),
    "commit_fingerprint" TEXT,
    "draft_ids" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_planner_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_planner_proposals_organization_id_actor_id_created_at_idx" ON "ai_planner_proposals"("organization_id", "actor_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_planner_proposals_expires_at_idx" ON "ai_planner_proposals"("expires_at");

-- AddForeignKey
ALTER TABLE "ai_planner_proposals" ADD CONSTRAINT "ai_planner_proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_planner_proposals" ADD CONSTRAINT "ai_planner_proposals_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE ai_planner_operations DROP CONSTRAINT ai_planner_operations_cost;
ALTER TABLE ai_planner_operations ADD CONSTRAINT ai_planner_operations_cost CHECK ((kind = 'proposal' AND proposal_cost = 1 AND audio_seconds = 0 AND proposal_id IS NULL) OR (kind = 'transcription' AND proposal_cost = 0 AND audio_seconds BETWEEN 1 AND 180 AND proposal_id IS NULL) OR (kind = 'clarification' AND proposal_cost = 0 AND audio_seconds = 0 AND proposal_id IS NOT NULL));
ALTER TABLE ai_planner_proposals ADD CONSTRAINT ai_planner_proposals_bounds CHECK (clarification_count BETWEEN 0 AND 5 AND version > 0);
ALTER TABLE ai_planner_proposals ADD CONSTRAINT ai_planner_proposals_state CHECK (state IN ('processing','clarification','proposal','failed','committed'));
