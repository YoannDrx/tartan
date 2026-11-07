import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { type CheckoutIntent, Prisma } from "@/generated/prisma/client";
import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const busy = () => new AppError(409, "checkout_in_progress", m.billing.checkoutInProgress);
const review = () => new AppError(409, "checkout_review", m.billing.checkoutReview);

export const withCheckoutIntent = async <T>(
  organizationId: string,
  input: { plan: string; interval: string },
  work: (intent: CheckoutIntent, leaseToken: string) => Promise<T>,
): Promise<T> => {
  const leaseToken = randomUUID();
  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    // Même verrou que le transfert/suppression : aucun paiement ne démarre pendant un départ.
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    await tx.checkoutIntent.createMany({ data: [{ organizationId, ...input }], skipDuplicates: true });
    return tx.checkoutIntent.updateMany({
      where: { organizationId, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      data: { leaseToken, leaseUntil: new Date(now.getTime() + 120_000) },
    });
  });
  if (!claimed.count) throw busy();
  try {
    return await work(await prisma.checkoutIntent.findUniqueOrThrow({ where: { organizationId } }), leaseToken);
  } finally {
    await prisma.checkoutIntent.updateMany({
      where: { organizationId, leaseToken },
      data: { leaseToken: null, leaseUntil: null },
    });
  }
};

export const intentCheckout = async (
  initial: CheckoutIntent,
  leaseToken: string,
  input: { plan: string; interval: string },
  params: Stripe.Checkout.SessionCreateParams,
  closedSubscriptionIds: string[] = [],
): Promise<{ url: string }> => {
  let intent = initial;
  const save = async (data: Prisma.CheckoutIntentUpdateManyMutationInput) => {
    const changed = await prisma.checkoutIntent.updateMany({ where: { id: intent.id, leaseToken }, data });
    if (!changed.count) throw busy();
    intent = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
  };
  if (intent.state === "review") throw review();
  const client = stripe();
  // Une réponse perdue se récupère avec la requête exacte, même si l'utilisateur change d'offre.
  if (intent.request && !intent.sessionId) {
    if (!intent.attemptedAt || Date.now() - intent.attemptedAt.getTime() >= 23 * 3600_000) {
      await save({ state: "review" });
      throw review(); // Hors fenêtre d'idempotence : résolution opérateur, jamais une nouvelle création.
    }
    const recovered = await client.checkout.sessions.create(
      intent.request as unknown as Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: `checkout-${intent.id}-${intent.generation}` },
    );
    await save({
      sessionId: recovered.id,
      url: recovered.url,
      state: "open",
      expiresAt: new Date(recovered.expires_at * 1000),
    });
  }
  if (intent.sessionId) {
    const current = await client.checkout.sessions.retrieve(intent.sessionId);
    if (current.status === "complete") {
      const subscriptionId = typeof current.subscription === "string" ? current.subscription : current.subscription?.id;
      if (!subscriptionId || !closedSubscriptionIds.includes(subscriptionId)) {
        await save({ state: "completed" });
        throw new AppError(409, "checkout_completed", m.billing.checkoutCompleted);
      }
    }
    if (current.status === "open") {
      const savedCustomer = (intent.request as { customer?: string } | null)?.customer;
      if (
        intent.plan === input.plan &&
        intent.interval === input.interval &&
        savedCustomer === params.customer &&
        current.url
      )
        return { url: current.url };
      // Un timeout ne permet pas de passer à la génération suivante : retrieve au prochain essai.
      const expired = await client.checkout.sessions.expire(intent.sessionId);
      if (expired.status !== "expired") throw review();
    } else if (current.status !== "expired" && current.status !== "complete") throw review();
    await save({
      generation: { increment: 1 },
      ...input,
      state: "creating",
      sessionId: null,
      url: null,
      request: Prisma.DbNull,
      attemptedAt: null,
      expiresAt: null,
    });
  }
  // Figer les paramètres avant le POST : changement de configuration ou de droits d'essai sans effet au rejeu.
  await save({
    ...input,
    request: params as unknown as Prisma.InputJsonValue,
    attemptedAt: new Date(),
    state: "creating",
  });
  const session = await client.checkout.sessions.create(params, {
    idempotencyKey: `checkout-${intent.id}-${intent.generation}`,
  });
  if (!session.url) throw new Error("stripe_checkout_url_missing");
  await save({
    sessionId: session.id,
    url: session.url,
    state: "open",
    expiresAt: new Date(session.expires_at * 1000),
  });
  return { url: session.url };
};
