CREATE TABLE "beta_testers" (
  "id" UUID PRIMARY KEY, "email" TEXT NOT NULL UNIQUE,
  "token_id" UUID NOT NULL UNIQUE, "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL, "revoked_at" TIMESTAMP(3),
  "ios" BOOLEAN NOT NULL DEFAULT false, "android" BOOLEAN NOT NULL DEFAULT false,
  "ios_needs_cleanup" BOOLEAN NOT NULL DEFAULT false, "ios_authorized" BOOLEAN NOT NULL DEFAULT false, "play_authorized" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1, "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider_failed" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "beta_testers_next_attempt_at_idx" ON "beta_testers" ("next_attempt_at");
