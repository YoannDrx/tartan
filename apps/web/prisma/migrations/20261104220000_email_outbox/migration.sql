-- Boîte d'envoi : une transition d'abonnement produit un seul mail, même rejouée.
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "to_email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_outbox_dedupe_key_key" ON "email_outbox"("dedupe_key");
CREATE INDEX "email_outbox_sent_at_next_attempt_at_idx" ON "email_outbox"("sent_at", "next_attempt_at");
