import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PLANS } from "@tartan/domain";
import { POST } from "../app/api/webhooks/stripe/route";
import { env } from "@/lib/env";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { limitsOf } from "@/server/billing.service";
import { makeOrg } from "./helpers";

// Seul le réseau est remplacé. Le SDK Stripe vérifie la signature, construit ses requêtes,
// lit les réponses et lève ses propres classes d'erreur, comme en production.
const network = vi.hoisted(() => vi.fn<typeof fetch>());

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

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), flush: vi.fn().mockResolvedValue(true) }));

// Valeurs factices, sans rapport avec un compte réel.
const KEY = "sk_test_factice";
const SECRET = "whsec_factice_pour_les_tests";
const PRICE = "price_coach_mensuel_factice";
const signer = new Stripe(KEY);

beforeEach(() => {
  env().STRIPE_SECRET_KEY = KEY;
  env().STRIPE_WEBHOOK_SECRET = SECRET;
  env().STRIPE_PRICE_COACH_MONTH = PRICE;
  network.mockReset();
  vi.mocked(Sentry.captureMessage).mockClear();
});

afterAll(() => {
  env().STRIPE_SECRET_KEY = undefined;
  env().STRIPE_WEBHOOK_SECRET = undefined;
  env().STRIPE_PRICE_COACH_MONTH = undefined;
});

const sign = (payload: string, secret: string = SECRET, timestamp?: number) =>
  signer.webhooks.generateTestHeaderString({ payload, secret, ...(timestamp ? { timestamp } : {}) });

const deliver = (payload: string, signature: string | null = sign(payload)) =>
  POST(
    new Request("https://app.tartan.coach/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: signature ? { "stripe-signature": signature } : {},
    }),
  );

// Un espace en Découverte, client Stripe connu, et l'abonnement tel que Stripe l'envoie et le relit.
const setup = async () => {
  const org = await makeOrg("Webhook Stripe");
  const customer = `cus_${randomUUID()}`;
  await prisma.organization.update({
    where: { id: org.organizationId },
    data: { stripeCustomerId: customer, plan: "discovery" },
  });
  const subscription = {
    id: `sub_${randomUUID()}`,
    object: "subscription",
    customer,
    status: "active",
    created: 1_790_000_000,
    start_date: 1_790_000_000,
    metadata: { organizationId: org.organizationId },
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    discounts: [],
    items: {
      object: "list",
      data: [
        {
          id: "si_factice",
          current_period_end: 1_893_456_000,
          price: { id: PRICE, unit_amount: 1900, recurring: { interval: "month" } },
        },
      ],
    },
  };
  const payload = (type = "customer.subscription.updated") =>
    JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      api_version: Stripe.API_VERSION,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type,
      data: { object: subscription },
    });
  const plan = async () => (await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan;
  const confirmations = () =>
    outbox.filter((mail) => mail.to === org.owner.email && mail.subject.includes("est confirmé"));
  // Ce que répond l'API quand le traitement relit l'état de l'abonnement.
  const stripeAnswers = (price: string = PRICE) => {
    const data = subscription.items.data.map((item) => ({ ...item, price: { ...item.price, id: price } }));
    const current = { ...subscription, items: { object: "list", data } };
    network.mockImplementation(async () =>
      Response.json({ object: "list", url: "/v1/subscriptions", has_more: false, data: [current] }),
    );
  };
  return { ...org, customer, payload, plan, confirmations, stripeAnswers };
};

const recorded = (payload: string) => prisma.billingEvent.count({ where: { id: JSON.parse(payload).id } });

