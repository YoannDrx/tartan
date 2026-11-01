-- Better Auth écrit des verrous dont l'identifiant n'est pas un UUID : le lien magique plantait sur un compte non vérifié.
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE TEXT;
