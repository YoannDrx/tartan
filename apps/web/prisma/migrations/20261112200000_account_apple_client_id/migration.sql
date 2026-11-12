-- Connexion Apple native : l'identifiant qui a délivré le jeton, pour le révoquer à la suppression du compte.
ALTER TABLE "account" ADD COLUMN "apple_client_id" TEXT;
