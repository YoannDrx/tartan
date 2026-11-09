-- Préférence d'affichage du calendrier, additive.
ALTER TABLE "profiles" ADD COLUMN "calendar_view" TEXT;
ALTER TABLE "profiles" ADD COLUMN "calendar_view_updated_at" TIMESTAMP(3);
