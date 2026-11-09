import { createHash, randomBytes, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { isRefundAmountValid, stripeCreditReason, type RefundReason } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Prisma } from "@/generated/prisma/client";
import { AppError, invalid, notFound } from "@/lib/errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { requireAdmin } from "./admin.service";
import { requireStepUp, STEP_UP_MONEY_MS } from "./admin-step-up.service";
import { sendFounderAlert, syncInvoice } from "./billing-mirror.service";

const PREPARE_TTL_MS = 10 * 60_000;
// Stripe conserve une clé d'idempotence 24 h : au-delà, relancer pourrait rembourser deux fois.
const RETRY_WINDOW_MS = 23 * 3_600_000;
const RETRY_AFTER_MS = 5 * 60_000;

type AdminActor = { email: string; userId: string; sessionId?: string };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const freshPaid = async (invoiceId: string) => {
  const invoice = await stripe().invoices.retrieve(invoiceId);
  return { paid: invoice.amount_paid, refunded: invoice.post_payment_credit_notes_amount, livemode: invoice.livemode };
};

export const prepareRefund = async (
  actor: AdminActor,
  input: {
    invoiceId: string;
    amountCents: number;
    reasonCode: RefundReason;
    withdrawal: boolean;
    note?: string | null;
  },
  now: Date = new Date(),
) => {
  await requireStepUp(actor, STEP_UP_MONEY_MS, now);
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw notFound();
  const fresh = await freshPaid(input.invoiceId);
  if (!isRefundAmountValid(input.amountCents, fresh.paid, fresh.refunded)) throw invalid(m.admin.refundTooHigh);
  const token = randomBytes(24).toString("base64url");
  const refund = await prisma.billingRefund.create({
    data: {
      invoiceId: input.invoiceId,
      organizationId: invoice.organizationId,
      livemode: fresh.livemode,
      amountCents: input.amountCents,
      reasonCode: input.reasonCode,
      note: input.note ?? null,
      withdrawal: input.withdrawal,
      source: "console",
      state: "prepared",
      confirmationHash: hash(token),
      confirmationExpiresAt: new Date(now.getTime() + PREPARE_TTL_MS),
      expectedRefundedCents: fresh.refunded,
      preparedBy: actor.userId,
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: invoice.organizationId,
      actorId: actor.userId,
      action: "refund_prepared",
      entity: "billing_refund",
      entityId: refund.id,
      metadata: { amountCents: input.amountCents, reasonCode: input.reasonCode, withdrawal: input.withdrawal },
    },
  });
  return { refundId: refund.id, token, amountCents: input.amountCents, refundableCents: fresh.paid - fresh.refunded };
};

// Le SDK Stripe nomme ses erreurs dans `type` : `name` reste « Error ».
const errorType = (error: unknown): string =>
  typeof error === "object" && error !== null && "type" in error && typeof error.type === "string"
    ? error.type
    : error instanceof Error
      ? error.name
      : "unknown";
const isDefinitive = (error: unknown): boolean => errorType(error) === "StripeInvalidRequestError";

// La requête exacte est conservée : une reprise renvoie la même, avec la même clé.
const execute = async (refundId: string, leaseToken: string, now: Date) => {
  const refund = await prisma.billingRefund.findUniqueOrThrow({ where: { id: refundId } });
  const request = refund.request as unknown as Stripe.CreditNoteCreateParams;
  try {
    const note = await stripe().creditNotes.create(request, { idempotencyKey: `refund-${refund.id}` });
    const stripeRefundId = note.refunds?.[0]?.refund;
    await prisma.billingRefund.updateMany({
      where: { id: refund.id, leaseToken },
      data: {
        state: "succeeded",
        inFlightInvoiceId: null,
        leaseToken: null,
        leaseUntil: null,
        stripeCreditNoteId: note.id,
        stripeRefundId: typeof stripeRefundId === "string" ? stripeRefundId : (stripeRefundId?.id ?? null),
        completedAt: now,
        lastErrorCode: null,
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: refund.organizationId,
        actorId: refund.preparedBy,
        action: "refund_succeeded",
        entity: "billing_refund",
        entityId: refund.id,
        metadata: { amountCents: refund.amountCents, reasonCode: refund.reasonCode, withdrawal: refund.withdrawal },
      },
    });
    await syncInvoice(refund.invoiceId).catch(() => log.warn("refund_mirror_failed", { entityId: refund.id }));
    await sendFounderAlert(m.admin.alerts.refund(refund.amountCents / 100)).catch(() => undefined);
    return "succeeded" as const;
  } catch (error) {
    const definitive = isDefinitive(error);
    await prisma.billingRefund.updateMany({
      where: { id: refund.id, leaseToken },
      data: {
        state: definitive ? "failed" : "sending",
        ...(definitive ? { inFlightInvoiceId: null } : {}),
        leaseToken: null,
        leaseUntil: null,
        lastErrorCode: errorType(error).slice(0, 60),
      },
    });
    log.warn("refund_failed", { entityId: refund.id, code: definitive ? "definitive" : "retryable" });
    return definitive ? ("failed" as const) : ("pending" as const);
  }
};

