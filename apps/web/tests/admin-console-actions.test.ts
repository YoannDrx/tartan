import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@tartan/i18n";
import { PLANS } from "@tartan/domain";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getActorFrom } from "@/lib/session";
import {
  cancelAtPeriodEndAction,
  confirmRefundAction,
  deleteUserAction,
  extendTrialAction,
  grantPlanAction,
  prepareRefundAction,
  setSuspendedAction,
} from "@/features/admin/console.action";
import { auditTrail, expireGrantedPlans } from "@/server/admin-console.service";
import { recordStepUp, STEP_UP_MONEY_MS, STEP_UP_READ_MS } from "@/server/admin-step-up.service";
import { limitsOf } from "@/server/billing.service";
import { applySubscription } from "@/server/subscription-state.service";
import { addAthlete, makeOrg, makeUser } from "./helpers";
import { sessionCookie } from "./personas";

// La frontière testée est l'action serveur que la console appelle : session Better Auth réelle,
// vérification de passkey lue en base, service réel. Seuls sont remplacés ce que Next fournit
// pendant une requête (en-têtes, cache) et le réseau du SDK Stripe.
const request = vi.hoisted(() => ({ cookie: null as string | null }));
const network = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("next/headers", () => ({
  headers: async () => new Headers(request.cookie ? { cookie: request.cookie } : {}),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/stripe", async (importOriginal) => {
  const { default: Sdk } = await import("stripe");
  const { env: read } = await import("@/lib/env");
  return {
    ...(await importOriginal<typeof import("@/lib/stripe")>()),
    stripe: () =>
      new Sdk(read().STRIPE_SECRET_KEY ?? "", {
        httpClient: Sdk.createFetchHttpClient(network),
        maxNetworkRetries: 0,
      }),
  };
});

const DAY = 86_400_000;
const KEY = "sk_test_factice";

type Persona = { userId: string; email: string; cookie: string; sessionId: string };
const signIn = async (user: { userId: string; email: string }): Promise<Persona> => {
  const cookie = await sessionCookie(user.email);
  const actor = await getActorFrom(new Headers({ cookie }));
  if (!actor?.sessionId) throw new Error("Session introuvable après la connexion");
  return { ...user, cookie, sessionId: actor.sessionId };
};
const as = (persona: Persona | null) => {
  request.cookie = persona?.cookie ?? null;
};

let admin: Persona;
let coach: Persona;

beforeAll(async () => {
  env().ADMIN_EMAILS = "";
  const adminUser = await makeUser("Console");
  await prisma.platformAdmin.create({ data: { email: adminUser.email } });
  admin = await signIn(adminUser);
  coach = await signIn((await makeOrg("PasAdmin")).owner);
}, 60_000);

beforeEach(async () => {
  env().STRIPE_SECRET_KEY = KEY;
  network.mockReset();
  // Par défaut : administrateur dont la passkey vient d'être vérifiée.
  await recordStepUp(admin.sessionId, "passkey");
  as(admin);
});

afterAll(() => {
  env().STRIPE_SECRET_KEY = undefined;
});

const auditOf = (entityId: string, action?: string) =>
  prisma.auditLog.findMany({ where: { entityId, ...(action ? { action } : {}) }, orderBy: { at: "asc" } });

// Ce que le SDK a réellement envoyé : méthode, chemin, corps décodé, clé d'idempotence.
const sent = () =>
  network.mock.calls.map(([url, init]) => ({
    method: init?.method ?? "GET",
    path: new URL(String(url)).pathname,
    body: Object.fromEntries(new URLSearchParams(typeof init?.body === "string" ? init.body : "")),
    idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
  }));

const discoverySpace = async (name: string) => {
  const org = await makeOrg(name);
  await applySubscription({
    organizationId: org.organizationId,
    plan: "discovery",
    status: "active",
    provider: "manual",
    providerRef: null,
    currentPeriodEnd: null,
    cancelAt: null,
  });
  return org;
};

const stripeSubscription = async (name: string, opts: { trialEndsAt?: Date } = {}) => {
  const org = await makeOrg(name);
  const providerRef = `sub_${randomUUID()}`;
  await applySubscription({
    organizationId: org.organizationId,
    plan: "coach",
    status: opts.trialEndsAt ? "trialing" : "active",
    provider: "stripe",
    providerRef,
    currentPeriodEnd: new Date(Date.now() + 20 * DAY),
    cancelAt: null,
  });
  const row = await prisma.subscription.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  if (opts.trialEndsAt) {
    await prisma.subscription.update({ where: { id: row.id }, data: { trialEndsAt: opts.trialEndsAt } });
  }
  return { ...org, subscriptionId: row.id, providerRef };
};

const paidInvoice = async () => {
  const id = `in_${randomUUID()}`;
  await prisma.billingInvoice.create({
    data: {
      id,
      livemode: false,
      stripeCustomerId: "cus_factice",
      status: "paid",
      currency: "eur",
      totalCents: 1900,
      amountPaidCents: 1900,
      stripeCreatedAt: new Date(),
      syncedAt: new Date(),
    },
  });
  return id;
};

describe("la console refuse qui n'a pas à y être", () => {
  // Une cible réelle par action : un refus ne doit pas tenir à une entrée invalide.
  const targets = async () => {
    const space = await discoverySpace("Cible");
    const paying = await stripeSubscription("CiblePayante", { trialEndsAt: new Date(Date.now() + 5 * DAY) });
    const user = await makeUser("CibleCompte");
    const invoiceId = await paidInvoice();
    const calls = [
      () => grantPlanAction({ organizationId: space.organizationId, plan: "coach", days: 30 }),
      () => setSuspendedAction({ userId: user.userId, suspended: true }),
      () => deleteUserAction({ userId: user.userId }),
      () => cancelAtPeriodEndAction({ subscriptionId: paying.subscriptionId }),
      () => extendTrialAction({ subscriptionId: paying.subscriptionId, days: 14 }),
      () =>
        prepareRefundAction({
          invoiceId,
          amountCents: 500,
          reasonCode: "goodwill",
          withdrawal: false,
          note: null,
        }),
    ];
    const untouched = async () => {
      expect(network).not.toHaveBeenCalled();
      expect((await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } })).plan).toBe(
        "discovery",
      );
      const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { suspendedAt: true } });
      expect(account).toEqual({ suspendedAt: null });
      expect(await prisma.billingRefund.count({ where: { invoiceId } })).toBe(0);
      for (const id of [space.organizationId, user.userId, paying.subscriptionId]) {
        expect(await prisma.auditLog.count({ where: { entityId: id, actorId: { not: null } } })).toBe(0);
      }
    };
    return { calls, untouched };
  };

  it("sans session", async () => {
    const { calls, untouched } = await targets();
    as(null);
    for (const call of calls) expect((await call())?.serverError).toBe(m.errors.unauthorized);
    await untouched();
  });

  it("avec la session d'un coach propriétaire, qui n'est pas administrateur", async () => {
    const { calls, untouched } = await targets();
    as(coach);
    // Même une passkey vérifiée ne fait pas d'un coach un administrateur.
    await recordStepUp(coach.sessionId, "passkey");
    for (const call of calls) expect((await call())?.serverError).toBe(m.errors.forbidden);
    await untouched();
  });

  it("avec un administrateur dont la passkey n'a jamais été vérifiée dans cette session", async () => {
    const { calls, untouched } = await targets();
    await prisma.adminStepUp.deleteMany({ where: { sessionId: admin.sessionId } });
    for (const call of calls) expect((await call())?.serverError).toBe(m.admin.stepUpRequired);
    await untouched();
  });

  it("avec une vérification trop ancienne", async () => {
    const { calls, untouched } = await targets();
    await recordStepUp(admin.sessionId, "passkey", new Date(Date.now() - STEP_UP_READ_MS - 60_000));
    for (const call of calls) expect((await call())?.serverError).toBe(m.admin.stepUpRequired);
    await untouched();
  });

  it("la vérification d'une autre session ne vaut pas pour celle-ci", async () => {
    const { calls, untouched } = await targets();
    const elsewhere = await signIn(admin);
    await recordStepUp(elsewhere.sessionId, "passkey");
    await prisma.adminStepUp.deleteMany({ where: { sessionId: admin.sessionId } });
    for (const call of calls) expect((await call())?.serverError).toBe(m.admin.stepUpRequired);
    await untouched();
  });
});

