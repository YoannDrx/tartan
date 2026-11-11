import { createElement } from "react";
import type { BillingEmail } from "@tartan/domain";
import { PLANS, isPaidPlan, type PlanKey } from "@tartan/domain";
import { m } from "@tartan/i18n";
import {
  SubscriptionCancelledEmail,
  SubscriptionConfirmedEmail,
  SubscriptionEndedEmail,
  BillingNoticeEmail,
  RenewalNoticeEmail,
} from "@email/billing";
import { AccountDeletedEmail, SpaceTransferredEmail } from "@email/auth";
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

type AccountPayload = { userId: string; hadSubscription: boolean };
type TransferPayload = { userId: string; previous: string; space: string };

export const enqueueAccountEmails = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    to: string;
    hadSubscription: boolean;
    transfers: { organizationId: string; to: string; userId: string; previous: string; space: string }[];
  },
): Promise<void> => {
  await tx.emailOutbox.createMany({
    data: [
      {
        toEmail: input.to,
        kind: "account_deleted",
        dedupeKey: `account:${input.userId}:deleted`,
        payload: { userId: input.userId, hadSubscription: input.hadSubscription } satisfies AccountPayload,
      },
      ...input.transfers.map((transfer) => ({
        organizationId: transfer.organizationId,
        toEmail: transfer.to,
        kind: "space_transferred",
        dedupeKey: `account:${input.userId}:transferred:${transfer.organizationId}`,
        payload: {
          userId: transfer.userId,
          previous: transfer.previous,
          space: transfer.space,
        } satisfies TransferPayload,
      })),
    ],
    skipDuplicates: true,
  });
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

// Validation bancaire demandée : une ligne par facture, rattachée à l'abonnement comme les autres avis.
export const enqueuePaymentActionRequired = async (organizationId: string, invoiceId: string): Promise<void> => {
  const [org, invoice] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, plan: true, ownerId: true, billingOwnerId: true, owner: { select: { email: true } } },
    }),
    prisma.billingInvoice.findUnique({ where: { id: invoiceId }, select: { stripeSubscriptionId: true } }),
  ]);
  if (!org || !invoice?.stripeSubscriptionId) return;
  if (org.billingOwnerId && org.billingOwnerId !== org.ownerId) return;
  await prisma.emailOutbox.createMany({
    data: [
      {
        organizationId,
        toEmail: org.owner.email,
        kind: "payment_action_required",
        dedupeKey: `${invoice.stripeSubscriptionId}:action_required:${invoiceId}`,
        payload: {
          space: org.name,
          plan: org.plan,
          interval: "month",
          trialEnd: null,
          cancelAt: null,
          unpaid: false,
          invoiceId,
        } satisfies Payload & { invoiceId: string },
      },
    ],
    skipDuplicates: true,
  });
};

// Un incident de paiement ne donne qu'un e-mail : « échoué » et « validation demandée » ne se cumulent pas.
const INCIDENT_WINDOW_MS = 60 * 60 * 1000;

