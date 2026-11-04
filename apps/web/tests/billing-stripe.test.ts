import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLANS } from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import * as mail from "@/lib/mail";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { adminOverview } from "@/server/admin.service";
import { applySubscription, createCheckout, handleStripeEvent, limitsOf } from "@/server/billing.service";
import { reconcileStripeSubscription } from "@/server/stripe-subscriptions.service";
import { deleteAccount } from "@/server/account.service";
import { answerSatisfaction, shouldAskSatisfaction } from "@/server/satisfaction.service";
import { createOrganization } from "@/server/org.service";
import { addStaff, makeOrg } from "./helpers";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  portal: vi.fn(),
  checkout: vi.fn(),
  customer: vi.fn(),
  list: vi.fn(),
  sessions: vi.fn(),
  expire: vi.fn(),
  update: vi.fn(),
  customerDel: vi.fn(),
  customerUpdate: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  billingEnabled: () => true,
  priceIdFor: () => "price_coach",
  planForPriceId: (id: string) => (id === "price_coach" ? "coach" : id === "price_club" ? "club" : null),
  stripe: () => ({
    subscriptions: { cancel: mocks.cancel, list: mocks.list, update: mocks.update },
    billingPortal: { sessions: { create: mocks.portal } },
    checkout: { sessions: { create: mocks.checkout, list: mocks.sessions, expire: mocks.expire } },
    customers: { create: mocks.customer, del: mocks.customerDel, update: mocks.customerUpdate },
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
const setup = async () => {
  const org = await makeOrg("Vente");
  const customer = `cus_${org.organizationId}`;
  await prisma.organization.update({ where: { id: org.organizationId }, data: { stripeCustomerId: customer } });
  const sub = (status: string, id = `sub_${org.organizationId}`, price = "price_coach", created = 100) =>
    ({
      id,
      customer,
      created,
      status,
      metadata: { organizationId: org.organizationId },
      cancel_at: null,
      items: { data: [{ price: { id: price }, current_period_end: 1893456000 }] },
    }) as unknown as Stripe.Subscription;
  const event = (snapshot: Stripe.Subscription, type = "customer.subscription.updated", id = randomUUID()) =>
    ({ id, type, data: { object: snapshot } }) as unknown as Stripe.Event;
  const state = (...subscriptions: Stripe.Subscription[]) =>
    mocks.list.mockResolvedValue({ data: subscriptions, has_more: false });
  const read = () => prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } });
  return { ...org, customer, sub, event, state, read };
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockReset().mockResolvedValue({ data: [], has_more: false });
  mocks.portal.mockReset().mockResolvedValue({ url: "https://portail" });
  mocks.checkout.mockReset().mockResolvedValue({ url: "https://paiement" });
  mocks.customer.mockReset().mockImplementation(async () => ({ id: `cus_${randomUUID()}` }));
});

