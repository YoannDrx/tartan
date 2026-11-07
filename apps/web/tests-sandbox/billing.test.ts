import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createCheckout, createPortal } from "@/server/billing.service";
import { deleteAccount } from "@/server/account.service";
import { processBillingCommands } from "@/server/billing-command.service";
import { reconcileStripeSubscription } from "@/server/stripe-subscriptions.service";
import { addStaff, makeOrg } from "../tests/helpers";
import { cliStripe, stripeCli, transport } from "./stripe-cli";

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  billingEnabled: () => true,
  stripe: () => cliStripe,
}));

beforeAll(async () => {
  const prices = await stripeCli<Stripe.ApiList<Stripe.Price>>("get", "/v1/prices", { limit: 100 });
  expect(prices.data.every((p) => !p.livemode)).toBe(true);
  const get = (name: string) => {
    const price = prices.data.find((p) => p.lookup_key === name);
    if (!price) throw new Error(`missing_sandbox_price_${name}`);
    return price.id;
  };
  env().STRIPE_PRICE_COACH_MONTH = get("tartan_coach_month");
  env().STRIPE_PRICE_COACH_YEAR = get("tartan_coach_year");
});

afterAll(async () => {
  transport.afterCheckout = undefined;
  transport.rejectCancellation = false;
  const failures: unknown[] = [];
  for (const id of new Set(transport.checkoutIds)) {
    try {
      const session = await cliStripe.checkout.sessions.retrieve(id);
      if (session.status === "open") expect((await cliStripe.checkout.sessions.expire(id)).status).toBe("expired");
    } catch (error) {
      failures.push(error);
    }
  }
  // Seulement les clients créés par ce processus, jamais les autres objets de la sandbox.
  for (const id of new Set(transport.customers)) {
    try {
      const result = await stripeCli<{ deleted: boolean }>("delete", `/v1/customers/${id}`);
      expect(result.deleted).toBe(true);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "sandbox_cleanup_incomplete");
});

it("réutilise le Checkout réel sous concurrence, récupère une réponse perdue et expire l'ancienne offre", async () => {
  const a = await makeOrg("RecetteStripe");
  const input = { plan: "coach" as const, interval: "month" as const };
  let release!: () => void;
  let started!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  transport.afterCheckout = async () => {
    started();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const pending = createCheckout(a.owner.userId, a.organizationId, input);
  // Éviter une attente infinie si Stripe rejette les paramètres.
  await Promise.race([began, pending]);
  try {
    await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toMatchObject({
      code: "checkout_in_progress",
    });
  } finally {
    transport.afterCheckout = undefined;
    release?.();
  }
  const first = await pending;
  expect(await createCheckout(a.owner.userId, a.organizationId, input)).toEqual(first);
  const originalId = (await prisma.checkoutIntent.findUniqueOrThrow({ where: { organizationId: a.organizationId } }))
    .sessionId!;
  await createCheckout(a.owner.userId, a.organizationId, { ...input, interval: "year" });
  expect((await cliStripe.checkout.sessions.retrieve(originalId)).status).toBe("expired");

  const b = await makeOrg("RecetteReponsePerdue");
  transport.loseCheckoutResponse = true;
  await expect(createCheckout(b.owner.userId, b.organizationId, input)).rejects.toThrow(
    "response_lost_after_stripe_success",
  );
  const remoteId = transport.checkoutIds.at(-1)!;
  await createCheckout(b.owner.userId, b.organizationId, input);
  expect(
    (await prisma.checkoutIntent.findUniqueOrThrow({ where: { organizationId: b.organizationId } })).sessionId,
  ).toBe(remoteId);
  const customer = (await prisma.organization.findUniqueOrThrow({ where: { id: b.organizationId } })).stripeCustomerId!;
  const sessions = await cliStripe.checkout.sessions.list({ customer, status: "open" });
  expect(sessions.data.map((s) => s.id)).toEqual([remoteId]);
});

it("reprend l'arrêt réel d'un abonnement après panne et interdit le portail du précédent payeur", async () => {
  const a = await makeOrg("RecetteTransfert");
  const heir = await addStaff(a.organizationId, "RepreneurRecette", "coach");
  await createCheckout(a.owner.userId, a.organizationId, { plan: "coach", interval: "month" });
  const customer = (await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).stripeCustomerId!;
  const subscription = await stripeCli<Stripe.Subscription>("post", "/v1/subscriptions", {
    customer,
    items: [{ price: env().STRIPE_PRICE_COACH_MONTH }],
    trial_period_days: 14,
    metadata: { organizationId: a.organizationId },
  });
  await reconcileStripeSubscription(a.organizationId);
  transport.rejectCancellation = true;
  await deleteAccount(a.owner.userId);
  expect(
    await prisma.billingCommand.count({ where: { organizationId: a.organizationId, state: "pending" } }),
  ).toBeGreaterThan(0);
  await expect(createPortal(heir.userId, a.organizationId)).rejects.toMatchObject({ code: "billing_transferred" });
  transport.rejectCancellation = false;
  await processBillingCommands(new Date(Date.now() + 3600_000));
  expect((await cliStripe.subscriptions.retrieve(subscription.id)).cancel_at_period_end).toBe(true);
  expect(await prisma.billingCommand.count({ where: { organizationId: a.organizationId, state: "pending" } })).toBe(0);
  expect((await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).plan).toBe("coach");

  // Seul l'abonnement d'essai créé ci-dessus est clôturé, sans paiement ni remboursement.
  await stripeCli("delete", `/v1/subscriptions/${subscription.id}`);
  await reconcileStripeSubscription(a.organizationId);
  await createCheckout(heir.userId, a.organizationId, { plan: "coach", interval: "month" });
  const nextCustomer = (await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } }))
    .stripeCustomerId;
  expect(nextCustomer).toBeTruthy();
  expect(nextCustomer).not.toBe(customer);
});
