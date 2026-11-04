-- Préférences d'e-mail : ajout seul, tout le monde reste abonné.
ALTER TABLE "profiles" ADD COLUMN "email_digest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "email_notifications" BOOLEAN NOT NULL DEFAULT true;
