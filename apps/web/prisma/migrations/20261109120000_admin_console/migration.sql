-- Console d'administration : miroir de facturation, remboursements, renfort d'accès, statistiques. Additif.
ALTER TABLE "user" ADD COLUMN "suspended_at" TIMESTAMP(3);

ALTER TABLE "audit_log" ADD COLUMN "metadata" JSONB;
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");
CREATE INDEX "audit_log_actor_id_at_idx" ON "audit_log"("actor_id", "at");

ALTER TABLE "subscriptions" ADD COLUMN "billing_interval" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "list_mrr_cents" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "discounted_mrr_cents" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "discount_ends_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "canceled_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "started_at" TIMESTAMP(3);

CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "organization_id" UUID,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "payment_intent_id" TEXT,
    "charge_id" TEXT,
    "number" TEXT,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "amount_paid_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "refunded_cents" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "stripe_created_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "billing_invoices_stripe_created_at_idx" ON "billing_invoices"("stripe_created_at");
CREATE INDEX "billing_invoices_organization_id_idx" ON "billing_invoices"("organization_id");
CREATE INDEX "billing_invoices_charge_id_idx" ON "billing_invoices"("charge_id");
CREATE INDEX "billing_invoices_paid_at_idx" ON "billing_invoices"("paid_at");

CREATE TABLE "billing_disputes" (
    "id" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "charge_id" TEXT NOT NULL,
    "organization_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "due_by" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_disputes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "billing_disputes_created_at_idx" ON "billing_disputes"("created_at");

CREATE TABLE "billing_refunds" (
    "id" UUID NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "organization_id" UUID,
    "livemode" BOOLEAN NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason_code" TEXT NOT NULL,
    "note" TEXT,
    "withdrawal" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "confirmation_hash" TEXT,
    "confirmation_expires_at" TIMESTAMP(3),
    "expected_refunded_cents" INTEGER NOT NULL,
    "in_flight_invoice_id" TEXT,
    "request" JSONB,
    "attempted_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" TEXT,
    "lease_until" TIMESTAMP(3),
    "last_error_code" TEXT,
    "stripe_refund_id" TEXT,
    "stripe_credit_note_id" TEXT,
    "prepared_by" UUID NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_refunds_in_flight_invoice_id_key" ON "billing_refunds"("in_flight_invoice_id");
CREATE UNIQUE INDEX "billing_refunds_stripe_refund_id_key" ON "billing_refunds"("stripe_refund_id");
CREATE UNIQUE INDEX "billing_refunds_stripe_credit_note_id_key" ON "billing_refunds"("stripe_credit_note_id");
CREATE INDEX "billing_refunds_state_attempted_at_idx" ON "billing_refunds"("state", "attempted_at");
CREATE INDEX "billing_refunds_invoice_id_idx" ON "billing_refunds"("invoice_id");

CREATE TABLE "admin_step_ups" (
    "session_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_step_ups_pkey" PRIMARY KEY ("session_id")
);
ALTER TABLE "admin_step_ups" ADD CONSTRAINT "admin_step_ups_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_daily_stats" (
    "day" DATE NOT NULL,
    "mrr_cents" INTEGER NOT NULL,
    "paying_orgs" INTEGER NOT NULL,
    "trialing" INTEGER NOT NULL,
    "past_due" INTEGER NOT NULL,
    "canceled" INTEGER NOT NULL,
    "new_paid" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "active_users_7d" INTEGER NOT NULL,
    "refunded_cents" INTEGER NOT NULL,
    CONSTRAINT "platform_daily_stats_pkey" PRIMARY KEY ("day")
);
