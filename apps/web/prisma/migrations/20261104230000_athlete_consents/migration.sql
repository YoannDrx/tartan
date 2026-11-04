-- Consentement santé et vidéo par fiche d'athlète. La table consents reste écrite pendant la transition.
CREATE TABLE "athlete_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "athlete_id" UUID NOT NULL,
    "kind" "consent_kind" NOT NULL,
    "version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "athlete_consents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "athlete_consents_athlete_id_kind_key" ON "athlete_consents"("athlete_id", "kind");
ALTER TABLE "athlete_consents" ADD CONSTRAINT "athlete_consents_athlete_id_fkey"
  FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise : un compte à une seule fiche garde son accord. Avec plusieurs fiches, seule celle
-- que l'accord désignait le reçoit ; les autres restent sans accord et le redemanderont.
INSERT INTO "athlete_consents" ("athlete_id", "kind", "version", "granted_at", "revoked_at")
SELECT a."id", c."kind", c."version", c."granted_at", c."revoked_at"
FROM "consents" c
JOIN "athletes" a ON a."user_id" = c."user_id"
WHERE c."kind" IN ('health', 'video')
  AND (
    c."athlete_id" = a."id"
    OR (SELECT count(*) FROM "athletes" other WHERE other."user_id" = c."user_id") = 1
  )
ON CONFLICT ("athlete_id", "kind") DO NOTHING;

-- Supprimer une fiche ne doit plus emporter l'accord du compte aux conditions.
ALTER TABLE "consents" DROP CONSTRAINT "consents_athlete_id_fkey";
ALTER TABLE "consents" ADD CONSTRAINT "consents_athlete_id_fkey"
  FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
