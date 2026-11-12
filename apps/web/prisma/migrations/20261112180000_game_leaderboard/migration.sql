-- Classement du jeu du site : trois tables nouvelles, rien n'est modifié ni retiré.
CREATE TABLE "game_runs" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "device_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    CONSTRAINT "game_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "game_runs_created_at_idx" ON "game_runs"("created_at");

CREATE TABLE "game_scores" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "pseudo" TEXT NOT NULL,
    "device_hash" TEXT NOT NULL,
    "ip_hash" TEXT,
    "sim_version" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_scores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "game_scores_event_id_created_at_idx" ON "game_scores"("event_id", "created_at");
CREATE INDEX "game_scores_device_hash_idx" ON "game_scores"("device_hash");

CREATE TABLE "game_bans" (
    "id" UUID NOT NULL,
    "device_hash" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_bans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "game_bans_device_hash_key" ON "game_bans"("device_hash");
