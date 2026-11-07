import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createCheckout, createPortal, getBillingOverview } from "@/server/billing.service";
import { deleteAccount } from "@/server/account.service";
import { processBillingCommands } from "@/server/billing-command.service";
import { reconcileStripeSubscription } from "@/server/stripe-subscriptions.service";
import { addStaff, makeOrg } from "./helpers";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  update: vi.fn(),
  portal: vi.fn(),
  customer: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  billingEnabled: () => true,
  priceIdFor: () => "price_coach",
  planForPriceId: () => "coach",
  stripe: () => ({
    customers: { create: mocks.customer },
    subscriptions: { list: mocks.list, update: mocks.update },
    checkout: {
      sessions: {
        create: mocks.create,
        retrieve: mocks.retrieve,
        expire: mocks.expire,
        list: async () => ({ data: [] }),
      },
    },
    billingPortal: { sessions: { create: mocks.portal } },
  }),
}));
const input = { plan: "coach" as const, interval: "month" as const };
const setup = async () => {
  const a = await makeOrg("Reliabilite");
  await prisma.organization.update({
    where: { id: a.organizationId },
    data: { stripeCustomerId: `cus_${a.organizationId}`, billingOwnerId: a.owner.userId },
  });
  return a;
};
const session = { id: "cs_reliability", url: "https://checkout.test/one", expires_at: 1893456000 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue(session);
  mocks.list.mockResolvedValue({ data: [], has_more: false });
  mocks.retrieve.mockResolvedValue({ ...session, status: "open" });
  mocks.expire.mockResolvedValue({ status: "expired" });
  mocks.update.mockResolvedValue({});
  mocks.customer.mockResolvedValue({ id: "cus_new_payer" });
});

it("l'arrêt d'urgence des souscriptions ne contacte pas Stripe", async () => {
  const a = await setup();
  env().BILLING_CHECKOUT_ENABLED = "false";
  try {
    await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toMatchObject({
      code: "billing_disabled",
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  } finally {
    env().BILLING_CHECKOUT_ENABLED = "true";
  }
});

it("sérialise deux requêtes réellement concurrentes avant tout appel Stripe", async () => {
  const a = await setup();
  let release!: () => void;
  let began!: () => void;
  const started = new Promise<void>((r) => {
    began = r;
  });
  mocks.create.mockImplementationOnce(async () => {
    began();
    await new Promise<void>((r) => {
      release = r;
    });
    return session;
  });
  const first = createCheckout(a.owner.userId, a.organizationId, input);
  await started;
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toMatchObject({
    code: "checkout_in_progress",
  });
  release();
  await expect(first).resolves.toEqual({ url: session.url });
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).resolves.toEqual({ url: session.url });
  expect(mocks.create).toHaveBeenCalledTimes(1);
});

it("reprend une réponse perdue avec la même clé et les paramètres figés", async () => {
  const a = await setup();
  mocks.create.mockRejectedValueOnce(new Error("response lost"));
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toThrow("response lost");
  await createCheckout(a.owner.userId, a.organizationId, input);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
});

it("une reprise après expiration du bail garde la tentative Stripe", async () => {
  const a = await setup();
  mocks.create.mockRejectedValueOnce(new Error("worker stopped"));
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toThrow();
  await prisma.checkoutIntent.update({
    where: { organizationId: a.organizationId },
    data: { leaseToken: "ancien-worker", leaseUntil: new Date(Date.now() - 1) },
  });
  await createCheckout(a.owner.userId, a.organizationId, input);
  expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
});

it("une session achevée ne bloque plus la reprise après une résiliation confirmée chez Stripe", async () => {
  const a = await setup();
  await createCheckout(a.owner.userId, a.organizationId, input);
  mocks.retrieve.mockResolvedValue({ ...session, status: "complete", subscription: "sub_old" });
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toMatchObject({
    code: "checkout_completed",
  });
  mocks.list.mockResolvedValue({ data: [{ id: "sub_old", status: "canceled" }], has_more: false });
  await createCheckout(a.owner.userId, a.organizationId, input);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.create.mock.calls[0]![1].idempotencyKey).not.toBe(mocks.create.mock.calls[1]![1].idempotencyKey);
});

it("deux abonnements vivants déclenchent une anomalie, jamais une annulation automatique", async () => {
  const a = await setup();
  mocks.list.mockResolvedValue({
    data: ["active", "incomplete"].map((status, i) => ({
      id: `sub_${i}`,
      status,
      customer: `cus_${a.organizationId}`,
      metadata: { organizationId: a.organizationId },
    })),
  });
  await reconcileStripeSubscription(a.organizationId);
  expect((await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).billingIssue).toBe(
    "multiple_subscriptions",
  );
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toMatchObject({
    code: "billing_review",
  });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("ne recrée jamais une opération d'issue inconnue après la fenêtre d'idempotence", async () => {
  const a = await setup();
  mocks.create.mockRejectedValueOnce(new Error("lost"));
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toThrow();
  await prisma.checkoutIntent.update({
    where: { organizationId: a.organizationId },
    data: { attemptedAt: new Date(Date.now() - 25 * 3600_000) },
  });
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toMatchObject({
    code: "checkout_review",
  });
  expect(mocks.create).toHaveBeenCalledTimes(1);
});

it("le transfert récupère aussi un Checkout dont la réponse s'était perdue avant de le fermer", async () => {
  const a = await setup();
  const heir = await addStaff(a.organizationId, "Reprise", "coach");
  mocks.create.mockRejectedValueOnce(new Error("lost"));
  await expect(createCheckout(a.owner.userId, a.organizationId, input)).rejects.toThrow();
  await deleteAccount(a.owner.userId);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
  expect(mocks.expire).toHaveBeenCalledWith(session.id);
  expect(await prisma.billingCommand.count({ where: { organizationId: a.organizationId, state: "pending" } })).toBe(0);
  expect((await getBillingOverview(heir.userId, a.organizationId)).billingTransferred).toBe(false);
  mocks.retrieve.mockResolvedValue({ ...session, status: "expired" });
  await createCheckout(heir.userId, a.organizationId, input);
  expect(mocks.customer).toHaveBeenCalledTimes(1);
  expect(mocks.create.mock.lastCall![0].customer).toBe("cus_new_payer");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } });
  expect(org.billingOwnerId).toBe(heir.userId);
  expect(org.stripeCustomerId).toBe("cus_new_payer");
});

