import { addDays, churnPercent, summarizeRevenue, type PlanKey } from "@tartan/domain";
import { auth } from "@/lib/auth";
import { todayIso, toDbDate } from "@/lib/dates";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { billingEnabled, stripe } from "@/lib/stripe";
import { deleteAccount } from "./account.service";
import { requireAdmin } from "./admin.service";
import { applySubscription } from "./subscription-state.service";
import { confirmStoreAvailability, setMinimumVersion, stopRollout } from "./releases.service";

type Admin = { email: string; userId: string };
const PAGE = 50;

const audit = (
  actor: Admin,
  action: string,
  entity: string,
  entityId: string | null,
  organizationId?: string | null,
  metadata?: Record<string, string | number | boolean>,
) =>
  prisma.auditLog.create({
    data: { actorId: actor.userId, action, entity, entityId, organizationId: organizationId ?? null, metadata },
  });

const page = <T extends { id: string }>(rows: T[]) => ({
  items: rows.slice(0, PAGE),
  nextCursor: rows.length > PAGE ? (rows[PAGE - 1]?.id ?? null) : null,
});

const cursorArgs = (cursor?: string): { cursor?: { id: string }; skip?: number } =>
  cursor ? { cursor: { id: cursor }, skip: 1 } : {};

export const revenueOverview = async (actor: Admin, now: Date = new Date()) => {
  requireAdmin(actor.email);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [subscriptions, year, month, refundedMonth, history, trialsStarted, trialsConverted] = await Promise.all([
    prisma.subscription.findMany({
      where: { provider: { in: ["stripe", "revenuecat"] }, status: { not: "canceled" } },
      select: { status: true, listMrrCents: true, discountedMrrCents: true, discountEndsAt: true },
    }),
    prisma.billingInvoice.aggregate({
      where: { paidAt: { gte: yearStart }, livemode: true },
      _sum: { amountPaidCents: true, refundedCents: true },
    }),
    prisma.billingInvoice.aggregate({ where: { paidAt: { gte: monthStart }, livemode: true }, _sum: { amountPaidCents: true } }),
    prisma.billingRefund.aggregate({
      where: { state: "succeeded", completedAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.platformDailyStat.findMany({ orderBy: { day: "desc" }, take: 180 }),
    prisma.subscription.count({ where: { trialEndsAt: { not: null } } }),
    prisma.subscription.count({ where: { trialEndsAt: { not: null, lt: now }, status: "active" } }),
  ]);
  const revenue = summarizeRevenue(subscriptions, now);
  const canceledThisMonth = await prisma.subscription.count({ where: { canceledAt: { gte: monthStart } } });
  const startOfMonth = history.find((row) => row.day <= monthStart);
  return {
    ...revenue,
    yearRevenueCents: (year._sum.amountPaidCents ?? 0) - (year._sum.refundedCents ?? 0),
    monthRevenueCents: month._sum.amountPaidCents ?? 0,
    monthRefundedCents: refundedMonth._sum.amountCents ?? 0,
    churnPercent: churnPercent(startOfMonth?.payingOrgs ?? 0, canceledThisMonth),
    conversionPercent: trialsStarted > 0 ? Math.round((trialsConverted / trialsStarted) * 100) : null,
    trialsStarted,
    history: [...history].reverse().map((row) => ({ day: todayIso(row.day), mrrCents: row.mrrCents, paying: row.payingOrgs })),
  };
};

export const accountingCsv = async (actor: Admin, year: number) => {
  requireAdmin(actor.email);
  const invoices = await prisma.billingInvoice.findMany({
    where: { paidAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }, livemode: true },
    orderBy: { paidAt: "asc" },
  });
  const header = "numero;date;total_centimes;encaisse_centimes;taxes_centimes;rembourse_centimes;devise";
  const rows = invoices.map((row) =>
    [
      row.number ?? row.id,
      row.paidAt?.toISOString().slice(0, 10) ?? "",
      row.totalCents,
      row.amountPaidCents,
      row.taxCents,
      row.refundedCents,
      row.currency,
    ].join(";"),
  );
  return [header, ...rows].join("\n");
};

export const searchUsers = async (actor: Admin, query: { q?: string; cursor?: string }) => {
  requireAdmin(actor.email);
  const q = query.q?.trim();
  const rows = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...cursorArgs(query.cursor),
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      suspendedAt: true,
      profile: { select: { lastActiveAt: true } },
      _count: { select: { sessions: true } },
    },
  });
  return page(rows);
};

