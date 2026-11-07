-- AlterTable
ALTER TABLE "scheduled_sessions" ADD COLUMN     "prescription_frozen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "session_prescriptions" (
    "id" UUID NOT NULL,
    "scheduled_session_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "session_version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "origin" TEXT NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_prescriptions_athlete_id_idx" ON "session_prescriptions"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_prescriptions_scheduled_session_id_athlete_id_sessi_key" ON "session_prescriptions"("scheduled_session_id", "athlete_id", "session_version");

-- AddForeignKey
ALTER TABLE "session_prescriptions" ADD CONSTRAINT "session_prescriptions_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_prescriptions" ADD CONSTRAINT "session_prescriptions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

