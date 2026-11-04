import { createElement } from "react";
import type { BillingEmail } from "@tartan/domain";
import { PLANS, type PlanKey } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { SubscriptionCancelledEmail, SubscriptionConfirmedEmail, SubscriptionEndedEmail } from "@email/billing";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

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
  const due = await prisma.emailOutbox.findMany({
    where: {
      sentAt: null,
      nextAttemptAt: { lte: now },
      createdAt: { gte: new Date(now.getTime() - RETRY_WINDOW_MS) },
    },
    take: 50,
  });
  let sent = 0;
  for (const row of due) {
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: row.id, sentAt: null, nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const { subject, react } = render(row.kind, row.payload as Payload, row.organizationId);
      await sendEmail({ to: row.toEmail, subject, react, idempotencyKey: `outbox/${row.dedupeKey}` });
      await prisma.emailOutbox.update({ where: { id: row.id }, data: { sentAt: now } });
      sent += 1;
    } catch {
      log.warn("email_outbox_failed", { code: row.kind, entityId: row.id });
    }
  }
  return sent;
};
