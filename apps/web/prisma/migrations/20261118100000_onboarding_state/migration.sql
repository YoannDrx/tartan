-- Les premiers pas d'un membre dans un espace : une table ajoutée, rien n'est retiré ni réécrit.
CREATE TABLE "onboarding_states" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "guided" BOOLEAN NOT NULL DEFAULT true,
    "tour_seen_at" TIMESTAMP(3),
    "welcome_seen_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "celebrated_at" TIMESTAMP(3),
    "skipped" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seen_screens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_states_organization_id_user_id_key" ON "onboarding_states"("organization_id", "user_id");
CREATE INDEX "onboarding_states_user_id_idx" ON "onboarding_states"("user_id");

ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