describe("vente Stripe", () => {
  it("lit l'état courant et la date de l'API, même si le webhook a l'ancien format", async () => {
    const a = await setup();
    a.state(a.sub("active"));
    const old = {
      ...a.sub("trialing"),
      current_period_end: 100,
      items: { data: [{ price: { id: "price_coach" } }] },
    } as unknown as Stripe.Subscription;
    await handleStripeEvent(a.event(old));
    const row = await prisma.subscription.findFirstOrThrow({ where: { organizationId: a.organizationId } });
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd?.getTime()).toBe(1893456000 * 1000);
    expect(await limitsOf(a.organizationId)).toEqual(PLANS.coach.limits);
  });
  it("un ancien événement actif reçu après une résiliation ne réactive jamais l'offre", async () => {
    const a = await setup();
    a.state(a.sub("canceled"));
    await handleStripeEvent(a.event(a.sub("canceled"), "customer.subscription.deleted"));
    await handleStripeEvent(a.event(a.sub("active")));
    expect((await a.read()).plan).toBe("discovery");
    expect(await limitsOf(a.organizationId)).toEqual(PLANS.discovery.limits);
  });
  it("le changement d'un ancien abonnement ne remplace pas le nouvel abonnement", async () => {
    const a = await setup();
    a.state(a.sub("canceled", "sub_ancien", "price_coach", 1), a.sub("active", "sub_nouveau", "price_club", 2));
    await handleStripeEvent(a.event(a.sub("active", "sub_ancien")));
    expect((await a.read()).plan).toBe("club");
    await handleStripeEvent(a.event(a.sub("canceled", "sub_ancien")));
    expect((await a.read()).plan).toBe("club");
  });
  it("une réponse lente ancienne ne peut pas écraser une synchronisation plus récente", async () => {
    const a = await setup();
    let release!: (value: unknown) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    mocks.list.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const first = handleStripeEvent(a.event(a.sub("active")));
    const result = first.then(
      () => null,
      (error: Error) => error.message,
    );
    await ready;
    a.state(a.sub("canceled"));
    await handleStripeEvent(a.event(a.sub("canceled")));
    release({ data: [a.sub("active")], has_more: false });
    // Acquittée sans erreur : Stripe ne relance pas pour rien à chaque rafale d'événements.
    expect(await result).toBeNull();
    expect((await a.read()).plan).toBe("discovery");
  });
  it("un paiement jamais abouti ne retire pas l'offre de l'espace", async () => {
    const a = await setup();
    for (const status of ["incomplete", "incomplete_expired"]) {
      a.state(a.sub(status));
      await handleStripeEvent(a.event(a.sub(status)));
      expect((await a.read()).plan).toBe("pilot");
    }
  });
  it("un événement Stripe ne touche pas un abonnement pris sur le store", async () => {
    const a = await setup();
    await applySubscription({
      organizationId: a.organizationId,
      plan: "club",
      status: "active",
      provider: "revenuecat",
      providerRef: "rc_1",
      currentPeriodEnd: null,
      cancelAt: null,
    });
    a.state(a.sub("canceled"));
    await handleStripeEvent(a.event(a.sub("canceled")));
    expect((await a.read()).plan).toBe("club");
  });
  it("un doublon concurrent est acquitté une seule fois", async () => {
    const a = await setup();
    a.state(a.sub("active"));
    const event = a.event(a.sub("active"));
    const results = await Promise.allSettled([handleStripeEvent(event), handleStripeEvent(event)]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    await handleStripeEvent(event);
    expect(await prisma.billingEvent.count({ where: { id: event.id } })).toBe(1);
    expect(await prisma.subscription.count({ where: { organizationId: a.organizationId } })).toBe(1);
    expect((await a.read()).plan).toBe("coach");
  });
  it("une erreur Stripe laisse les droits intacts et l'événement rejouable", async () => {
    const a = await setup();
    const before = await a.read();
    const event = a.event(a.sub("active"));
    mocks.list.mockRejectedValueOnce(new Error("Stripe indisponible"));
    await expect(handleStripeEvent(event)).rejects.toThrow("Stripe indisponible");
    expect(await prisma.billingEvent.findUnique({ where: { id: event.id } })).toBeNull();
    expect((await a.read()).plan).toBe(before.plan);
    a.state(a.sub("active"));
    await handleStripeEvent(event);
    expect((await a.read()).plan).toBe("coach");
  });
  it("une panne pendant l'écriture des droits annule aussi l'abonnement et le traitement", async () => {
    const a = await setup();
    a.state(a.sub("active"));
    const event = a.event(a.sub("active"));
    const original = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(((
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) =>
      original(async (tx) => {
        vi.spyOn(tx.entitlement, "upsert").mockRejectedValueOnce(new Error("écriture indisponible"));
        return callback(tx);
      })) as typeof prisma.$transaction);
    try {
      await expect(handleStripeEvent(event)).rejects.toThrow("écriture indisponible");
    } finally {
      spy.mockRestore();
    }
    expect((await a.read()).plan).toBe("pilot");
    expect(await prisma.subscription.findFirstOrThrow({ where: { organizationId: a.organizationId } })).toMatchObject({
      provider: "manual",
      planKey: "discovery",
    });
    expect(await prisma.billingEvent.findUnique({ where: { id: event.id } })).toBeNull();
    expect(await limitsOf(a.organizationId)).toEqual(PLANS.pilot.limits);
    await handleStripeEvent(event);
    expect((await a.read()).plan).toBe("coach");
  });
  it("ignore les clients d'un autre produit, même avec une métadonnée d'espace", async () => {
    const a = await setup();
    await handleStripeEvent(a.event({ ...a.sub("active"), customer: "cus_autre_produit" }));
    expect(mocks.list).not.toHaveBeenCalled();
    expect((await a.read()).plan).toBe("pilot");
  });
  it("un tarif inconnu actif reste à corriger et à rejouer", async () => {
    const a = await setup();
    a.state(a.sub("active", "sub_inconnu", "price_inconnu"));
    const event = a.event(a.sub("active"));
    await expect(handleStripeEvent(event)).rejects.toThrow("stripe_subscription_price_unknown");
    expect(await prisma.billingEvent.findUnique({ where: { id: event.id } })).toBeNull();
    expect((await a.read()).plan).toBe("pilot");
  });
  it("une réconciliation sans webhook rattrape l'état du prestataire", async () => {
    const a = await setup();
    await paid(a.organizationId, a.sub("active").id);
    a.state(a.sub("unpaid"));
    await reconcileStripeSubscription(a.organizationId);
    expect((await a.read()).plan).toBe("discovery");
    expect((await a.read()).billingSyncedAt).not.toBeNull();
  });
  it("parcourt toutes les pages avant de décider des droits", async () => {
    const a = await setup();
    mocks.list
      .mockResolvedValueOnce({ data: [a.sub("canceled", "sub_old")], has_more: true })
      .mockResolvedValueOnce({ data: [a.sub("active", "sub_new", "price_club", 200)], has_more: false });
    await reconcileStripeSubscription(a.organizationId);
    expect((await a.read()).plan).toBe("club");
    expect(mocks.list.mock.calls[1]?.[0].starting_after).toBe("sub_old");
  });
  it("un abonnement en cours mène au portail, jamais à un second paiement", async () => {
    const a = await setup();
    await paid(a.organizationId, "sub_en_cours");
    const res = await createCheckout(a.owner.userId, a.organizationId, { plan: "club", interval: "year" });
    expect(res.url).toBe("https://portail");
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("met l'identité du vendeur et la mention de TVA sur les factures du nouveau client", async () => {
    const a = await makeOrg("Facture");
    await createCheckout(a.owner.userId, a.organizationId, { plan: "coach", interval: "month" });
    const [params] = mocks.customer.mock.calls[0] as [Stripe.CustomerCreateParams];
    expect(params.invoice_settings?.footer).toContain("293 B");
    expect(params.invoice_settings?.footer).toContain("803 272 590");
  });
  it("supprimer son compte résilie l'abonnement de l'espace qui disparaît", async () => {
    const a = await setup();
    await paid(a.organizationId, "sub_depart");
    await deleteAccount(a.owner.userId);
    expect(mocks.cancel).toHaveBeenCalledWith("sub_depart");
  });
});
describe("mails d'abonnement", () => {
  const mails = (email: string) => outbox.filter((mail) => mail.to === email);
  const next = () => Math.floor(Date.now() / 1000) + 30 * 86400;

  it("un webhook rejoué et une réconciliation concurrente ne donnent qu'un mail", async () => {
    const a = await setup();
    const owner = a.owner.email;
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "discovery" } });
    a.state(a.sub("trialing"));
    await reconcileStripeSubscription(a.organizationId);
    await Promise.all([reconcileStripeSubscription(a.organizationId), reconcileStripeSubscription(a.organizationId)]);
    expect(mails(owner).filter((mail) => mail.subject.includes("est confirmé"))).toHaveLength(1);
  });
  it("une résiliation, puis une reprise, puis une nouvelle résiliation à la même date : un seul mail par date", async () => {
    const a = await setup();
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "discovery" } });
    const cancelAt = next();
    a.state(a.sub("active"));
    await reconcileStripeSubscription(a.organizationId);
    a.state({ ...a.sub("active"), cancel_at: cancelAt });
    await reconcileStripeSubscription(a.organizationId);
    a.state(a.sub("active"));
    await reconcileStripeSubscription(a.organizationId);
    a.state({ ...a.sub("active"), cancel_at: cancelAt });
    await reconcileStripeSubscription(a.organizationId);
    expect(mails(a.owner.email).filter((mail) => mail.subject.includes("Résiliation"))).toHaveLength(1);
  });
  it("un impayé épuisé annonce la fin en le disant", async () => {
    const a = await setup();
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "discovery" } });
    a.state(a.sub("past_due"));
    await reconcileStripeSubscription(a.organizationId);
    a.state(a.sub("unpaid"));
    await reconcileStripeSubscription(a.organizationId);
    const ended = mails(a.owner.email).find((mail) => mail.subject.includes("a pris fin"));
    expect(ended?.html).toContain("tentatives de prélèvement");
  });
  it("un envoi qui échoue est repris par la tâche, sans doublon", async () => {
    const a = await setup();
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "discovery" } });
    const send = vi.spyOn(mail, "sendEmail").mockRejectedValueOnce(new Error("email_failed"));
    a.state(a.sub("active"));
    await reconcileStripeSubscription(a.organizationId);
    const row = await prisma.emailOutbox.findFirstOrThrow({ where: { organizationId: a.organizationId } });
    expect(row.sentAt).toBeNull();
    send.mockRestore();
    expect(await flushEmailOutbox(new Date(Date.now() + 10 * 60_000))).toBe(1);
    expect(await flushEmailOutbox(new Date(Date.now() + 20 * 60_000))).toBe(0);
  });
});

