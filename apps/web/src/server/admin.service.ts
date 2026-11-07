import { addDays } from "@tartan/domain";
import { todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { correctBirthDateInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { externalDeletionHealth } from "./external-deletion.service";
import { pilotMetrics } from "./metrics.service";
import { notificationDeliveryHealth } from "./notification-delivery.service";
import { isBillingEmailRelevant } from "./email-outbox.service";

// La console de l'éditeur : réservée aux adresses listées, jamais de donnée de santé ni de contenu d'entraînement.
export const isAdmin = (email: string): boolean =>
  env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());

export const requireAdmin = (email: string): void => {
  if (!isAdmin(email)) throw forbidden();
};

export const adminCorrectBirthDate = async (actor: { email: string; userId: string }, input: unknown) => {
  requireAdmin(actor.email);
  const parsed = correctBirthDateInput.safeParse(input);
  if (!parsed.success) throw invalid();
  const { userId, birthDate, reason } = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId}::uuid FOR UPDATE`;
    if (!(await tx.user.findUnique({ where: { id: userId }, select: { id: true } }))) throw notFound();
    await tx.profile.upsert({
      where: { id: userId },
      create: { id: userId, birthDate: toDbDate(birthDate) },
      update: { birthDate: toDbDate(birthDate) },
    });
    await tx.athlete.updateMany({ where: { userId }, data: { birthDate: toDbDate(birthDate) } });
    // Motif contrôlé, aucune date de naissance ni pièce d'identité dans le journal.
    await tx.auditLog.create({
      data: { actorId: actor.userId, action: `birth_date_corrected:${reason}`, entity: "profile", entityId: userId },
    });
  });
};

export const adminRetryEmail = async (actor: { email: string; userId: string }, id: string) => {
  requireAdmin(actor.email);
  const row = await prisma.emailOutbox.findUnique({ where: { id } });
  if (!row || row.sentAt || !row.failedAt) throw notFound();
  if (!(await isBillingEmailRelevant(row))) throw invalid(m.admin.obsoleteEmail);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const changed = await tx.emailOutbox.updateMany({
      where: { id, sentAt: null, failedAt: row.failedAt },
      data: {
        failedAt: null,
        failureCode: null,
        nextAttemptAt: now,
        retryUntil: new Date(now.getTime() + 24 * 3600_000),
      },
    });
    if (!changed.count) throw invalid();
    await tx.auditLog.create({
      data: { actorId: actor.userId, action: "email_retry_requested", entity: "email_outbox", entityId: id },
    });
  });
};

export const adminOverview = async (actor: { email: string }, now: Date = new Date()) => {
  requireAdmin(actor.email);
  const weekAgo = toDbDate(addDays(todayIso(now), -7));
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      plan: true,
      createdAt: true,
      owner: { select: { email: true } },
      _count: { select: { athletes: true, members: true, videos: true } },
    },
  });
  const spaces = await Promise.all(
    orgs.map(async (org) => {
      const [metrics, sessionsThisWeek, openReports] = await Promise.all([
        pilotMetrics(org.id, now),
        prisma.scheduledSession.count({
          where: { organizationId: org.id, publishedAt: { not: null }, date: { gte: weekAgo } },
        }),
        prisma.contentReport.count({ where: { organizationId: org.id, resolvedAt: null } }),
      ]);
      return {
        id: org.id,
        name: org.name,
        plan: org.plan,
        ownerEmail: org.owner.email,
        createdAt: org.createdAt.toISOString(),
        athletes: org._count.athletes,
        videos: org._count.videos,
        sessionsThisWeek,
        openReports,
        metrics,
      };
    }),
  );
  const [answers, recentComments] = await Promise.all([
    prisma.satisfactionAnswer.groupBy({ by: ["recommend"], _count: { _all: true } }),
    prisma.satisfactionAnswer.findMany({
      where: { comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, recommend: true, comment: true, createdAt: true },
    }),
  ]);
  const count = (recommend: boolean) => answers.find((a) => a.recommend === recommend)?._count._all ?? 0;
  const plans = spaces.reduce<Record<string, number>>((all, s) => ({ ...all, [s.plan]: (all[s.plan] ?? 0) + 1 }), {});
  return {
    spaces,
    plans,
    notificationDelivery: await notificationDeliveryHealth(now),
    externalDeletions: await externalDeletionHealth(now),
    billingIssues: await prisma.organization.findMany({
      where: { billingIssue: { not: null } },
      select: { id: true, name: true, billingIssue: true },
    }),
    billingCommands: await prisma.billingCommand.count({ where: { state: "pending" } }),
    checkoutReviews: await prisma.checkoutIntent.count({ where: { state: "review" } }),
    checkoutReviewItems: await prisma.checkoutIntent.findMany({
      where: { state: "review" },
      select: { id: true, organizationId: true, generation: true, sessionId: true, attemptedAt: true },
      take: 50,
      orderBy: { attemptedAt: "asc" },
    }),
    pendingBillingCommands: await prisma.billingCommand.findMany({
      where: { state: "pending" },
      select: { id: true, organizationId: true, kind: true, externalRef: true, attempts: true, lastErrorCode: true },
      take: 50,
      orderBy: { createdAt: "asc" },
    }),
    retentionReviews: await prisma.organization.findMany({
      where: { retentionReviewAt: { not: null } },
      select: { id: true, name: true, retentionReviewAt: true },
      orderBy: { retentionReviewAt: "asc" },
    }),
    failedEmailCount: await prisma.emailOutbox.count({ where: { sentAt: null, failedAt: { not: null } } }),
    failedEmails: await prisma.emailOutbox.findMany({
      where: { sentAt: null, failedAt: { not: null } },
      select: { id: true, kind: true, failureCode: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    users: await prisma.user.count(),
    satisfaction: {
      yes: count(true),
      no: count(false),
      comments: recentComments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    },
  };
};