const render = async (kind: string, payload: unknown, organizationId: string | null, now: Date) => {
  if (kind === "account_deleted") {
    return {
      subject: m.email.accountDeleted.subject,
      react: createElement(AccountDeletedEmail, { hadSubscription: (payload as AccountPayload).hadSubscription }),
    };
  }
  if (kind === "space_transferred") {
    const p = payload as TransferPayload;
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId! } });
    const sub = await prisma.subscription.findFirst({
      where: { organizationId: org.id, provider: "stripe" },
      orderBy: { createdAt: "desc" },
    });
    const command = sub?.providerRef
      ? await prisma.billingCommand.findUnique({
          where: { kind_externalRef: { kind: "cancel_at_period_end", externalRef: sub.providerRef } },
        })
      : null;
    // Une échéance n'est annoncée qu'après confirmation de la commande, et seulement pour l'ancien payeur.
    const end =
      !org.billingIssue &&
      org.billingOwnerId !== org.ownerId &&
      command?.state === "done" &&
      sub?.currentPeriodEnd &&
      sub.currentPeriodEnd > now
        ? sub.currentPeriodEnd
        : null;
    return {
      subject: m.email.spaceTransferred.subject(p.space),
      react: createElement(SpaceTransferredEmail, {
        previous: p.previous,
        space: p.space,
        subscriptionEnds: end ? dateInParis(end.toISOString()) : null,
        url: `${env().NEXT_PUBLIC_APP_URL}/reglages?espace=${org.id}`,
      }),
    };
  }
  const p = payload as Payload;
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
  if (kind === "renewal_notice") {
    const copy = m.email.renewalNotice;
    return {
      subject: copy.subject,
      react: createElement(RenewalNoticeEmail, {
        title: copy.subject,
        body: copy.body(p.space),
        deadline: copy.deadline(dateInParis((p as Payload & { renewalAt: string }).renewalAt)),
        cta: copy.cta,
        url,
      }),
    };
  }
  if (
    kind === "payment_failed" ||
    kind === "payment_action_required" ||
    kind === "recovered" ||
    kind === "trial_ending"
  ) {
    const copy =
      kind === "payment_failed"
        ? m.email.paymentFailed
        : kind === "payment_action_required"
          ? m.email.paymentActionRequired
          : kind === "recovered"
            ? m.email.paymentRecovered
            : m.email.trialEnding;
    return {
      subject: copy.subject,
      react: createElement(BillingNoticeEmail, {
        title: copy.subject,
        body: copy.body(p.space, p.trialEnd ? dateInParis(p.trialEnd) : ""),
        cta: copy.cta,
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
      if (!(await isEmailRelevant(row, now))) {
        await prisma.emailOutbox.update({ where: { id: row.id }, data: { failedAt: now, failureCode: "obsolete" } });
        continue;
      }
      const { subject, react } = await render(row.kind, row.payload, row.organizationId, now);
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

// Article L.215-1 : entre trois mois et un mois avant l'échéance d'une formule annuelle.
export const queueRenewalNotices = async (now: Date = new Date()): Promise<number> => {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      provider: "stripe",
      status: "active",
      cancelAt: null,
      interval: "year",
      currentPeriodEnd: {
        gt: new Date(now.getTime() + 32 * 86_400_000),
        lte: new Date(now.getTime() + 45 * 86_400_000),
      },
    },
    select: {
      providerRef: true,
      planKey: true,
      currentPeriodEnd: true,
      organization: {
        select: { id: true, name: true, billingOwnerId: true, ownerId: true, owner: { select: { email: true } } },
      },
    },
  });
  let queued = 0;
  for (const sub of subscriptions) {
    const org = sub.organization;
    if (!sub.providerRef || (org.billingOwnerId && org.billingOwnerId !== org.ownerId)) continue;
    const created = await prisma.emailOutbox.createMany({
      data: [
        {
          organizationId: org.id,
          toEmail: org.owner.email,
          kind: "renewal_notice",
          dedupeKey: `${sub.providerRef}:renewal:${sub.currentPeriodEnd!.toISOString().slice(0, 10)}`,
          payload: {
            space: org.name,
            plan: sub.planKey,
            interval: "year",
            renewalAt: sub.currentPeriodEnd!.toISOString(),
            trialEnd: null,
            cancelAt: null,
            unpaid: false,
          },
        },
      ],
      skipDuplicates: true,
    });
    queued += created.count;
  }
  return queued;
};

// Rappel avant le premier prélèvement : la date d'essai est suivie à chaque rapprochement avec Stripe.
export const queueTrialReminders = async (now: Date = new Date()): Promise<number> => {
  const soon = new Date(now.getTime() + 3 * 86_400_000);
  const subscriptions = await prisma.subscription.findMany({
    where: { provider: "stripe", status: "trialing", cancelAt: null, trialEndsAt: { gt: now, lte: soon } },
    select: {
      providerRef: true,
      planKey: true,
      interval: true,
      trialEndsAt: true,
      organization: {
        select: { id: true, name: true, billingOwnerId: true, ownerId: true, owner: { select: { email: true } } },
      },
    },
  });
  let queued = 0;
  for (const sub of subscriptions) {
    const org = sub.organization;
    if (!sub.providerRef || (org.billingOwnerId && org.billingOwnerId !== org.ownerId)) continue;
    const created = await prisma.emailOutbox.createMany({
      data: [
        {
          organizationId: org.id,
          toEmail: org.owner.email,
          kind: "trial_ending",
          dedupeKey: `${sub.providerRef}:trial:${sub.trialEndsAt!.toISOString().slice(0, 10)}`,
          payload: {
            space: org.name,
            plan: sub.planKey,
            interval: sub.interval === "year" ? "year" : "month",
            trialEnd: sub.trialEndsAt!.toISOString(),
            cancelAt: null,
            unpaid: false,
          },
        },
      ],
      skipDuplicates: true,
    });
    queued += created.count;
  }
  return queued;
};

export const isEmailRelevant = async (
  row: { organizationId: string | null; kind: string; dedupeKey: string; payload: unknown; toEmail: string },
  now = new Date(),
) => {
  if (row.kind === "account_deleted") {
    const payload = row.payload as AccountPayload;
    // Une réinscription rendrait cette ancienne confirmation trompeuse.
    return !(await prisma.user.count({ where: { OR: [{ id: payload.userId }, { email: row.toEmail }] } }));
  }
  if (!row.organizationId) return false;
  const org = await prisma.organization.findUnique({
    where: { id: row.organizationId },
    include: { owner: { select: { email: true } } },
  });
  if (row.kind === "space_transferred") {
    const payload = row.payload as TransferPayload;
    return Boolean(org && org.ownerId === payload.userId && org.owner.email === row.toEmail);
  }
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
  if (row.kind === "payment_failed") {
    if (sub.status !== "past_due") return false;
    const actionRequired = await prisma.emailOutbox.count({
      where: {
        organizationId: org.id,
        kind: "payment_action_required",
        failedAt: null,
        createdAt: { gte: new Date(now.getTime() - INCIDENT_WINDOW_MS) },
      },
    });
    return actionRequired === 0;
  }
  if (row.kind === "payment_action_required") {
    const invoiceId = (row.payload as { invoiceId?: string }).invoiceId;
    const invoice = invoiceId
      ? await prisma.billingInvoice.findUnique({ where: { id: invoiceId }, select: { status: true } })
      : null;
    if (invoice?.status !== "open") return false;
    const alreadyTold = await prisma.emailOutbox.count({
      where: {
        organizationId: org.id,
        kind: "payment_failed",
        sentAt: { gte: new Date(now.getTime() - INCIDENT_WINDOW_MS) },
      },
    });
    return alreadyTold === 0;
  }
  if (row.kind === "recovered") return sub.status === "active";
  if (row.kind === "renewal_notice") return sub.status === "active" && !sub.cancelAt;
  if (row.kind === "trial_ending")
    return sub.status === "trialing" && Boolean(sub.trialEndsAt && sub.trialEndsAt > now);
  return row.kind === "ended" && sub.status === "canceled";
};