describe("accorder une offre", () => {
  it("passe l'espace à l'offre, avec ses limites, pour la durée choisie, et le consigne", async () => {
    const space = await discoverySpace("Offert");
    const before = Date.now();
    const result = await grantPlanAction({ organizationId: space.organizationId, plan: "coach", days: 30 });
    expect(result?.serverError).toBeUndefined();

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } });
    expect(org.plan).toBe("coach");
    expect((await limitsOf(space.organizationId)).maxAthletes).toBe(PLANS.coach.limits.maxAthletes);
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { organizationId: space.organizationId },
    });
    expect(subscription).toMatchObject({ planKey: "coach", status: "active", provider: "manual" });
    const end = subscription.currentPeriodEnd!.getTime();
    expect(end).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(end).toBeLessThan(Date.now() + 30 * DAY + 1000);

    const [entry] = await auditOf(space.organizationId, "plan_granted");
    expect(entry).toMatchObject({
      actorId: admin.userId,
      organizationId: space.organizationId,
      entity: "organization",
      metadata: { plan: "coach", days: 30 },
    });
  });

  it("est refusé quand un abonnement payé est en cours : l'offre vient alors du prestataire", async () => {
    const paying = await stripeSubscription("DejaPayant");
    const result = await grantPlanAction({ organizationId: paying.organizationId, plan: "club" });
    expect(result?.serverError).toBe(m.errors.invalid);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: paying.organizationId } })).plan).toBe("coach");
    expect(await auditOf(paying.organizationId, "plan_granted")).toEqual([]);
  });

  it("refuse une offre inconnue ou une durée hors bornes avant d'atteindre le service", async () => {
    const space = await discoverySpace("Bornes");
    const wrongPlan = await grantPlanAction({ organizationId: space.organizationId, plan: "gratuit" as "coach" });
    expect(wrongPlan?.validationErrors).toBeDefined();
    const tooLong = await grantPlanAction({ organizationId: space.organizationId, plan: "coach", days: 731 });
    expect(tooLong?.validationErrors).toBeDefined();
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } })).plan).toBe(
      "discovery",
    );
  });
});