export const confirmRefund = async (
  actor: AdminActor,
  input: { refundId: string; token: string; amountCents: number },
  now: Date = new Date(),
) => {
  await requireStepUp(actor, STEP_UP_MONEY_MS, now);
  const refund = await prisma.billingRefund.findUnique({ where: { id: input.refundId } });
  if (!refund || refund.state !== "prepared") throw notFound();
  if (
    refund.confirmationHash !== hash(input.token) ||
    !refund.confirmationExpiresAt ||
    refund.confirmationExpiresAt < now ||
    refund.amountCents !== input.amountCents
  ) {
    throw invalid(m.admin.refundExpired);
  }
  const leaseToken = randomUUID();
  const request: Stripe.CreditNoteCreateParams = {
    invoice: refund.invoiceId,
    amount: refund.amountCents,
    refund_amount: refund.amountCents,
    reason: stripeCreditReason(refund.reasonCode as RefundReason),
    metadata: { refundId: refund.id },
  };
  try {
    const claimed = await prisma.billingRefund.updateMany({
      where: { id: refund.id, state: "prepared" },
      data: {
        state: "sending",
        confirmedAt: now,
        attemptedAt: now,
        attempts: { increment: 1 },
        // Contrainte d'unicité : deux remboursements d'une même facture ne partent jamais ensemble.
        inFlightInvoiceId: refund.invoiceId,
        leaseToken,
        leaseUntil: new Date(now.getTime() + 2 * 60_000),
        request: request as unknown as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) throw new AppError(409, "refund_in_progress", m.admin.refundInProgress);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "refund_in_progress", m.admin.refundInProgress);
    }
    throw error;
  }
  // Relu une fois le verrou pris : un remboursement terminé juste avant, ici ou chez Stripe, est forcément vu.
  const release = (state: "prepared" | "expired") =>
    prisma.billingRefund.updateMany({
      where: { id: refund.id, leaseToken },
      data: { state, inFlightInvoiceId: null, leaseToken: null, leaseUntil: null },
    });
  const fresh = await freshPaid(refund.invoiceId).catch(async (error: unknown) => {
    await release("prepared");
    throw error;
  });
  if (fresh.refunded !== refund.expectedRefundedCents) {
    await release("expired");
    throw invalid(m.admin.refundChanged);
  }
  return { state: await execute(refund.id, leaseToken, now) };
};

// Reprise d'une réponse perdue, avec la même clé ; au-delà de sa validité, une personne vérifie dans Stripe.
export const retryPendingRefunds = async (now: Date = new Date()): Promise<number> => {
  const rows = await prisma.billingRefund.findMany({
    where: {
      state: "sending",
      attemptedAt: { lte: new Date(now.getTime() - RETRY_AFTER_MS) },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    take: 20,
  });
  let retried = 0;
  for (const row of rows) {
    if (row.attemptedAt && now.getTime() - row.attemptedAt.getTime() > RETRY_WINDOW_MS) {
      await prisma.billingRefund.update({ where: { id: row.id }, data: { state: "review" } });
      await sendFounderAlert(m.admin.alerts.refundReview).catch(() => undefined);
      continue;
    }
    const leaseToken = randomUUID();
    const claimed = await prisma.billingRefund.updateMany({
      where: { id: row.id, state: "sending", OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      data: { leaseToken, leaseUntil: new Date(now.getTime() + 2 * 60_000), attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    await execute(row.id, leaseToken, now);
    retried++;
  }
  return retried;
};

export const listRefunds = async (actor: { email: string }) => {
  await requireAdmin(actor.email);
  return prisma.billingRefund.findMany({
    where: { state: { not: "prepared" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      invoiceId: true,
      amountCents: true,
      reasonCode: true,
      withdrawal: true,
      state: true,
      lastErrorCode: true,
      createdAt: true,
      completedAt: true,
    },
  });
};
