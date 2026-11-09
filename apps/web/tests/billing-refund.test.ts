import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import * as stripeLib from "@/lib/stripe";
import { prepareRefund, confirmRefund, retryPendingRefunds } from "@/server/billing-refund.service";
import { recordStepUp, STEP_UP_MONEY_MS } from "@/server/admin-step-up.service";
import * as mirror from "@/server/billing-mirror.service";
import { userCard, spaceCard, searchUsers } from "@/server/admin-console.service";
import { makeOrg, makeUser } from "./helpers";

const NOW = new Date("2030-06-12T10:00:00Z");

const setup = async () => {
  const admin = await makeUser("Admin");
  env().ADMIN_EMAILS = admin.email;
  const sessionId = randomUUID();
  await prisma.session.create({
    data: { id: sessionId, token: randomUUID(), userId: admin.userId, expiresAt: new Date("2031-01-01T00:00:00Z") },
  });
  await recordStepUp(sessionId, "passkey", NOW);
  const actor = { ...admin, sessionId };
  const invoiceId = `in_${randomUUID()}`;
  await prisma.billingInvoice.create({
    data: {
      id: invoiceId,
      livemode: false,
      stripeCustomerId: "cus_test",
      status: "paid",
      currency: "eur",
      totalCents: 1900,
      amountPaidCents: 1900,
      stripeCreatedAt: NOW,
      syncedAt: NOW,
    },
  });
  let refunded = 0;
  const creditNotes = vi.fn(async (request: { amount: number }, _options?: { idempotencyKey?: string }) => {
    refunded += request.amount;
    return { id: `cn_${randomUUID()}`, refunds: [{ refund: `re_${randomUUID()}` }] };
  });
  vi.spyOn(stripeLib, "stripe").mockReturnValue({
    invoices: {
      retrieve: async () => ({ amount_paid: 1900, post_payment_credit_notes_amount: refunded, livemode: false }),
    },
    creditNotes: { create: creditNotes },
  } as never);
  vi.spyOn(mirror, "syncInvoice").mockResolvedValue(undefined);
  vi.spyOn(mirror, "sendFounderAlert").mockResolvedValue(undefined);
  return { actor, invoiceId, creditNotes, setRefunded: (value: number) => (refunded = value) };
};

const prepareFull = (actor: Awaited<ReturnType<typeof setup>>["actor"], invoiceId: string, amountCents = 1900) =>
  prepareRefund(actor, { invoiceId, amountCents, reasonCode: "withdrawal", withdrawal: true }, NOW);