describe("expiration d'une offre accordée", () => {
  it("ramène l'espace en Découverte une fois la durée écoulée, une seule fois", async () => {
    const space = await discoverySpace("Expire");
    await grantPlanAction({ organizationId: space.organizationId, plan: "coach", days: 30 });
    const plan = async () =>
      (await prisma.organization.findUniqueOrThrow({ where: { id: space.organizationId } })).plan;

    // La veille de l'échéance, rien ne bouge.
    await expireGrantedPlans(new Date(Date.now() + 29 * DAY));
    expect(await plan()).toBe("coach");

    await expireGrantedPlans(new Date(Date.now() + 31 * DAY));
    expect(await plan()).toBe("discovery");
    expect((await limitsOf(space.organizationId)).maxAthletes).toBe(PLANS.discovery.limits.maxAthletes);
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { organizationId: space.organizationId },
    });
    expect(subscription).toMatchObject({ planKey: "discovery", currentPeriodEnd: null });

    // Un second passage ne retrouve plus cet espace.
    const again = await prisma.subscription.count({
      where: { organizationId: space.organizationId, planKey: { not: "discovery" } },
    });
    expect(again).toBe(0);
  });

  it("laisse en place une offre accordée sans durée, et un abonnement payé", async () => {
    const forever = await discoverySpace("SansFin");
    await grantPlanAction({ organizationId: forever.organizationId, plan: "club" });
    const paying = await stripeSubscription("PayantEchu");
    await prisma.subscription.update({
      where: { id: paying.subscriptionId },
      data: { currentPeriodEnd: new Date(Date.now() - DAY) },
    });

    await expireGrantedPlans(new Date(Date.now() + 400 * DAY));
    const plans = await prisma.organization.findMany({
      where: { id: { in: [forever.organizationId, paying.organizationId] } },
      select: { id: true, plan: true },
    });
    expect(plans.find((row) => row.id === forever.organizationId)?.plan).toBe("club");
    expect(plans.find((row) => row.id === paying.organizationId)?.plan).toBe("coach");
  });
});

