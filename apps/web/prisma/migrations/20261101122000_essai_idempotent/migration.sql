-- AlterTable
ALTER TABLE "jump_attempts" ADD COLUMN "client_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "jump_attempts_athlete_id_client_id_key" ON "jump_attempts"("athlete_id", "client_id");
