import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { adminOverview } from "@/server/admin.service";
import { applySubscription, createCheckout, handleStripeEvent } from "@/server/billing.service";
import { deleteAccount } from "@/server/account.service";
import { answerSatisfaction, shouldAskSatisfaction } from "@/server/satisfaction.service";
import { makeOrg } from "./helpers";

const cancel = vi.fn();
const portal = vi.fn().mockResolvedValue({ url: "https://portail" });
const checkout = vi.fn().mockResolvedValue({ url: "https://paiement" });
const createCustomer = vi.fn().mockResolvedValue({ id: "cus_nouveau" });

vi.mock("@/lib/stripe", () => ({
  billingEnabled: () => true,
  priceIdFor: () => "price_coach",
  planForPriceId: (id: string) => (id === "price_coach" ? "coach" : id === "price_club" ? "club" : null),
  stripe: () => ({
    subscriptions: { cancel },
    billingPortal: { sessions: { create: portal } },
    checkout: { sessions: { create: checkout } },
    customers: { create: createCustomer },
  }),
}));

const paid = (organizationId: string, ref: string) =>
  applySubscription({
    organizationId,
    plan: "coach",
    status: "active",
    provider: "stripe",
    providerRef: ref,
    currentPeriodEnd: null,
    cancelAt: null,
  });

// Forme de l'API 2022-11-15, celle que reçoit le webhook actuel du compte : la date est sur l'abonnement.
const legacyEvent = (organizationId: string, id: string, status: string, priceId: string, eventId = randomUUID()) =>
  ({
    id: eventId,
    type: "customer.subscription.updated",
    data: {
      object: {
        id,
        status,
        metadata: { organizationId },
        cancel_at: null,
        current_period_end: 1893456000,
        items: { data: [{ price: { id: priceId } }] },
      },
    },
  }) as unknown as Stripe.Event;

describe("vente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lit la date de fin quelle que soit la version d'API du webhook", async () => {
    const org = await makeOrg("Date");
    await handleStripeEvent(legacyEvent(org.organizationId, "sub_1", "active", "price_coach"));
    const row = await prisma.subscription.findFirstOrThrow({ where: { organizationId: org.organizationId } });
    expect(row.currentPeriodEnd?.getTime()).toBe(1893456000 * 1000);
  });

  it("un abonnement en cours mène au portail, jamais à un second paiement", async () => {
    const org = await makeOrg("Double");
    await prisma.organization.update({ where: { id: org.organizationId }, data: { stripeCustomerId: "cus_1" } });
    await paid(org.organizationId, "sub_en_cours");
    const res = await createCheckout(org.owner.userId, org.organizationId, { plan: "club", interval: "year" });
    expect(res.url).toBe("https://portail");
    expect(checkout).not.toHaveBeenCalled();
  });

  it("met l'identité du vendeur et la mention de TVA sur les factures du nouveau client", async () => {
    const org = await makeOrg("Facture");
    await createCheckout(org.owner.userId, org.organizationId, { plan: "coach", interval: "month" });
    const [params] = createCustomer.mock.calls[0] as [Stripe.CustomerCreateParams];
    expect(params.invoice_settings?.footer).toContain("293 B");
    expect(params.invoice_settings?.footer).toContain("803 272 590");
  });

  it("la fin d'un ancien abonnement ne fait pas retomber l'offre qui l'a remplacé", async () => {
    const org = await makeOrg("Remplace");
    await paid(org.organizationId, "sub_nouveau");
    await handleStripeEvent(legacyEvent(org.organizationId, "sub_ancien", "canceled", "price_x"));
    const space = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } });
    expect(space.plan).toBe("coach");
  });

  it("une erreur de base n'empêche pas le renvoi du prestataire de rejouer l'événement", async () => {
    const org = await makeOrg("Rejeu");
    const event = legacyEvent(org.organizationId, "sub_2", "active", "price_coach");
    const spy = vi.spyOn(prisma.organization, "update").mockRejectedValueOnce(new Error("base indisponible"));
    await expect(handleStripeEvent(event)).rejects.toThrow("base indisponible");
    spy.mockRestore();
    await handleStripeEvent(event);
    const space = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } });
    expect(space.plan).toBe("coach");
  });

  it("des relances épuisées arrêtent l'offre payante", async () => {
    const org = await makeOrg("Impaye");
    await paid(org.organizationId, "sub_3");
    await handleStripeEvent(legacyEvent(org.organizationId, "sub_3", "unpaid", "price_coach"));
    const space = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } });
    expect(space.plan).toBe("discovery");
  });

  it("supprimer son compte résilie l'abonnement de l'espace qui disparaît", async () => {
    const org = await makeOrg("Depart");
    await paid(org.organizationId, "sub_depart");
    await deleteAccount(org.owner.userId);
    expect(cancel).toHaveBeenCalledWith("sub_depart");
  });
});

describe("console et satisfaction", () => {
  it("la console refuse toute adresse hors de la liste", async () => {
    await expect(adminOverview({ email: "quelqu-un@exemple.fr" })).rejects.toMatchObject({ status: 403 });
  });

  it("pose la question après deux semaines, puis une fois par mois", async () => {
    const org = await makeOrg("Avis");
    const user = org.owner.userId;
    const later = (days: number) => new Date(Date.now() + days * 86400 * 1000);
    expect(await shouldAskSatisfaction(user, later(1))).toBe(false);
    expect(await shouldAskSatisfaction(user, later(15))).toBe(true);
    await answerSatisfaction(user, org.organizationId, { recommend: true, comment: "  " });
    expect(await shouldAskSatisfaction(user)).toBe(false);
    expect(await shouldAskSatisfaction(user, later(31))).toBe(true);
  });
});
