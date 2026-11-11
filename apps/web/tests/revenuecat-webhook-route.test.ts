import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PLANS } from "@tartan/domain";
import { POST } from "../app/api/webhooks/revenuecat/route";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { applySubscription, limitsOf } from "@/server/billing.service";
import { makeOrg } from "./helpers";

// Jeton factice : RevenueCat renvoie tel quel l'en-tête d'autorisation réglé dans son tableau de bord.
const AUTH = "jeton-revenuecat-factice";

beforeEach(() => {
  env().REVENUECAT_WEBHOOK_AUTH = AUTH;
});

afterAll(() => {
  env().REVENUECAT_WEBHOOK_AUTH = undefined;
});

const deliver = (body: unknown, authorization: string | null = `Bearer ${AUTH}`) =>
  POST(
    new Request("https://app.tartan.coach/api/webhooks/revenuecat", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    }),
  );

const setup = async () => {
  const org = await makeOrg("Webhook RevenueCat");
  await applySubscription({
    organizationId: org.organizationId,
    plan: "discovery",
    status: "active",
    provider: "manual",
    providerRef: null,
    currentPeriodEnd: null,
    cancelAt: null,
  });
  const expiresAt = Date.UTC(2030, 0, 1);
  // La forme d'un événement RevenueCat : la route n'en lit que ces champs.
  const event = (type: string, extra: Record<string, unknown> = {}) => ({
    api_version: "1.0",
    event: {
      id: randomUUID(),
      type,
      app_user_id: `org_${org.organizationId}`,
      product_id: "tartan_coach_monthly",
      period_type: "NORMAL",
      expiration_at_ms: expiresAt,
      store: "APP_STORE",
      environment: "SANDBOX",
      ...extra,
    },
  });
  const plan = async () => (await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })).plan;
  const subscription = () => prisma.subscription.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  return { ...org, event, plan, subscription, expiresAt };
};

const recorded = (body: { event: { id: string } }) => prisma.billingEvent.count({ where: { id: body.event.id } });

describe("webhook RevenueCat", () => {
  it.each([
    ["sans en-tête d'autorisation", null],
    ["avec un autre jeton", "Bearer autre-jeton"],
    ["avec le jeton sans le préfixe Bearer", AUTH],
  ])("un achat envoyé %s est refusé en 401 sans rien changer", async (_, authorization) => {
    const a = await setup();
    const body = a.event("INITIAL_PURCHASE");
    const response = await deliver(body, authorization);
    expect(response.status).toBe(401);
    expect(await a.plan()).toBe("discovery");
    expect(await recorded(body)).toBe(0);
  });

  it.each(["Bearer undefined", "Bearer ", "Bearer"])(
    "sans jeton configuré, « %s » ne passe pas",
    async (authorization) => {
      const a = await setup();
      env().REVENUECAT_WEBHOOK_AUTH = undefined;
      const body = a.event("INITIAL_PURCHASE");
      const response = await deliver(body, authorization);
      expect(response.status).toBe(401);
      expect(await a.plan()).toBe("discovery");
      expect(await recorded(body)).toBe(0);
    },
  );

  it.each([
    ["illisible", "{ ceci n'est pas du JSON"],
    ["vide", {}],
    ["sans identifiant d'événement", { event: { type: "INITIAL_PURCHASE", app_user_id: "org_x" } }],
    [
      "avec une échéance en texte",
      { event: { id: "evt", type: "RENEWAL", app_user_id: "org_x", expiration_at_ms: "demain" } },
    ],
  ])("une charge authentifiée mais %s est refusée en 400", async (_, body) => {
    const before = await prisma.billingEvent.count();
    const response = await deliver(body);
    expect(response.status).toBe(400);
    expect(await prisma.billingEvent.count()).toBe(before);
  });

  it("un achat authentifié ouvre l'offre de l'espace", async () => {
    const a = await setup();
    const body = a.event("INITIAL_PURCHASE");
    const response = await deliver(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(await a.plan()).toBe("coach");
    expect(await limitsOf(a.organizationId)).toEqual(PLANS.coach.limits);
    expect(await a.subscription()).toMatchObject({
      provider: "revenuecat",
      providerRef: `org_${a.organizationId}`,
      planKey: "coach",
      status: "active",
      currentPeriodEnd: new Date(a.expiresAt),
    });
    expect(await recorded(body)).toBe(1);
  });

  it("un achat rejoué après l'expiration ne rouvre pas l'offre", async () => {
    const a = await setup();
    const purchase = a.event("INITIAL_PURCHASE");
    expect((await deliver(purchase)).status).toBe(200);
    expect((await deliver(purchase)).status).toBe(200);
    const applied = () =>
      prisma.auditLog.count({ where: { organizationId: a.organizationId, action: "plan_coach_active" } });
    expect(await applied()).toBe(1);
    expect((await deliver(a.event("EXPIRATION"))).status).toBe(200);
    expect(await a.plan()).toBe("discovery");
    // RevenueCat renvoie un événement tant qu'il n'a pas reçu de 200 : ce renvoi peut arriver très tard.
    expect((await deliver(purchase)).status).toBe(200);
    expect(await a.plan()).toBe("discovery");
    expect(await a.subscription()).toMatchObject({ status: "canceled", planKey: "discovery" });
    expect(await limitsOf(a.organizationId)).toEqual(PLANS.discovery.limits);
    expect(await applied()).toBe(1);
    expect(await recorded(purchase)).toBe(1);
  });
});