// Fiche support : identité, rôles et appareils. Jamais de santé, de notes privées ni de contenu d'entraînement.
export const userCard = async (actor: Admin, userId: string) => {
  requireAdmin(actor.email);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      suspendedAt: true,
      profile: { select: { lastActiveAt: true } },
      memberships: {
        select: { role: true, status: true, organization: { select: { id: true, name: true, plan: true } } },
      },
      devices: { select: { platform: true, appVersion: true, lastSeenAt: true } },
      clientInstallations: {
        orderBy: { lastSeenAt: "desc" },
        take: 10,
        select: { platform: true, appVersion: true, lastSeenAt: true },
      },
    },
  });
  if (!user) throw notFound();
  return user;
};

export const adminResendVerification = async (actor: Admin, userId: string) => {
  requireAdmin(actor.email);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw notFound();
  await auth.api.sendVerificationEmail({ body: { email: user.email } });
  await audit(actor, "verification_resent", "user", userId);
};

export const adminSetSuspended = async (actor: Admin, userId: string, suspended: boolean, now: Date = new Date()) => {
  requireAdmin(actor.email);
  if (userId === actor.userId) throw forbidden();
  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({ where: { id: userId }, data: { suspendedAt: suspended ? now : null } });
    if (!changed.count) throw notFound();
    // Une suspension coupe aussi les sessions déjà ouvertes.
    if (suspended) await tx.session.deleteMany({ where: { userId } });
  });
  await audit(actor, suspended ? "user_suspended" : "user_restored", "user", userId);
};

export const adminDeleteUser = async (actor: Admin, userId: string) => {
  requireAdmin(actor.email);
  if (userId === actor.userId) throw forbidden();
  await audit(actor, "user_deletion_requested", "user", userId);
  await deleteAccount(userId);
};

export const listSpaces = async (actor: Admin, query: { q?: string; cursor?: string }) => {
  requireAdmin(actor.email);
  const q = query.q?.trim();
  const rows = await prisma.organization.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...cursorArgs(query.cursor),
    select: {
      id: true,
      name: true,
      plan: true,
      createdAt: true,
      owner: { select: { email: true } },
      _count: { select: { athletes: true, members: true, videos: true } },
    },
  });
  return page(rows);
};

export const spaceCard = async (actor: Admin, organizationId: string) => {
  requireAdmin(actor.email);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      plan: true,
      createdAt: true,
      billingIssue: true,
      stripeCustomerId: true,
      progressionEnabled: true,
      phasesEnabled: true,
      aiPlannerEnabled: true,
      owner: { select: { id: true, email: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          planKey: true,
          status: true,
          provider: true,
          providerRef: true,
          currentPeriodEnd: true,
          cancelAt: true,
          trialEndsAt: true,
        },
      },
      _count: { select: { athletes: true, members: true, videos: true, groups: true } },
    },
  });
  if (!org) throw notFound();
  return org;
};

// Offre accordée à la main : refusée tant qu'un abonnement payant est en cours chez un prestataire.
export const adminGrantPlan = async (actor: Admin, organizationId: string, plan: PlanKey) => {
  requireAdmin(actor.email);
  const current = await prisma.subscription.findFirst({
    where: { organizationId, provider: { in: ["stripe", "revenuecat"] }, status: { not: "canceled" } },
    select: { id: true },
  });
  if (current) throw invalid();
  await applySubscription({
    organizationId,
    plan,
    status: "active",
    provider: "manual",
    providerRef: null,
    currentPeriodEnd: null,
    cancelAt: null,
  });
  await audit(actor, "plan_granted", "organization", organizationId, organizationId, { plan });
};

const stripeSubscriptionOf = async (subscriptionId: string) => {
  if (!billingEnabled()) throw invalid();
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.provider !== "stripe" || !subscription.providerRef) throw notFound();
  return subscription as typeof subscription & { providerRef: string };
};

