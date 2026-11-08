-- Ajout compatible avec les applications déjà publiées. Une ancienne validation n'est pas une nouvelle fête.
ALTER TABLE "session_logs" ADD COLUMN "celebration_claimed_at" TIMESTAMP(3);
UPDATE "session_logs"
SET "celebration_claimed_at" = COALESCE("completed_at", "created_at")
WHERE "status" = 'done';