describe("suspendre un compte", () => {
  it("coupe les sessions ouvertes, empêche d'en rouvrir une, puis se lève", async () => {
    const target = await signIn(await makeUser("Suspendu"));
    expect(await getActorFrom(new Headers({ cookie: target.cookie }))).not.toBeNull();

    const result = await setSuspendedAction({ userId: target.userId, suspended: true });
    expect(result?.serverError).toBeUndefined();
    expect(await prisma.session.count({ where: { userId: target.userId } })).toBe(0);
    expect(await getActorFrom(new Headers({ cookie: target.cookie }))).toBeNull();
    await expect(sessionCookie(target.email)).rejects.toThrow();
    expect(await prisma.session.count({ where: { userId: target.userId } })).toBe(0);

    await setSuspendedAction({ userId: target.userId, suspended: false });
    await expect(sessionCookie(target.email)).resolves.toContain("session_token=");
    expect((await auditOf(target.userId)).map((entry) => [entry.action, entry.actorId])).toEqual([
      ["user_suspended", admin.userId],
      ["user_restored", admin.userId],
    ]);
  });

  it("un administrateur ne se suspend pas lui-même, et un compte inconnu ne laisse pas de trace", async () => {
    const self = await setSuspendedAction({ userId: admin.userId, suspended: true });
    expect(self?.serverError).toBe(m.errors.forbidden);
    expect(await getActorFrom(new Headers({ cookie: admin.cookie }))).not.toBeNull();

    const ghost = randomUUID();
    expect((await setSuspendedAction({ userId: ghost, suspended: true }))?.serverError).toBe(m.errors.notFound);
    expect(await auditOf(ghost)).toEqual([]);
  });
});

describe("supprimer un compte", () => {
  it("efface le compte, ses sessions et sa fiche d'athlète, et garde la trace de la demande", async () => {
    const space = await makeOrg("AvecAthlete");
    const athlete = await addAthlete(space.organizationId, space.groupId, "Efface");
    const target = await signIn(athlete);

    const result = await deleteUserAction({ userId: target.userId });
    expect(result?.serverError).toBeUndefined();
    expect(await prisma.user.findUnique({ where: { id: target.userId } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: target.userId } })).toBe(0);
    expect(await prisma.athlete.findUnique({ where: { id: athlete.athleteId } })).toBeNull();
    expect(await getActorFrom(new Headers({ cookie: target.cookie }))).toBeNull();

    const [entry] = await auditOf(target.userId, "user_deletion_requested");
    expect(entry).toMatchObject({ actorId: admin.userId, entity: "user" });
    // Le journal ne garde ni nom ni adresse de la personne effacée.
    expect(JSON.stringify(entry)).not.toContain(target.email);
  });

  it("un administrateur ne supprime pas son propre compte depuis la console", async () => {
    expect((await deleteUserAction({ userId: admin.userId }))?.serverError).toBe(m.errors.forbidden);
    expect(await prisma.user.findUnique({ where: { id: admin.userId } })).not.toBeNull();
    expect(await auditOf(admin.userId, "user_deletion_requested")).toEqual([]);
  });
});

describe("résilier à l'échéance", () => {
  it("demande à Stripe l'arrêt en fin de période, sans toucher à l'offre en cours, et le consigne", async () => {
    const paying = await stripeSubscription("Resilie");
    network.mockImplementation(async () => Response.json({ id: paying.providerRef, object: "subscription" }));

    const result = await cancelAtPeriodEndAction({ subscriptionId: paying.subscriptionId });
    expect(result?.serverError).toBeUndefined();
    expect(sent()).toEqual([
      {
        method: "POST",
        path: `/v1/subscriptions/${paying.providerRef}`,
        body: { cancel_at_period_end: "true" },
        idempotencyKey: null,
      },
    ]);
    // L'offre ne change qu'au retour de Stripe, par le webhook.
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: paying.organizationId } })).plan).toBe("coach");
    const [entry] = await auditOf(paying.subscriptionId, "subscription_cancel_at_period_end");
    expect(entry).toMatchObject({ actorId: admin.userId, organizationId: paying.organizationId });
  });

  it("ne consigne rien quand Stripe refuse ou tombe", async () => {
    const paying = await stripeSubscription("PanneStripe");
    network.mockImplementation(async () =>
      Response.json({ error: { type: "api_error", message: "indisponible" } }, { status: 500 }),
    );
    const result = await cancelAtPeriodEndAction({ subscriptionId: paying.subscriptionId });
    expect(result?.serverError).toBe(m.common.genericError);
    expect(await auditOf(paying.subscriptionId)).toEqual([]);
  });

  it("refuse une offre accordée à la main, et toute résiliation quand la facturation est coupée", async () => {
    const granted = await discoverySpace("Manuel");
    await grantPlanAction({ organizationId: granted.organizationId, plan: "coach" });
    const manual = await prisma.subscription.findFirstOrThrow({ where: { organizationId: granted.organizationId } });
    expect((await cancelAtPeriodEndAction({ subscriptionId: manual.id }))?.serverError).toBe(m.errors.notFound);

    const paying = await stripeSubscription("SansCle");
    env().STRIPE_SECRET_KEY = undefined;
    expect((await cancelAtPeriodEndAction({ subscriptionId: paying.subscriptionId }))?.serverError).toBe(
      m.errors.invalid,
    );
    expect(network).not.toHaveBeenCalled();
  });
});