export const adminCancelAtPeriodEnd = async (actor: Admin, subscriptionId: string) => {
  requireAdmin(actor.email);
  const subscription = await stripeSubscriptionOf(subscriptionId);
  await stripe().subscriptions.update(subscription.providerRef, { cancel_at_period_end: true });
  await audit(actor, "subscription_cancel_at_period_end", "subscription", subscription.id, subscription.organizationId);
};

export const adminExtendTrial = async (actor: Admin, subscriptionId: string, days: number, now: Date = new Date()) => {
  requireAdmin(actor.email);
  if (!Number.isInteger(days) || days < 1 || days > 60) throw invalid();
  const subscription = await stripeSubscriptionOf(subscriptionId);
  const from = subscription.trialEndsAt && subscription.trialEndsAt > now ? subscription.trialEndsAt : now;
  await stripe().subscriptions.update(subscription.providerRef, {
    trial_end: Math.floor(from.getTime() / 1000) + days * 86_400,
    proration_behavior: "none",
  });
  await audit(actor, "trial_extended", "subscription", subscription.id, subscription.organizationId, { days });
};

export const listSubscriptions = async (actor: Admin, query: { status?: string; cursor?: string }) => {
  requireAdmin(actor.email);
  const rows = await prisma.subscription.findMany({
    where: {
      provider: { in: ["stripe", "revenuecat"] },
      ...(query.status ? { status: query.status as "active" } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...cursorArgs(query.cursor),
    select: {
      id: true,
      planKey: true,
      status: true,
      provider: true,
      interval: true,
      listMrrCents: true,
      discountedMrrCents: true,
      currentPeriodEnd: true,
      cancelAt: true,
      trialEndsAt: true,
      startedAt: true,
      organization: { select: { id: true, name: true } },
    },
  });
  return page(rows);
};

export const listInvoices = async (actor: Admin, query: { cursor?: string }) => {
  requireAdmin(actor.email);
  const rows = await prisma.billingInvoice.findMany({
    orderBy: [{ stripeCreatedAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...cursorArgs(query.cursor),
  });
  const organizationIds = [...new Set(rows.flatMap((row) => (row.organizationId ? [row.organizationId] : [])))];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: organizationIds } },
    select: { id: true, name: true },
  });
  const names = new Map(orgs.map((org) => [org.id, org.name]));
  return page(rows.map((row) => ({ ...row, space: row.organizationId ? (names.get(row.organizationId) ?? null) : null })));
};

export const invoiceCard = async (actor: Admin, invoiceId: string) => {
  requireAdmin(actor.email);
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw notFound();
  const [subscription, remote] = await Promise.all([
    invoice.organizationId
      ? prisma.subscription.findFirst({
          where: { organizationId: invoice.organizationId, provider: "stripe" },
          orderBy: { createdAt: "desc" },
          select: { startedAt: true, trialEndsAt: true },
        })
      : null,
    billingEnabled() ? stripe().invoices.retrieve(invoiceId).catch(() => null) : null,
  ]);
  return { invoice, subscription, pdfUrl: remote?.invoice_pdf ?? null };
};

export const listDisputes = async (actor: Admin) => {
  requireAdmin(actor.email);
  return prisma.billingDispute.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
};

export const usageOverview = async (actor: Admin, now: Date = new Date()) => {
  requireAdmin(actor.email);
  const days = (count: number) => new Date(now.getTime() - count * 86_400_000);
  const weekAgoDate = toDbDate(addDays(todayIso(now), -7));
  const [
    users,
    active7,
    active30,
    spaces,
    paidSpaces,
    publishedWeek,
    validatedWeek,
    videos,
    aiOperations,
    withSession,
    withAthlete,
    withLog,
    versions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count({ where: { lastActiveAt: { gte: days(7) } } }),
    prisma.profile.count({ where: { lastActiveAt: { gte: days(30) } } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { plan: { in: ["coach", "club"] } } }),
    prisma.scheduledSession.count({ where: { publishedAt: { not: null }, date: { gte: weekAgoDate } } }),
    prisma.sessionLog.count({ where: { status: { in: ["done", "partial"] }, createdAt: { gte: days(7) } } }),
    prisma.video.count(),
    prisma.aiPlannerOperation.count({ where: { createdAt: { gte: days(30) } } }),
    prisma.organization.count({ where: { scheduledSessions: { some: { publishedAt: { not: null } } } } }),
    prisma.organization.count({ where: { athletes: { some: {} } } }),
    prisma.organization.count({ where: { scheduledSessions: { some: { logs: { some: {} } } } } }),
    prisma.clientInstallation.groupBy({
      by: ["platform", "appVersion"],
      where: { lastSeenAt: { gte: days(30) } },
      _count: { _all: true },
      orderBy: [{ platform: "asc" }, { appVersion: "desc" }],
    }),
  ]);
  return {
    users,
    active7,
    active30,
    spaces,
    paidSpaces,
    publishedWeek,
    validatedWeek,
    videos,
    aiOperations,
    funnel: { spaces, withAthlete, withSession, withLog, paidSpaces },
    versions: versions.map((row) => ({ platform: row.platform, version: row.appVersion, count: row._count._all })),
  };
};

