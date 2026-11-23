-- Partage de l'historique personnel d'un athlète autonome avec l'espace d'un coach : une table et une énumération
-- ajoutées, rien n'est retiré ni réécrit. Rien n'est copié : la ligne dit seulement ce qui se lit, et jusqu'à quand.

CREATE TYPE "history_share_scope" AS ENUM ('records', 'strength', 'sessions');

CREATE TABLE "history_shares" (
    "id" UUID NOT NULL,
    "personal_organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "scopes" "history_share_scope"[] DEFAULT ARRAY[]::"history_share_scope"[],
    "granted_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "history_shares_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "history_shares_user_id_idx" ON "history_shares"("user_id");

CREATE INDEX "history_shares_organization_id_idx" ON "history_shares"("organization_id");

-- Un partage par fiche dans l'espace du coach : le redonner met à jour la même ligne.
CREATE UNIQUE INDEX "history_shares_athlete_id_key" ON "history_shares"("athlete_id");

-- L'espace personnel, l'espace du coach, la fiche ou le compte qui disparaît emporte le partage.
ALTER TABLE "history_shares" ADD CONSTRAINT "history_shares_personal_organization_id_fkey" FOREIGN KEY ("personal_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "history_shares" ADD CONSTRAINT "history_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "history_shares" ADD CONSTRAINT "history_shares_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "history_shares" ADD CONSTRAINT "history_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
