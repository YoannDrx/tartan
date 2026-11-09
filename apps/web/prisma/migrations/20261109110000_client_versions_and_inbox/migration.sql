-- Suivi des versions, diffusion des mises à jour et centre de notifications. Additif.
ALTER TABLE "profiles" ADD COLUMN "push_sessions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "push_feedback" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "push_group" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "push_product_updates" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "last_seen_release_id" TEXT;

ALTER TABLE "devices" ADD COLUMN "app_version" TEXT;
ALTER TABLE "devices" ADD COLUMN "app_version_code" INTEGER;
ALTER TABLE "devices" ADD COLUMN "update_id" TEXT;
ALTER TABLE "devices" ADD COLUMN "installation_id" UUID;
ALTER TABLE "devices" ADD COLUMN "last_seen_at" TIMESTAMP(3);
CREATE INDEX "devices_platform_app_version_code_idx" ON "devices"("platform", "app_version_code");

ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

CREATE TABLE "client_installations" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "platform" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "app_version_code" INTEGER,
    "update_id" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_installations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "client_installations_platform_app_version_code_idx" ON "client_installations"("platform", "app_version_code");
CREATE INDEX "client_installations_last_seen_at_idx" ON "client_installations"("last_seen_at");
ALTER TABLE "client_installations" ADD CONSTRAINT "client_installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "app_release_targets" (
    "id" UUID NOT NULL,
    "release_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "version_code" INTEGER,
    "delivery" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "store_checked_at" TIMESTAMP(3),
    "available_at" TIMESTAMP(3),
    "rollout_cursor" UUID,
    "notified_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_release_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_release_targets_release_id_platform_key" ON "app_release_targets"("release_id", "platform");
CREATE INDEX "app_release_targets_delivery_state_idx" ON "app_release_targets"("delivery", "state");

CREATE TABLE "app_platform_configs" (
    "platform" TEXT NOT NULL,
    "minimum_version" TEXT,
    "minimum_version_code" INTEGER,
    "reason" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_platform_configs_pkey" PRIMARY KEY ("platform")
);
