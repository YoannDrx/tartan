import {
  isPaidPlan,
  PLANS,
  planForSubscription,
  type PlanKey,
  type PlanLimits,
  type SubscriptionState,
} from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const syncEntitlementsInTransaction = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  plan: PlanKey,
): Promise<void> => {
  for (const [key, value] of Object.entries(PLANS[plan].limits) as [keyof PlanLimits, number | null][]) {
    await tx.entitlement.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, value: { limit: value }, source: "plan" },
      update: { value: { limit: value }, source: "plan" },
    });
  }
};

// Les droits sont la seule source lue par l'app, quel que soit le canal de paiement (§ 17.3).
export const syncEntitlements = async (organizationId: string, plan: PlanKey): Promise<void> => {
  await prisma.$transaction((tx) => syncEntitlementsInTransaction(tx, organizationId, plan));
};

type SubscriptionInput = {
  organizationId: string;
  plan: PlanKey;
  status: SubscriptionState;
  provider: "stripe" | "revenuecat" | "manual";
  providerRef: string | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  now?: Date;
};

// Point unique de mise à jour : abonnement, offre de l'espace, droits. Tout est validé dans la même transaction.
export const applySubscriptionInTransaction = async (
  tx: Prisma.TransactionClient,
  input: SubscriptionInput,
): Promise<void> => {
  const now = input.now ?? new Date();
  const existing = await tx.subscription.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
  const effective = planForSubscription(input.plan, input.status);
  const paidSince =
    input.status === "active" && isPaidPlan(effective)
      ? (existing?.paidSince ?? now)
      : input.status === "canceled"
        ? null
        : (existing?.paidSince ?? null);
  const data = {
    planKey: effective,
    status: input.status,
    provider: input.provider,
    providerRef: input.providerRef,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAt: input.cancelAt,
    paidSince,
  };
  if (existing) await tx.subscription.update({ where: { id: existing.id }, data });
  else await tx.subscription.create({ data: { ...data, organizationId: input.organizationId } });
  await tx.organization.update({ where: { id: input.organizationId }, data: { plan: effective } });
  await syncEntitlementsInTransaction(tx, input.organizationId, effective);
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      action: `plan_${effective}_${input.status}`,
      entity: "subscription",
    },
  });
  log.info("subscription_applied", { organizationId: input.organizationId, status: input.status });
};

export const applySubscription = async (input: SubscriptionInput): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    // Invalide aussi toute lecture Stripe commencée avant cette modification.
    await tx.organization.update({
      where: { id: input.organizationId },
      data: { billingRevision: { increment: 1 } },
    });
    await applySubscriptionInTransaction(tx, input);
  });
};
