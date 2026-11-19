-- Un avatar prédéfini (athlète du groupe ou animal) au lieu d'une photo : une colonne ajoutée, rien n'est retiré.
-- Choisir un avatar remet avatar_url à NULL : le déclencheur profiles_enqueue_avatar met alors l'ancienne photo en file.
ALTER TABLE "profiles" ADD COLUMN "avatar_preset" TEXT;