describe("remboursements depuis la console", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exige une vérification récente pour toucher à l'argent", async () => {
    const { actor, invoiceId } = await setup();
    const later = new Date(NOW.getTime() + STEP_UP_MONEY_MS + 1000);
    await expect(
      prepareRefund(actor, { invoiceId, amountCents: 100, reasonCode: "goodwill", withdrawal: false }, later),
    ).rejects.toThrow();
  });

  it("refuse un montant supérieur au reste à rembourser", async () => {
    const { actor, invoiceId } = await setup();
    await expect(
      prepareRefund(actor, { invoiceId, amountCents: 2000, reasonCode: "goodwill", withdrawal: false }, NOW),
    ).rejects.toThrow();
  });

  it("n'envoie la demande qu'avec le jeton et le bon montant, une seule fois", async () => {
    const { actor, invoiceId, creditNotes } = await setup();
    const prepared = await prepareFull(actor, invoiceId);
    await expect(
      confirmRefund(actor, { refundId: prepared.refundId, token: "faux", amountCents: 1900 }, NOW),
    ).rejects.toThrow();
    await expect(
      confirmRefund(actor, { refundId: prepared.refundId, token: prepared.token, amountCents: 1800 }, NOW),
    ).rejects.toThrow();
    expect(creditNotes).not.toHaveBeenCalled();
    expect(
      await confirmRefund(actor, { ...prepared, refundId: prepared.refundId, token: prepared.token }, NOW),
    ).toEqual({
      state: "succeeded",
    });
    expect(creditNotes).toHaveBeenCalledOnce();
    expect(creditNotes.mock.calls[0]?.[1]).toEqual({ idempotencyKey: `refund-${prepared.refundId}` });
  });

  it("ne transmet jamais la note interne à Stripe", async () => {
    const { actor, invoiceId, creditNotes } = await setup();
    const prepared = await prepareRefund(
      actor,
      { invoiceId, amountCents: 500, reasonCode: "service_issue", withdrawal: false, note: "note interne" },
      NOW,
    );
    await confirmRefund(actor, prepared, NOW);
    expect(JSON.stringify(creditNotes.mock.calls[0]?.[0])).not.toContain("note interne");
  });

  it("n'autorise qu'un envoi en cas de double confirmation concurrente", async () => {
    const { actor, invoiceId, creditNotes } = await setup();
    const first = await prepareFull(actor, invoiceId, 900);
    const second = await prepareFull(actor, invoiceId, 900);
    const results = await Promise.allSettled([confirmRefund(actor, first, NOW), confirmRefund(actor, second, NOW)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(creditNotes).toHaveBeenCalledOnce();
  });

  it("annule si le montant remboursé a changé chez Stripe entre-temps", async () => {
    const { actor, invoiceId, creditNotes, setRefunded } = await setup();
    const prepared = await prepareFull(actor, invoiceId, 900);
    setRefunded(500);
    await expect(confirmRefund(actor, prepared, NOW)).rejects.toThrow();
    expect(creditNotes).not.toHaveBeenCalled();
    expect((await prisma.billingRefund.findUnique({ where: { id: prepared.refundId } }))?.state).toBe("expired");
  });

  it("reprend une réponse perdue avec la même clé, puis passe en vérification après 23 h", async () => {
    const { actor, invoiceId, creditNotes } = await setup();
    creditNotes.mockRejectedValueOnce(new Error("réseau"));
    const prepared = await prepareFull(actor, invoiceId, 900);
    expect(await confirmRefund(actor, prepared, NOW)).toEqual({ state: "pending" });

    const soon = new Date(NOW.getTime() + 6 * 60_000);
    expect(await retryPendingRefunds(soon)).toBe(1);
    expect(creditNotes.mock.calls[1]?.[1]).toEqual({ idempotencyKey: `refund-${prepared.refundId}` });
    expect((await prisma.billingRefund.findUnique({ where: { id: prepared.refundId } }))?.state).toBe("succeeded");

    creditNotes.mockRejectedValueOnce(new Error("réseau"));
    const late = await prepareFull(actor, invoiceId, 100);
    await confirmRefund(actor, late, NOW);
    await retryPendingRefunds(new Date(NOW.getTime() + 24 * 3_600_000));
    expect((await prisma.billingRefund.findUnique({ where: { id: late.refundId } }))?.state).toBe("review");
  });
});

describe("confidentialité de la console", () => {
  it("ne renvoie ni santé, ni notes privées, ni contenu d'entraînement", async () => {
    const admin = await makeUser("Support");
    env().ADMIN_EMAILS = admin.email;
    const org = await makeOrg("Prive");
    const responses = [
      await userCard(admin, org.owner.userId),
      await spaceCard(admin, org.organizationId),
      await searchUsers(admin, {}),
    ];
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && !(value instanceof Date)) {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key);
          walk(inner);
        }
      }
    };
    walk(responses);
    for (const forbidden of [
      "rpe",
      "pain",
      "injury",
      "injuries",
      "coachNote",
      "note",
      "draft",
      "snapshot",
      "birthDate",
    ]) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
  });

  it("refuse la console à un compte ordinaire", async () => {
    const admin = await makeUser("Vrai");
    const other = await makeUser("Autre");
    env().ADMIN_EMAILS = admin.email;
    await expect(userCard(other, admin.userId)).rejects.toThrow();
  });
});
