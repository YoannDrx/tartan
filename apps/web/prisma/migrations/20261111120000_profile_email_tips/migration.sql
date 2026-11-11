-- Conseils d'activation : un envoi que chacun peut couper d'un clic, comme le résumé hebdomadaire.
ALTER TABLE "profiles" ADD COLUMN "email_tips" BOOLEAN NOT NULL DEFAULT true;
