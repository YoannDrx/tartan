import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { billingEnabled, stripe } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { subscriptionsForCustomer } from "./stripe-subscriptions.service";

export const enqueueBillingCancellation = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  externalRef: string,
): Promise<void> => {
  await tx.billingCommand.createMany({
    data: [{ organizationId, externalRef, kind: "cancel_at_period_end" }],
    skipDuplicates: true,
  });
};

export const enqueueCustomerCancellation = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  customer: string,
) => {
  await tx.billingCommand.createMany({
    data: [{ organizationId, externalRef: customer, kind: "close_customer_checkout" }],
    skipDuplicates: true,
  });
};

const closeCustomerCheckout = async (customer: string, organizationId: string) => {
  const client = stripe();
  const intent = await prisma.checkoutIntent.findUnique({ where: { organizationId } });
  let sessionId = intent?.sessionId;
  if (intent?.request && !intent.sessionId) {
    // Résoudre également le POST dont le worker a perdu la réponse avant son départ.
    if (!intent.attemptedAt || Date.now() - intent.attemptedAt.getTime() >= 23 * 3600_000) {
      await prisma.checkoutIntent.update({ where: { id: intent.id }, data: { state: "review" } });
      throw new Error("checkout_resolution_required");
    }
    const recovered = await client.checkout.sessions.create(
      intent.request as unknown as Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: `checkout-${intent.id}-${intent.generation}` },
    );
    sessionId = recovered.id;
    await prisma.checkoutIntent.updateMany({
      where: { id: intent.id, generation: intent.generation, sessionId: null },
      data: { sessionId: recovered.id, url: recovered.url, expiresAt: new Date(recovered.expires_at * 1000) },
    });
  }
  if (sessionId) {
    const session = await client.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") {
      if ((await client.checkout.sessions.expire(sessionId)).status !== "expired")
        throw new Error("stripe_checkout_not_expired");
    } else if (session.status === "complete") {
      const subscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscription) await stopSubscription(subscription);
    } else if (session.status !== "expired") throw new Error("stripe_checkout_state_unknown");
  }
  for (let page = 0; ; page++) {
    if (page === 10) throw new Error("stripe_checkout_pagination_limit");
    const result = await client.checkout.sessions.list({ customer, status: "open", limit: 100 });
    for (const session of result.data) {
      const expired = await client.checkout.sessions.expire(session.id);
      if (expired.status !== "expired") throw new Error("stripe_checkout_not_expired");
    }
    if (!result.has_more) break;
  }
  // Après expiration : même un paiement achevé juste avant le départ sera retrouvé.
  for (const subscription of await subscriptionsForCustomer(customer)) {
    if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
      await stopSubscription(subscription.id);
    }
  }
};

const stopSubscription = async (id: string) => {
  try {
    await stripe().subscriptions.update(id, { cancel_at_period_end: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 400) {
      // Une première exécution peut avoir réussi avant la panne, puis la période avoir expiré.
      const current = await stripe().subscriptions.retrieve(id);
      if (current.status === "canceled") return;
    }
    throw error;
  }
};

export const processBillingCommands = async (now = new Date()) => {
  if (!billingEnabled()) return { done: 0, failed: 0 };
  const due = await prisma.billingCommand.findMany({
    where: { state: "pending", nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let done = 0;
  let failed = 0;
  for (const command of due) {
    const leaseToken = randomUUID();
    const claimed = await prisma.billingCommand.updateMany({
      where: { id: command.id, state: "pending", OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      data: { leaseToken, leaseUntil: new Date(now.getTime() + 120_000), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      // Mise à jour d'un état absolu : un rejeu, même après 24 h, ne crée aucun paiement.
      if (command.kind === "close_customer_checkout")
        await closeCustomerCheckout(command.externalRef, command.organizationId);
      else await stopSubscription(command.externalRef);
      await prisma.billingCommand.updateMany({
        where: { id: command.id, leaseToken },
        data: { state: "done", completedAt: now, leaseToken: null, leaseUntil: null, lastErrorCode: null },
      });
      done++;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "statusCode" in error
          ? `http_${String(error.statusCode)}`
          : "provider_error";
      await prisma.billingCommand.updateMany({
        where: { id: command.id, leaseToken },
        data: {
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: code,
          nextAttemptAt: new Date(now.getTime() + Math.min(1440, 2 ** (command.attempts + 1)) * 60_000),
        },
      });
      log.error("billing_command_failed", { organizationId: command.organizationId, entityId: command.id, code });
      failed++;
    }
  }
  return { done, failed };
};
