import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { POST } from "../app/api/webhooks/stripe/route";
import { env } from "@/lib/env";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { adminCancelAtPeriodEnd } from "@/server/admin-console.service";
import { recordStepUp } from "@/server/admin-step-up.service";
import { confirmRefund, prepareRefund } from "@/server/billing-refund.service";
import { createCheckout, getBillingAlert, limitsOf, listInvoices } from "@/server/billing.service";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { applySubscription } from "@/server/subscription-state.service";
import { makeOrg, makeUser } from "../tests/helpers";
import { listenToSandbox, sdkOverCli, until, type Delivery } from "./sdk-over-cli";

// T03 : le cycle de vente contre la sandbox Stripe réelle. Le SDK, la route du webhook, la signature
// et les services sont ceux de la production ; les événements arrivent de Stripe par `stripe listen`.
// Seule la saisie de la carte sur la page Checkout hébergée est remplacée par la carte de test de Stripe,
// posée sur le client par l'API : ce geste humain reste à la recette réelle.
const sdk = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  billingEnabled: () => true,
  stripe: () => sdk.current,
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), flush: vi.fn().mockResolvedValue(true) }));

const stripe = sdkOverCli();
sdk.current = stripe;

const created = { customers: new Set<string>(), subscriptions: new Set<string>() };
let deliveries: Delivery[] = [];
let stop: (() => Promise<void>) | undefined;
let coachMonth: { id: string; amount: number };

beforeAll(async () => {
  const prices = await stripe.prices.list({ limit: 100 });
  expect(prices.data.every((price) => !price.livemode)).toBe(true);
  const price = (key: string) => {
    const found = prices.data.find((row) => row.lookup_key === key);
    if (!found?.unit_amount) throw new Error(`missing_sandbox_price_${key}`);
    return { id: found.id, amount: found.unit_amount };
  };
  coachMonth = price("tartan_coach_month");
  env().STRIPE_PRICE_COACH_MONTH = coachMonth.id;
  env().STRIPE_PRICE_COACH_YEAR = price("tartan_coach_year").id;
  const listener = await listenToSandbox(POST, (secret) => {
    env().STRIPE_WEBHOOK_SECRET = secret;
  });
  deliveries = listener.deliveries;
  stop = listener.stop;
});

afterAll(async () => {
  const failures: unknown[] = [];
  // Seulement ce que ce processus a créé, jamais les autres objets de la sandbox.
  for (const id of created.subscriptions) {
    try {
      const subscription = await stripe.subscriptions.retrieve(id);
      if (subscription.status !== "canceled") await stripe.subscriptions.cancel(id);
    } catch (error) {
      failures.push(error);
    }
  }
  for (const id of created.customers) {
    try {
      expect((await stripe.customers.del(id)).deleted).toBe(true);
    } catch (error) {
      failures.push(error);
    }
  }
  await stop?.();
  env().STRIPE_WEBHOOK_SECRET = undefined;
  if (failures.length) throw new AggregateError(failures, "sandbox_cleanup_incomplete");
});

// Un espace en Découverte qui ouvre un vrai Checkout : client et session créés chez Stripe.
const subscribingSpace = async (name: string) => {
  const space = await makeOrg(name);
  await applySubscription({
    organizationId: space.organizationId,
    plan: "discovery",
    status: "active",
    provider: "manual",
    providerRef: null,
    currentPeriodEnd: null,
    cancelAt: null,
  });
  const checkout = await createCheckout(space.owner.userId, space.organizationId, { plan: "coach", interval: "month" });
  expect(new URL(checkout.url).hostname).toBe("checkout.stripe.com");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } });
  const customer = org.stripeCustomerId!;
  created.customers.add(customer);
  const plan = async () => (await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } })).plan;
  const mails = (kind: string) =>
    prisma.emailOutbox.findMany({ where: { organizationId: space.organizationId, kind, toEmail: space.owner.email } });
  const delivered = (type: string) => deliveries.filter((delivery) => delivery.type === type);
  // Les messages partis depuis l'ouverture du Checkout : la bienvenue de l'espace n'en fait pas partie.
  const already = outbox.filter((mail) => mail.to === space.owner.email).length;
  const sent = () => outbox.filter((mail) => mail.to === space.owner.email).slice(already);
  return { ...space, customer, plan, mails, delivered, sent };
};

