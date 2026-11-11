import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@tartan/i18n";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { STRIPE_WEBHOOK_EVENTS } from "@/lib/stripe-webhook-events";
import { applySubscription, getBillingAlert, handleStripeEvent, listInvoices } from "@/server/billing.service";
import { enqueuePaymentActionRequired, flushEmailOutbox } from "@/server/email-outbox.service";
import { addStaff, makeOrg } from "./helpers";

const mocks = vi.hoisted(() => ({ invoice: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  billingEnabled: () => true,
  priceIdFor: () => "price_coach",
  planForPriceId: () => "coach",
  stripe: () => ({ invoices: { retrieve: mocks.invoice } }),
}));

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);

// Un espace en offre Coach dont le dernier prélèvement attend, avec sa facture ouverte dans la copie locale.
const setup = async (status: "past_due" | "active" = "past_due") => {
  const org = await makeOrg("Validation");
  const customer = `cus_${randomUUID()}`;
  const subscription = `sub_${randomUUID()}`;
  const invoice = `in_${randomUUID()}`;
  await prisma.organization.update({ where: { id: org.organizationId }, data: { stripeCustomerId: customer } });
  await applySubscription({
    organizationId: org.organizationId,
    plan: "coach",
    status,
    provider: "stripe",
    providerRef: subscription,
    currentPeriodEnd: null,
    cancelAt: null,
  });
  await prisma.billingInvoice.create({
    data: {
      id: invoice,
      livemode: false,
      organizationId: org.organizationId,
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription,
      number: "TARTAN-0001",
      status: "open",
      currency: "eur",
      totalCents: 1900,
      amountPaidCents: 0,
      stripeCreatedAt: new Date(),
      syncedAt: new Date(),
    },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: org.owner.userId }, select: { email: true } });
  // La création de l'espace envoie sa bienvenue : seuls les e-mails de paiement comptent ici.
  outbox.length = 0;
  return { ...org, customer, subscription, invoice, email: owner.email };
};

const mailsTo = (email: string) => outbox.filter((mail) => mail.to === email).map((mail) => mail.subject);

beforeEach(() => {
  vi.clearAllMocks();
  outbox.length = 0;
});