describe("prolonger l'essai", () => {
  it("repousse la fin d'essai connue, sans prorata, et le consigne", async () => {
    const trialEndsAt = new Date(Date.now() + 5 * DAY);
    const paying = await stripeSubscription("Essai", { trialEndsAt });
    network.mockImplementation(async () => Response.json({ id: paying.providerRef, object: "subscription" }));

    const result = await extendTrialAction({ subscriptionId: paying.subscriptionId, days: 14 });
    expect(result?.serverError).toBeUndefined();
    expect(sent()).toEqual([
      {
        method: "POST",
        path: `/v1/subscriptions/${paying.providerRef}`,
        body: {
          trial_end: String(Math.floor(trialEndsAt.getTime() / 1000) + 14 * 86_400),
          proration_behavior: "none",
        },
        idempotencyKey: null,
      },
    ]);
    const [entry] = await auditOf(paying.subscriptionId, "trial_extended");
    expect(entry).toMatchObject({ actorId: admin.userId, metadata: { days: 14 } });
  });

  it("part d'aujourd'hui quand l'essai est déjà fini", async () => {
    const paying = await stripeSubscription("EssaiFini", { trialEndsAt: new Date(Date.now() - 3 * DAY) });
    network.mockImplementation(async () => Response.json({ id: paying.providerRef, object: "subscription" }));
    const before = Math.floor(Date.now() / 1000);
    await extendTrialAction({ subscriptionId: paying.subscriptionId, days: 7 });
    const trialEnd = Number(sent()[0]?.body.trial_end);
    expect(trialEnd).toBeGreaterThanOrEqual(before + 7 * 86_400);
    expect(trialEnd).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 7 * 86_400);
  });

  it("refuse plus de 60 jours avant tout appel à Stripe", async () => {
    const paying = await stripeSubscription("EssaiLong");
    const result = await extendTrialAction({ subscriptionId: paying.subscriptionId, days: 61 });
    expect(result?.validationErrors).toBeDefined();
    expect(network).not.toHaveBeenCalled();
    expect(await auditOf(paying.subscriptionId)).toEqual([]);
  });
});

