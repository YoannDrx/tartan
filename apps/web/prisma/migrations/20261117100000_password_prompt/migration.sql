-- La proposition « définir un mot de passe » de l'accueil se referme côté serveur, pour tous les appareils :
-- une colonne ajoutée, rien n'est retiré.
ALTER TABLE "profiles" ADD COLUMN "password_prompt_dismissed_at" TIMESTAMP(3);
