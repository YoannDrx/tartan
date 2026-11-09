-- Mouvement travaillé sur une vidéo. Additif.
ALTER TABLE "videos" ADD COLUMN "exercise_id" UUID;
CREATE INDEX "videos_exercise_id_idx" ON "videos"("exercise_id");
ALTER TABLE "videos" ADD CONSTRAINT "videos_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