describe("parcours d'achat", () => {
  const prepared = async () => {
    const a = await setup();
    mocks.sessions.mockReset().mockResolvedValue({ data: [] });
    mocks.expire.mockReset().mockResolvedValue({});
    mocks.checkout.mockReset().mockResolvedValue({ url: "https://checkout.test" });
    mocks.portal.mockReset().mockResolvedValue({ url: "https://portail.test" });
    return a;
  };
  const input = { plan: "coach" as const, interval: "year" as const };

  it("un abonnement en essai retrouvé chez Stripe mène au portail, sans second paiement", async () => {
    const a = await prepared();
    mocks.list.mockResolvedValue({ data: [a.sub("trialing")] });
    await expect(createCheckout(a.owner.userId, a.organizationId, input)).resolves.toEqual({
      url: "https://portail.test",
    });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("une session de paiement encore ouverte est expirée : deux onglets ne créent qu'un abonnement", async () => {
    const a = await prepared();
    mocks.list.mockResolvedValue({ data: [] });
    mocks.sessions.mockResolvedValue({ data: [{ id: "cs_ouvert" }] });
    await createCheckout(a.owner.userId, a.organizationId, input);
    expect(mocks.expire).toHaveBeenCalledWith("cs_ouvert");
    expect(mocks.checkout).toHaveBeenCalledTimes(1);
  });
  it("l'essai n'est pas redonné dans un second espace du même propriétaire", async () => {
    const a = await prepared();
    mocks.list.mockResolvedValue({ data: [] });
    await prisma.subscription.create({
      data: { organizationId: a.organizationId, planKey: "coach", status: "canceled", provider: "stripe" },
    });
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "coach" } });
    const second = await createOrganization(a.owner.userId, {
      name: "Second",
      type: "independent",
      disciplines: [],
      firstGroupName: "Groupe",
    });
    await createCheckout(a.owner.userId, second.id, input);
    const params = mocks.checkout.mock.calls.at(-1)![0];
    expect(params.subscription_data.trial_period_days).toBeUndefined();
  });
  it("un second espace Découverte est refusé", async () => {
    const a = await prepared();
    await prisma.organization.update({ where: { id: a.organizationId }, data: { plan: "discovery" } });
    await expect(
      createOrganization(a.owner.userId, {
        name: "Encore",
        type: "independent",
        disciplines: [],
        firstGroupName: "Groupe",
      }),
    ).rejects.toMatchObject({ code: "discovery_limit", status: 409 });
  });
  it("un coach adjoint ne lance pas de paiement", async () => {
    const a = await prepared();
    const coach = await addStaff(a.organizationId, "Adjoint", "assistant");
    await expect(createCheckout(coach.userId, a.organizationId, input)).rejects.toMatchObject({ status: 403 });
  });
});