// Ce que la page Checkout fait pour le client : sa carte devient le moyen de paiement par défaut.
const payWith = async (customer: string, testCard: string) => {
  const card = await stripe.paymentMethods.attach(testCard, { customer });
  await stripe.customers.update(customer, { invoice_settings: { default_payment_method: card.id } });
};

const adminActor = async () => {
  const admin = await makeUser("AdminSandbox");
  await prisma.platformAdmin.create({ data: { email: admin.email } });
  const sessionId = randomUUID();
  await prisma.session.create({
    data: { id: sessionId, token: randomUUID(), userId: admin.userId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  await recordStepUp(sessionId, "passkey");
  return { ...admin, sessionId };
};

it("un espace s'abonne, paie par carte, est remboursé en partie, résilie, puis retombe en Découverte", async () => {
  const space = await subscribingSpace("CycleStripe");
  await payWith(space.customer, "pm_card_visa");

  // 1. L'abonnement démarre par l'essai de 14 jours, comme le Checkout le configure.
  const subscription = await stripe.subscriptions.create({
    customer: space.customer,
    items: [{ price: coachMonth.id }],
    trial_period_days: 14,
    metadata: { organizationId: space.organizationId },
  });
  created.subscriptions.add(subscription.id);
  await until("offre Coach après le webhook de création", async () => (await space.plan()) === "coach");
  expect(space.delivered("customer.subscription.created")).toEqual([
    { type: "customer.subscription.created", status: 200 },
  ]);
  const local = await prisma.subscription.findFirstOrThrow({ where: { organizationId: space.organizationId } });
  expect(local).toMatchObject({
    provider: "stripe",
    providerRef: subscription.id,
    status: "trialing",
    planKey: "coach",
  });
  expect(local.trialEndsAt).not.toBeNull();
  expect((await limitsOf(space.organizationId)).maxAthletes).toBe(PLANS.coach.limits.maxAthletes);
  expect(await space.mails("started")).toHaveLength(1);

  // 2. Fin de l'essai : Stripe prélève la carte et émet la première facture payée.
  await stripe.subscriptions.update(subscription.id, { trial_end: "now" });
  const invoice = await until("facture payée dans le miroir", () =>
    prisma.billingInvoice.findFirst({
      where: { organizationId: space.organizationId, status: "paid", amountPaidCents: { gt: 0 } },
    }),
  );
  expect(invoice).toMatchObject({
    livemode: false,
    currency: "eur",
    totalCents: coachMonth.amount,
    amountPaidCents: coachMonth.amount,
    refundedCents: 0,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: space.customer,
  });
  expect(invoice.number).toBeTruthy();
  expect(invoice.chargeId).toBeTruthy();
  expect(invoice.paidAt).not.toBeNull();
  await until("webhook invoice.paid accepté", async () => space.delivered("invoice.paid").length > 0);
  await until(
    "abonnement actif",
    async () =>
      (await prisma.subscription.findFirstOrThrow({ where: { organizationId: space.organizationId } })).status ===
      "active",
  );
  // La page « Factures » du propriétaire lit ce miroir.
  const listed = await listInvoices(space.owner.userId, space.organizationId);
  expect(JSON.stringify(listed)).toContain(invoice.number!);

  // 3. Remboursement partiel depuis la console : un avoir réel, relu chez Stripe.
  const admin = await adminActor();
  const prepared = await prepareRefund(admin, {
    invoiceId: invoice.id,
    amountCents: 500,
    reasonCode: "goodwill",
    withdrawal: false,
  });
  expect(prepared.refundableCents).toBe(coachMonth.amount);
  expect(await confirmRefund(admin, { refundId: prepared.refundId, token: prepared.token, amountCents: 500 })).toEqual({
    state: "succeeded",
  });
  expect((await stripe.invoices.retrieve(invoice.id)).post_payment_credit_notes_amount).toBe(500);
  await until(
    "remboursement reporté dans le miroir",
    async () => (await prisma.billingInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).refundedCents === 500,
  );
  await until("webhook charge.refunded accepté", async () => space.delivered("charge.refunded").length > 0);
  // Un second remboursement ne peut pas dépasser ce qui reste.
  await expect(
    prepareRefund(admin, {
      invoiceId: invoice.id,
      amountCents: coachMonth.amount,
      reasonCode: "goodwill",
      withdrawal: false,
    }),
  ).rejects.toThrow(m.admin.refundTooHigh);

  // 4. Résiliation à l'échéance : l'offre reste active, le payeur est prévenu.
  await adminCancelAtPeriodEnd(admin, local.id);
  await until(
    "résiliation programmée reçue par webhook",
    async () =>
      (await prisma.subscription.findFirstOrThrow({ where: { organizationId: space.organizationId } })).cancelAt !==
      null,
  );
  expect(await space.plan()).toBe("coach");
  expect(await space.mails("cancel")).toHaveLength(1);

  // 5. L'échéance arrive : Stripe clôt l'abonnement, l'espace retombe en Découverte.
  await stripe.subscriptions.cancel(subscription.id);
  await until("retour en Découverte", async () => (await space.plan()) === "discovery");
  expect((await limitsOf(space.organizationId)).maxAthletes).toBe(PLANS.discovery.limits.maxAthletes);
  expect(space.delivered("customer.subscription.deleted")).toEqual([
    { type: "customer.subscription.deleted", status: 200 },
  ]);
  expect(await space.mails("ended")).toHaveLength(1);

  // 6. Les e-mails mis en file se rendent et partent, un par transition.
  await flushEmailOutbox(new Date(Date.now() + 60_000));
  expect(space.sent()).toHaveLength(3);
  expect(await prisma.emailOutbox.count({ where: { organizationId: space.organizationId, sentAt: null } })).toBe(0);

  // Aucun événement signé par Stripe n'a été refusé ni laissé en erreur.
  expect(deliveries.filter((delivery) => delivery.status !== 200)).toEqual([]);
});

it("à la fin de l'essai, quand la banque exige une validation, le payeur est prévenu une seule fois", async () => {
  const space = await subscribingSpace("ValidationBancaire");
  // Carte de test de Stripe qui exige 3-D Secure à chaque prélèvement.
  await payWith(space.customer, "pm_card_authenticationRequired");
  const subscription = await stripe.subscriptions.create({
    customer: space.customer,
    items: [{ price: coachMonth.id }],
    trial_period_days: 14,
    metadata: { organizationId: space.organizationId },
  });
  created.subscriptions.add(subscription.id);
  await until("offre Coach pendant l'essai", async () => (await space.plan()) === "coach");

  // Le premier prélèvement se fait sans le payeur : sa banque demande une validation.
  await stripe.subscriptions.update(subscription.id, { trial_end: "now" });
  const [queued] = await until("e-mail de validation bancaire en file", async () => {
    const rows = await space.mails("payment_action_required");
    return rows.length ? rows : null;
  });
  expect(space.delivered("invoice.payment_action_required")).toEqual([
    { type: "invoice.payment_action_required", status: 200 },
  ]);
  const invoice = await prisma.billingInvoice.findUniqueOrThrow({
    where: { id: (queued!.payload as { invoiceId: string }).invoiceId },
  });
  expect(invoice).toMatchObject({
    status: "open",
    amountPaidCents: 0,
    totalCents: coachMonth.amount,
    stripeSubscriptionId: subscription.id,
  });
  await until(
    "abonnement en impayé",
    async () =>
      (await prisma.subscription.findFirstOrThrow({ where: { organizationId: space.organizationId } })).status ===
      "past_due",
  );
  // L'accès est conservé pendant l'incident, et le bandeau d'impayé s'affiche pour le propriétaire.
  expect(await space.plan()).toBe("coach");
  expect(await getBillingAlert(space.owner.userId, space.organizationId)).toBe("past_due");

  // Un incident, un e-mail : « validation demandée » et « paiement échoué » ne se cumulent pas.
  await flushEmailOutbox(new Date(Date.now() + 60_000));
  const incident = await prisma.emailOutbox.findMany({
    where: { organizationId: space.organizationId, kind: { in: ["payment_action_required", "payment_failed"] } },
  });
  expect(incident.filter((row) => row.sentAt !== null)).toHaveLength(1);
  const subjects = space.sent().map((mail) => mail.subject);
  const incidentSubjects: string[] = [m.email.paymentActionRequired.subject, m.email.paymentFailed.subject];
  expect(subjects.filter((subject) => incidentSubjects.includes(subject))).toHaveLength(1);
  expect(deliveries.filter((delivery) => delivery.status !== 200)).toEqual([]);
});