export const releasesConsole = async (actor: Admin) => {
  requireAdmin(actor.email);
  const [targets, configs, devices] = await Promise.all([
    prisma.appReleaseTarget.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.appPlatformConfig.findMany(),
    prisma.device.groupBy({
      by: ["platform", "appVersion"],
      where: { platform: { in: ["ios", "android"] } },
      _count: { _all: true },
    }),
  ]);
  return {
    targets,
    configs,
    devices: devices.map((row) => ({ platform: row.platform, version: row.appVersion, count: row._count._all })),
  };
};

export const adminConfirmStore = async (actor: Admin, targetId: string) => {
  requireAdmin(actor.email);
  await confirmStoreAvailability(targetId);
  await audit(actor, "store_availability_confirmed", "app_release_target", targetId);
};

export const adminStopRollout = async (actor: Admin, targetId: string) => {
  requireAdmin(actor.email);
  await stopRollout(targetId);
  await audit(actor, "rollout_stopped", "app_release_target", targetId);
};

export const adminSetMinimumVersion = async (
  actor: Admin,
  input: { platform: "ios" | "android"; minimumVersion: string | null; reason: string | null },
) => {
  requireAdmin(actor.email);
  const accepted = await setMinimumVersion(input.platform, input.minimumVersion, input.reason, actor.userId);
  if (!accepted) throw invalid();
  await audit(actor, "minimum_version_set", "platform", input.platform, null, {
    version: input.minimumVersion ?? "none",
  });
};

export const auditTrail = async (actor: Admin, query: { action?: string; cursor?: string }) => {
  requireAdmin(actor.email);
  const rows = await prisma.auditLog.findMany({
    where: query.action ? { action: { contains: query.action, mode: "insensitive" } } : {},
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...cursorArgs(query.cursor),
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      actorId: true,
      organizationId: true,
      metadata: true,
      at: true,
    },
  });
  return page(rows);
};

// Photo quotidienne : l'historique de revenu commence ici, sans reconstitution du passé.
export const snapshotPlatformDay = async (now: Date = new Date()): Promise<void> => {
  const day = toDbDate(todayIso(now));
  const [subscriptions, users, active7, canceled, newPaid, refunded] = await Promise.all([
    prisma.subscription.findMany({
      where: { provider: { in: ["stripe", "revenuecat"] }, status: { not: "canceled" } },
      select: { status: true, listMrrCents: true, discountedMrrCents: true, discountEndsAt: true },
    }),
    prisma.user.count(),
    prisma.profile.count({ where: { lastActiveAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
    prisma.subscription.count({ where: { status: "canceled" } }),
    prisma.subscription.count({ where: { startedAt: { gte: day } } }),
    prisma.billingRefund.aggregate({ where: { state: "succeeded", completedAt: { gte: day } }, _sum: { amountCents: true } }),
  ]);
  const revenue = summarizeRevenue(subscriptions, now);
  const data = {
    mrrCents: revenue.mrrCents,
    payingOrgs: revenue.paying,
    trialing: revenue.trialing,
    pastDue: revenue.pastDue,
    canceled,
    newPaid,
    users,
    activeUsers7d: active7,
    refundedCents: refunded._sum.amountCents ?? 0,
  };
  await prisma.platformDailyStat.upsert({ where: { day }, create: { day, ...data }, update: data });
};