describe("suppression de compte et abonnement", () => {
  const withSubscription = async () => {
    const a = await setup();
    const ref = `sub_${randomUUID()}`;
    await prisma.subscription.create({
      data: {
        organizationId: a.organizationId,
        planKey: "coach",
        status: "active",
        provider: "stripe",
        providerRef: ref,
        currentPeriodEnd: new Date("2030-07-01T10:00:00Z"),
      },
    });
    return { ...a, ref };
  };
  it("espace supprimé : abonnement et client partent en file, plus aucun prélèvement", async () => {
    const a = await withSubscription();
    await deleteAccount(a.owner.userId);
    expect(mocks.cancel).toHaveBeenCalledWith(a.ref);
    expect(mocks.customerDel).toHaveBeenCalledWith(a.customer);
    expect(await prisma.externalDeletion.findFirst({ where: { externalRef: a.ref } })).toMatchObject({ state: "done" });
  });
  it("Stripe en panne ne bloque pas la suppression, et la file reprendra", async () => {
    const a = await withSubscription();
    mocks.cancel.mockRejectedValueOnce(Object.assign(new Error("panne"), { status: 503 }));
    await deleteAccount(a.owner.userId);
    expect(await prisma.user.count({ where: { id: a.owner.userId } })).toBe(0);
    expect(await prisma.externalDeletion.findFirst({ where: { externalRef: a.ref } })).toMatchObject({
      state: "pending",
      lastErrorCode: "http_503",
    });
  });
  it("espace transféré : arrêt en fin de période, facture au repreneur, repreneur prévenu de la date", async () => {
    const a = await withSubscription();
    const heir = await addStaff(a.organizationId, "Repreneur", "coach", []);
    await deleteAccount(a.owner.userId);
    expect(mocks.cancel).not.toHaveBeenCalledWith(a.ref);
    expect(mocks.update).toHaveBeenCalledWith(a.ref, { cancel_at_period_end: true });
    expect(mocks.customerUpdate).toHaveBeenCalledWith(a.customer, { email: heir.email });
    const told = outbox.find((entry) => entry.to === heir.email && entry.subject.includes("responsable"));
    expect(told?.html).toContain("1 juillet 2030");
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
