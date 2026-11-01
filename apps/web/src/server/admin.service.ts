import { addDays } from "@tartan/domain";
import { todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { pilotMetrics } from "./metrics.service";

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
    users: await prisma.user.count(),
    satisfaction: {
      yes: count(true),
      no: count(false),
      comments: recentComments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    },
  };
};
