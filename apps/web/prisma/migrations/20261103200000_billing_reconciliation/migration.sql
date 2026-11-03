ALTER TABLE "organizations" ADD COLUMN "billing_revision" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "billing_synced_at" TIMESTAMP(3),
    ADD COLUMN "billing_sync_attempted_at" TIMESTAMP(3);
