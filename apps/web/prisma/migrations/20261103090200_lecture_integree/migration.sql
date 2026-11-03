-- Certains auteurs interdisent la lecture hors d'Instagram : la fiche renvoie alors vers la publication.
ALTER TABLE "exercise_media" ADD COLUMN "embeddable" BOOLEAN NOT NULL DEFAULT true;

-- Essayé le 3 novembre 2026 : ces deux publications refusent la lecture intégrée.
UPDATE "exercise_media" SET "embeddable" = false WHERE "instagram_code" IN ('DeKl2zopMw9', 'DYzRfXosYt_');
