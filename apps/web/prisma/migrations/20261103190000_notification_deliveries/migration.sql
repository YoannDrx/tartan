ALTER TABLE "notifications" ADD COLUMN "delivery_initialized_at" TIMESTAMP(3),
    ADD COLUMN "delivery_completed_at" TIMESTAMP(3);

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "target_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "device_id" UUID,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMP(3),
    "lease_token" UUID,
    "receipt_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_deliveries_state_check" CHECK ("state" IN ('pending', 'receipt', 'accepted', 'failed', 'skipped')),
    CONSTRAINT "notification_deliveries_channel_check" CHECK ("channel" IN ('web', 'expo', 'email'))
);
CREATE UNIQUE INDEX "notification_deliveries_notification_id_target_key_key" ON "notification_deliveries"("notification_id", "target_key");
CREATE INDEX "notification_deliveries_state_next_attempt_at_idx" ON "notification_deliveries"("state", "next_attempt_at");
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
