-- Les vidéos d'exercice peuvent venir d'Instagram. La nouvelle valeur n'est utilisable qu'après ce commit.
ALTER TYPE "media_kind" ADD VALUE 'instagram';

ALTER TABLE "exercise_media" ADD COLUMN "instagram_code" TEXT;
ALTER TABLE "exercise_media" ADD COLUMN "author" TEXT;
