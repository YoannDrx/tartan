import { createElement } from "react";
import type { BillingEmail } from "@tartan/domain";
import { PLANS, isPaidPlan, type PlanKey } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { SubscriptionCancelledEmail, SubscriptionConfirmedEmail, SubscriptionEndedEmail } from "@email/billing";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { EmailSuppressedError } from "./email-suppression.service";

const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 5 * 60 * 1000;

const dateInParis = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

type Payload = {
  space: string;
  plan: PlanKey;
  interval: "month" | "year";
  trialEnd: string | null;
  cancelAt: string | null;
  unpaid: boolean;
};

// Dans la transaction de la transition : la clé unique évite tout doublon, même en concurrence.
export const enqueueBillingEmail = async (
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    to: string;
    email: BillingEmail;
    space: string;
    plan: PlanKey;
    interval: "month" | "year";
    trialEnd: Date | null;
  },
): Promise<void> => {
  const { email } = input;
  const payload: Payload = {
    space: input.space,
    plan: input.plan,
    interval: input.interval,
    trialEnd: input.trialEnd?.toISOString() ?? null,
    cancelAt: email.kind === "cancel" ? email.cancelAt.toISOString() : null,
    unpaid: email.kind === "ended" && email.unpaid,
  };
  await tx.emailOutbox.createMany({
    data: [
      {
        organizationId: input.organizationId,
        toEmail: input.to,
        kind: email.kind,
        dedupeKey: email.dedupeKey,
        payload,
      },
    ],
    skipDuplicates: true,
  });
};

const render = (kind: string, p: Payload, organizationId: string | null) => {
  const url = `${env().NEXT_PUBLIC_APP_URL}/abonnement${organizationId ? `?espace=${organizationId}` : ""}`;
  const plan = m.billing.plans[p.plan];
  if (kind === "started") {
    return {
      subject: m.email.confirmed.subject(plan),
      react: createElement(SubscriptionConfirmedEmail, {
        space: p.space,
        plan,
        price: PLANS[p.plan].prices?.[p.interval] ?? null,
        interval: p.interval,
        trialEnd: p.trialEnd ? dateInParis(p.trialEnd) : null,
        url,
      }),
    };
  }
  if (kind === "cancel") {
    return {
      subject: m.email.cancelled.subject,
      react: createElement(SubscriptionCancelledEmail, {
        space: p.space,
        plan,
        date: dateInParis(p.cancelAt as string),
        url,
      }),
    };
  }
  return {
    subject: m.email.ended.subject,
    react: createElement(SubscriptionEndedEmail, { space: p.space, unpaid: p.unpaid, url }),
  };
};

// Après la validation, puis à chaque passage de la tâche de notifications, pendant 24 h.
export const flushEmailOutbox = async (now: Date = new Date()): Promise<number> => {
  const expired = await prisma.emailOutbox.updateMany({
    where: {
      sentAt: null,
      failedAt: null,
      nextAttemptAt: { lte: now },
      createdAt: { lt: new Date(now.getTime() - RETRY_WINDOW_MS) },
      OR: [{ retryUntil: null }, { retryUntil: { lt: now } }],
    },
    data: { failedAt: now, failureCode: "delivery_window_expired" },
  });
  if (expired.count) log.error("email_outbox_expired", { count: expired.count });
  const due = await prisma.emailOutbox.findMany({
    where: {
      sentAt: null,
      failedAt: null,
      nextAttemptAt: { lte: now },
      OR: [{ createdAt: { gte: new Date(now.getTime() - RETRY_WINDOW_MS) } }, { retryUntil: { gte: now } }],
    },
    take: 50,
  });
  let sent = 0;
  for (const row of due) {
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: row.id, sentAt: null, failedAt: null, nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      if (!(await isBillingEmailRelevant(row, now))) {
        await prisma.emailOutbox.update({ where: { id: row.id }, data: { failedAt: now, failureCode: "obsolete" } });
        continue;
      }
      const { subject, react } = render(row.kind, row.payload as Payload, row.organizationId);
      await sendEmail({ to: row.toEmail, subject, react, idempotencyKey: `outbox/${row.dedupeKey}` });
      await prisma.emailOutbox.update({ where: { id: row.id }, data: { sentAt: now } });
      sent += 1;
    } catch (error) {
      if (error instanceof EmailSuppressedError) {
        await prisma.emailOutbox.update({
          where: { id: row.id },
          data: { failedAt: now, failureCode: "recipient_suppressed" },
        });
      }
      log.warn("email_outbox_failed", { code: row.kind, entityId: row.id });
    }
  }
  return sent;
};

export const isBillingEmailRelevant = async (
  row: { organizationId: string | null; kind: string; dedupeKey: string; payload: unknown; toEmail: string },
  now = new Date(),
) => {
  if (!row.organizationId) return false;
  const org = await prisma.organization.findUnique({
    where: { id: row.organizationId },
    include: { owner: { select: { email: true } } },
  });
  if (!org || org.owner.email !== row.toEmail || (org.billingOwnerId && org.billingOwnerId !== org.ownerId))
    return false;
  const sub = await prisma.subscription.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
  if (!sub?.providerRef || !row.dedupeKey.startsWith(`${sub.providerRef}:`)) return false;
  const payload = row.payload as Payload;
  if (row.kind === "started")
    return (
      isPaidPlan(sub.planKey as PlanKey) &&
      sub.status !== "canceled" &&
      sub.planKey === payload.plan &&
      (!payload.trialEnd || new Date(payload.trialEnd) > now)
    );
  if (row.kind === "cancel")
    return sub.cancelAt?.toISOString() === payload.cancelAt && sub.cancelAt > now && sub.status !== "canceled";
  return row.kind === "ended" && sub.status === "canceled";
};