describe("rembourser", () => {
  const stripeInvoice = (invoiceId: string, refunded: () => number) =>
    network.mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === "/v1/credit_notes" && init?.method === "POST") {
        return Response.json({ id: "cn_factice", object: "credit_note", refunds: [{ refund: "re_factice" }] });
      }
      if (path === `/v1/invoices/${invoiceId}`) {
        return Response.json({
          id: invoiceId,
          object: "invoice",
          amount_paid: 1900,
          post_payment_credit_notes_amount: refunded(),
          livemode: false,
        });
      }
      // Le miroir et l'alerte qui suivent sont rattrapés par le service : leur panne ne change pas le résultat.
      return Response.json({ error: { type: "invalid_request_error", message: "hors du test" } }, { status: 404 });
    });

  it("exige une vérification de moins de dix minutes, plus stricte que pour le reste de la console", async () => {
    const invoiceId = await paidInvoice();
    stripeInvoice(invoiceId, () => 0);
    await recordStepUp(admin.sessionId, "passkey", new Date(Date.now() - STEP_UP_MONEY_MS - 60_000));

    const refund = await prepareRefundAction({
      invoiceId,
      amountCents: 500,
      reasonCode: "goodwill",
      withdrawal: false,
      note: null,
    });
    expect(refund?.serverError).toBe(m.admin.stepUpRequired);
    expect(network).not.toHaveBeenCalled();
    expect(await prisma.billingRefund.count({ where: { invoiceId } })).toBe(0);
    // La même session accorde encore une offre : la fenêtre de lecture, elle, court toujours.
    const space = await discoverySpace("FenetreLecture");
    expect(
      (await grantPlanAction({ organizationId: space.organizationId, plan: "coach" }))?.serverError,
    ).toBeUndefined();
  });

  it("se prépare puis se confirme : un seul avoir part chez Stripe, sous une clé qui interdit le doublon", async () => {
    const invoiceId = await paidInvoice();
    stripeInvoice(invoiceId, () => 0);

    const prepared = await prepareRefundAction({
      invoiceId,
      amountCents: 1900,
      reasonCode: "withdrawal",
      withdrawal: true,
      note: null,
    });
    expect(prepared?.serverError).toBeUndefined();
    const { refundId, token } = prepared!.data as { refundId: string; token: string };
    // Tant que rien n'est confirmé, aucun avoir n'est demandé.
    expect(sent().filter((call) => call.path === "/v1/credit_notes")).toEqual([]);

    const confirmed = await confirmRefundAction({ refundId, token, amountCents: 1900 });
    expect(confirmed?.data).toEqual({ state: "succeeded" });
    const notes = sent().filter((call) => call.path === "/v1/credit_notes");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      method: "POST",
      idempotencyKey: `refund-${refundId}`,
      body: { invoice: invoiceId, amount: "1900", refund_amount: "1900", "metadata[refundId]": refundId },
    });
    expect(await prisma.billingRefund.findUniqueOrThrow({ where: { id: refundId } })).toMatchObject({
      state: "succeeded",
      stripeCreditNoteId: "cn_factice",
      stripeRefundId: "re_factice",
      preparedBy: admin.userId,
    });
    const [entry] = await auditOf(refundId, "refund_succeeded");
    expect(entry).toMatchObject({
      actorId: admin.userId,
      metadata: { amountCents: 1900, reasonCode: "withdrawal", withdrawal: true },
    });

    // Rejouer la confirmation ne rembourse pas deux fois.
    const replay = await confirmRefundAction({ refundId, token, amountCents: 1900 });
    expect(replay?.serverError).toBe(m.errors.notFound);
    expect(sent().filter((call) => call.path === "/v1/credit_notes")).toHaveLength(1);
  });

  it("refuse un montant supérieur à ce qui reste remboursable, et un jeton qui n'est pas le bon", async () => {
    const invoiceId = await paidInvoice();
    stripeInvoice(invoiceId, () => 1500);
    const tooMuch = await prepareRefundAction({
      invoiceId,
      amountCents: 500,
      reasonCode: "goodwill",
      withdrawal: false,
      note: null,
    });
    expect(tooMuch?.serverError).toBe(m.admin.refundTooHigh);

    const prepared = await prepareRefundAction({
      invoiceId,
      amountCents: 400,
      reasonCode: "goodwill",
      withdrawal: false,
      note: null,
    });
    const { refundId } = prepared!.data as { refundId: string };
    const forged = await confirmRefundAction({ refundId, token: "jeton-invente", amountCents: 400 });
    expect(forged?.serverError).toBe(m.admin.refundExpired);
    expect(sent().filter((call) => call.path === "/v1/credit_notes")).toEqual([]);
  });
});

describe("le journal de la console", () => {
  it("se lit par action, pour un administrateur seulement", async () => {
    const space = await discoverySpace("Journal");
    await grantPlanAction({ organizationId: space.organizationId, plan: "club", days: 7 });
    const trail = await auditTrail(admin, { action: "plan_granted" });
    expect(trail.items[0]).toMatchObject({
      action: "plan_granted",
      actorId: admin.userId,
      organizationId: space.organizationId,
      metadata: { plan: "club", days: 7 },
    });
    await expect(auditTrail(coach, {})).rejects.toMatchObject({ status: 403 });
  });
});