describe("validation bancaire demandée", () => {
  it("fait partie des événements que le webhook doit couvrir", () => {
    expect(STRIPE_WEBHOOK_EVENTS).toContain("invoice.payment_action_required");
  });

  it("prévient le payeur une seule fois par facture", async () => {
    const space = await setup();
    await enqueuePaymentActionRequired(space.organizationId, space.invoice);
    await enqueuePaymentActionRequired(space.organizationId, space.invoice);
    expect(await prisma.emailOutbox.count({ where: { organizationId: space.organizationId } })).toBe(1);

    await flushEmailOutbox(later(1));
    await flushEmailOutbox(later(10));
    expect(mailsTo(space.email)).toEqual([m.email.paymentActionRequired.subject]);
  });

  it("n'envoie rien si la facture a été réglée entre-temps", async () => {
    const space = await setup();
    await enqueuePaymentActionRequired(space.organizationId, space.invoice);
    await prisma.billingInvoice.update({ where: { id: space.invoice }, data: { status: "paid" } });

    await flushEmailOutbox(later(1));
    expect(mailsTo(space.email)).toEqual([]);
    const row = await prisma.emailOutbox.findFirstOrThrow({ where: { organizationId: space.organizationId } });
    expect(row.failureCode).toBe("obsolete");
  });

  it("remplace l'e-mail « paiement échoué » du même incident", async () => {
    const space = await setup();
    await prisma.emailOutbox.create({
      data: {
        organizationId: space.organizationId,
        toEmail: space.email,
        kind: "payment_failed",
        dedupeKey: `${space.subscription}:past_due:2026-12-01`,
        payload: { space: "Coaching Validation", plan: "coach", interval: "month", trialEnd: null, cancelAt: null },
      },
    });
    await enqueuePaymentActionRequired(space.organizationId, space.invoice);

    await flushEmailOutbox(later(1));
    expect(mailsTo(space.email)).toEqual([m.email.paymentActionRequired.subject]);
  });

  it("ne double pas un e-mail « paiement échoué » déjà parti", async () => {
    const space = await setup();
    await prisma.emailOutbox.create({
      data: {
        organizationId: space.organizationId,
        toEmail: space.email,
        kind: "payment_failed",
        dedupeKey: `${space.subscription}:past_due:2026-12-01`,
        payload: { space: "Coaching Validation", plan: "coach", interval: "month", trialEnd: null, cancelAt: null },
      },
    });
    await flushEmailOutbox(later(1));
    expect(mailsTo(space.email)).toEqual([m.email.paymentFailed.subject]);

    await enqueuePaymentActionRequired(space.organizationId, space.invoice);
    await flushEmailOutbox(later(8));
    expect(mailsTo(space.email)).toEqual([m.email.paymentFailed.subject]);
  });

  it("met l'e-mail en file à l'arrivée de l'événement Stripe, sans doublon au rejeu", async () => {
    const space = await setup();
    mocks.invoice.mockResolvedValue({
      id: space.invoice,
      livemode: false,
      customer: space.customer,
      parent: { subscription_details: { subscription: space.subscription } },
      number: "TARTAN-0001",
      status: "open",
      currency: "eur",
      total: 1900,
      amount_paid: 0,
      post_payment_credit_notes_amount: 0,
      created: Math.floor(Date.now() / 1000),
    });
    const event = {
      id: `evt_${randomUUID()}`,
      type: "invoice.payment_action_required",
      livemode: false,
      data: { object: { id: space.invoice, customer: space.customer } },
    } as unknown as Stripe.Event;

    await handleStripeEvent(event);
    await handleStripeEvent(event);
    const rows = await prisma.emailOutbox.findMany({ where: { organizationId: space.organizationId } });
    expect(rows.map((row) => row.kind)).toEqual(["payment_action_required"]);
    expect(mocks.invoice).toHaveBeenCalledTimes(1);
  });
});

describe("bandeau de paiement à régulariser", () => {
  it("ne s'affiche que pour le propriétaire d'un espace en impayé", async () => {
    const space = await setup();
    const coach = await addStaff(space.organizationId, "Adjoint", "coach");
    expect(await getBillingAlert(space.owner.userId, space.organizationId)).toBe("past_due");
    expect(await getBillingAlert(coach.userId, space.organizationId)).toBeNull();
  });

  it("reste absent quand l'abonnement est à jour", async () => {
    const space = await setup("active");
    expect(await getBillingAlert(space.owner.userId, space.organizationId)).toBeNull();
  });
});

describe("factures de l'espace", () => {
  it("liste les factures émises au propriétaire, les plus récentes d'abord, sans les brouillons", async () => {
    const space = await setup();
    await prisma.billingInvoice.create({
      data: {
        id: `in_${randomUUID()}`,
        livemode: false,
        organizationId: space.organizationId,
        stripeCustomerId: space.customer,
        status: "draft",
        currency: "eur",
        totalCents: 1900,
        amountPaidCents: 0,
        stripeCreatedAt: later(5),
        syncedAt: new Date(),
      },
    });
    const invoices = await listInvoices(space.owner.userId, space.organizationId);
    expect(invoices).toEqual([expect.objectContaining({ id: space.invoice, number: "TARTAN-0001", totalCents: 1900 })]);
  });

  it("est refusée à un coach qui n'est pas propriétaire", async () => {
    const space = await setup();
    const coach = await addStaff(space.organizationId, "Adjoint", "coach");
    await expect(listInvoices(coach.userId, space.organizationId)).rejects.toMatchObject({ status: 403 });
  });
});