describe("webhook Stripe avec une vraie signature", () => {
  it("un événement signé ouvre les droits et prévient le propriétaire", async () => {
    const a = await setup();
    a.stripeAnswers();
    const payload = a.payload();
    const response = await deliver(payload);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(await a.plan()).toBe("coach");
    expect(await limitsOf(a.organizationId)).toEqual(PLANS.coach.limits);
    expect(await recorded(payload)).toBe(1);
    expect(a.confirmations()).toHaveLength(1);
    // Le traitement a bien relu l'abonnement du client chez Stripe, sans croire l'événement.
    const [url] = network.mock.calls[0]!;
    expect(String(url)).toContain("/v1/subscriptions");
    expect(String(url)).toContain(`customer=${a.customer}`);
  });

  it.each([
    ["signée avec un autre secret", (payload: string) => ({ payload, signature: sign(payload, "whsec_autre") })],
    ["modifiée après la signature", (payload: string) => ({ payload: `${payload} `, signature: sign(payload) })],
    [
      "rejouée dix minutes plus tard",
      (payload: string) => ({ payload, signature: sign(payload, SECRET, Math.floor(Date.now() / 1000) - 600) }),
    ],
    ["signée sans schéma v1", (payload: string) => ({ payload, signature: `t=${Math.floor(Date.now() / 1000)}` })],
  ])("une charge %s est refusée sans rien changer", async (_, forge) => {
    const a = await setup();
    a.stripeAnswers();
    const original = a.payload();
    const { payload, signature } = forge(original);
    const response = await deliver(payload, signature);
    expect(response.status).toBe(400);
    expect(await a.plan()).toBe("discovery");
    expect(await recorded(original)).toBe(0);
    expect(a.confirmations()).toHaveLength(0);
    expect(network).not.toHaveBeenCalled();
  });

  it("sans en-tête de signature, rien n'est traité", async () => {
    const a = await setup();
    a.stripeAnswers();
    const payload = a.payload();
    const response = await deliver(payload, null);
    expect(response.status).toBe(400);
    expect(await a.plan()).toBe("discovery");
    expect(await recorded(payload)).toBe(0);
    expect(network).not.toHaveBeenCalled();
  });

  it("sans secret configuré, la route répond 503 et ne traite rien, même signée", async () => {
    const a = await setup();
    a.stripeAnswers();
    const payload = a.payload();
    const signature = sign(payload);
    env().STRIPE_WEBHOOK_SECRET = undefined;
    const response = await deliver(payload, signature);
    expect(response.status).toBe(503);
    expect(await a.plan()).toBe("discovery");
    expect(await recorded(payload)).toBe(0);
    expect(network).not.toHaveBeenCalled();
  });

  it("un événement livré deux fois ne donne ni second droit ni second e-mail", async () => {
    const a = await setup();
    a.stripeAnswers();
    const payload = a.payload();
    expect((await deliver(payload)).status).toBe(200);
    expect((await deliver(payload)).status).toBe(200);
    expect(await recorded(payload)).toBe(1);
    expect(await prisma.subscription.count({ where: { organizationId: a.organizationId } })).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { organizationId: a.organizationId, action: "plan_coach_active" } }),
    ).toBe(1);
    expect(a.confirmations()).toHaveLength(1);
    // Le doublon est écarté avant toute relecture chez Stripe.
    expect(network).toHaveBeenCalledTimes(1);
    expect(await a.plan()).toBe("coach");
  });

  it("une panne de Stripe répond 500, et le renvoi de l'événement aboutit", async () => {
    const a = await setup();
    network.mockImplementation(async () =>
      Response.json({ error: { type: "api_error", message: "indisponible" } }, { status: 503 }),
    );
    const payload = a.payload();
    const failed = await deliver(payload);
    expect(failed.status).toBe(500);
    expect(await a.plan()).toBe("discovery");
    expect(await recorded(payload)).toBe(0);
    expect(a.confirmations()).toHaveLength(0);
    // L'alerte porte le type de l'événement et la classe d'erreur du SDK, jamais le contenu de l'erreur.
    expect(vi.mocked(Sentry.captureMessage).mock.calls).toEqual([
      [
        "stripe_webhook_failed",
        { level: "error", tags: { type: "customer.subscription.updated", cause: "StripeAPIError" } },
      ],
    ]);
    expect(Sentry.flush).toHaveBeenCalled();
    a.stripeAnswers();
    expect((await deliver(payload)).status).toBe(200);
    expect(await a.plan()).toBe("coach");
    expect(a.confirmations()).toHaveLength(1);
  });

  it("une panne de la base répond 500 pour que Stripe renvoie", async () => {
    const a = await setup();
    a.stripeAnswers();
    const payload = a.payload();
    const spy = vi.spyOn(prisma.billingEvent, "findUnique").mockRejectedValueOnce(new Error("base indisponible"));
    const response = await deliver(payload);
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(await recorded(payload)).toBe(0);
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0]?.[1]).toMatchObject({ tags: { cause: "interne" } });
  });

  it("un tarif inconnu répond 500 et nomme la cause, pour être corrigé puis rejoué", async () => {
    const a = await setup();
    a.stripeAnswers("price_inconnu");
    const payload = a.payload();
    const response = await deliver(payload);
    expect(response.status).toBe(500);
    expect(await a.plan()).toBe("discovery");
    expect(await recorded(payload)).toBe(0);
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0]?.[1]).toMatchObject({
      tags: { cause: "stripe_subscription_price_unknown" },
    });
  });

  it("un type d'événement que Tartan ne traite pas est acquitté sans trace", async () => {
    const a = await setup();
    const payload = a.payload("payment_intent.succeeded");
    const response = await deliver(payload);
    expect(response.status).toBe(200);
    expect(await recorded(payload)).toBe(0);
    expect(await a.plan()).toBe("discovery");
    expect(network).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
