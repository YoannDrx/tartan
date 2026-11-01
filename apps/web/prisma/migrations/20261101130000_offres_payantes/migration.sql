-- Offres de lancement : pilot, discovery, coach, club (§ 12.6)
ALTER TYPE "organization_plan" RENAME VALUE 'free' TO 'discovery';
ALTER TYPE "organization_plan" RENAME VALUE 'pro' TO 'coach';
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'discovery';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "paid_since" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);
