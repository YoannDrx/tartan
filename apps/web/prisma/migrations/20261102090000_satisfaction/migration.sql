CREATE TABLE "satisfaction_answers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recommend" BOOLEAN NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satisfaction_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "satisfaction_answers_user_id_created_at_idx" ON "satisfaction_answers"("user_id", "created_at");
CREATE INDEX "satisfaction_answers_organization_id_created_at_idx" ON "satisfaction_answers"("organization_id", "created_at");