it("un changement d'offre attend l'expiration confirmée de la session précédente", async () => {
  const a = await setup();
  await createCheckout(a.owner.userId, a.organizationId, input);
  mocks.expire.mockRejectedValueOnce(new Error("expiration lost"));
  await expect(createCheckout(a.owner.userId, a.organizationId, { ...input, interval: "year" })).rejects.toThrow();
  expect(mocks.create).toHaveBeenCalledTimes(1);
  mocks.retrieve.mockResolvedValue({ ...session, status: "expired" });
  await createCheckout(a.owner.userId, a.organizationId, { ...input, interval: "year" });
  expect(mocks.create.mock.calls[1]![1].idempotencyKey).not.toBe(mocks.create.mock.calls[0]![1].idempotencyKey);
});

it("conserve l'ordre d'annuler malgré une panne, et interdit le portail du partant", async () => {
  const a = await setup();
  const heir = await addStaff(a.organizationId, "Repreneur", "coach");
  const ref = `sub_${a.organizationId}`;
  await prisma.subscription.create({
    data: {
      organizationId: a.organizationId,
      planKey: "coach",
      provider: "stripe",
      providerRef: ref,
      status: "active",
    },
  });
  mocks.update.mockRejectedValueOnce(new Error("Stripe unavailable"));
  await deleteAccount(a.owner.userId);
  expect(await prisma.user.count({ where: { id: a.owner.userId } })).toBe(0);
  expect(
    await prisma.billingCommand.findUnique({
      where: { kind_externalRef: { kind: "cancel_at_period_end", externalRef: ref } },
    }),
  ).toMatchObject({ state: "pending", attempts: 1 });
  await expect(createPortal(heir.userId, a.organizationId)).rejects.toMatchObject({ code: "billing_transferred" });
  expect(mocks.portal).not.toHaveBeenCalled();
  await processBillingCommands(new Date(Date.now() + 3600_000));
  expect(
    await prisma.billingCommand.findUnique({
      where: { kind_externalRef: { kind: "cancel_at_period_end", externalRef: ref } },
    }),
  ).toMatchObject({ state: "done", attempts: 2 });
});

it("capture un client Stripe créé entre la lecture initiale et le verrou du transfert", async () => {
  const a = await makeOrg("PaiementConcurrent");
  await addStaff(a.organizationId, "RepreneurConcurrent", "coach");
  const original = prisma.$transaction.bind(prisma);
  const transaction = vi.spyOn(prisma, "$transaction");
  transaction.mockImplementationOnce(async (work) => {
    // Le Checkout a fini et libéré son bail juste avant que le départ prenne le verrou.
    transaction.mockRestore();
    await prisma.organization.update({
      where: { id: a.organizationId },
      data: {
        stripeCustomerId: "cus_completed_before_transfer",
        billingOwnerId: a.owner.userId,
      },
    });
    await prisma.subscription.create({
      data: {
        organizationId: a.organizationId,
        planKey: "coach",
        provider: "stripe",
        providerRef: "sub_completed_before_transfer",
        status: "active",
      },
    });
    return original(work);
  });
  try {
    await deleteAccount(a.owner.userId);
    expect(
      await prisma.billingCommand.findUnique({
        where: {
          kind_externalRef: {
            kind: "close_customer_checkout",
            externalRef: "cus_completed_before_transfer",
          },
        },
      }),
    ).not.toBeNull();
    expect(
      await prisma.billingCommand.findUnique({
        where: {
          kind_externalRef: {
            kind: "cancel_at_period_end",
            externalRef: "sub_completed_before_transfer",
          },
        },
      }),
    ).not.toBeNull();
  } finally {
    transaction.mockRestore();
  }
});

it("ne promeut pas un repreneur suspendu entre la lecture initiale et le transfert", async () => {
  const a = await makeOrg("RepriseConcurrente");
  const heir = await addStaff(a.organizationId, "CoachSuspendu", "coach");
  const original = prisma.$transaction.bind(prisma);
  const transaction = vi.spyOn(prisma, "$transaction");
  transaction.mockImplementationOnce(async (work) => {
    transaction.mockRestore();
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: a.organizationId, userId: heir.userId } },
      data: { status: "suspended" },
    });
    return original(work);
  });
  try {
    await expect(deleteAccount(a.owner.userId)).rejects.toMatchObject({ code: "successor_changed" });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).ownerId).toBe(
      a.owner.userId,
    );
    expect(await prisma.user.count({ where: { id: a.owner.userId } })).toBe(1);
  } finally {
    transaction.mockRestore();
  }
});
