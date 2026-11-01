import { isOverdue } from "@tartan/domain";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { addDays } from "@tartan/domain";
import { prisma } from "@/lib/prisma";
import { audienceAthleteIds } from "./session.service";

export type PilotMetrics = {
  validationRatePct: number | null;
  medianValidationHours: number | null;
  activeAthletesPct: number | null;
  activationPct: number | null;
  sharedVideosLast7Days: number;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

const pct = (part: number, total: number): number | null => (total === 0 ? null : Math.round((part / total) * 100));

// Indicateurs de réussite du pilote (§ 18), calculés côté serveur et sans donnée de santé.
export const pilotMetrics = async (organizationId: string, now: Date = new Date()): Promise<PilotMetrics> => {
  const sessions = await prisma.scheduledSession.findMany({
    where: { organizationId, publishedAt: { not: null }, date: { lte: toDbDate(todayIso(now)) } },
    select: { id: true, date: true, logs: { select: { athleteId: true, status: true, completedAt: true } } },
  });
  let due = 0;
  let validated = 0;
  const delays: number[] = [];
  for (const session of sessions) {
    const date = fromDbDate(session.date);
    const audience = await audienceAthleteIds(session.id);
    if (isOverdue(date, now)) due += audience.length;
    for (const entry of session.logs) {
      if (entry.status !== "done" && entry.status !== "partial") continue;
      if (isOverdue(date, now)) validated += 1;
      if (entry.completedAt) {
        delays.push(Math.max(0, (entry.completedAt.getTime() - session.date.getTime()) / 3600000));
      }
    }
  }
  const athletes = await prisma.athlete.findMany({
    where: { organizationId },
    select: { id: true, createdAt: true, userId: true },
  });
  const weekAgo = toDbDate(addDays(todayIso(now), -7));
  const activeLogs = await prisma.sessionLog.findMany({
    where: {
      athleteId: { in: athletes.map((a) => a.id) },
      status: { in: ["done", "partial"] },
      updatedAt: { gte: weekAgo },
    },
    select: { athleteId: true },
    distinct: ["athleteId"],
  });
  const firstLogs = await prisma.sessionLog.groupBy({
    by: ["athleteId"],
    where: { athleteId: { in: athletes.map((a) => a.id) }, status: { in: ["done", "partial"] } },
    _min: { updatedAt: true },
  });
  const activated = athletes.filter((a) => {
    const first = firstLogs.find((l) => l.athleteId === a.id)?._min.updatedAt;
    return first && first.getTime() - a.createdAt.getTime() <= 7 * 86400 * 1000;
  }).length;
  const sharedVideos = await prisma.video.count({
    where: { organizationId, sharedWithAthlete: true, updatedAt: { gte: weekAgo } },
  });
  return {
    validationRatePct: pct(validated, due),
    medianValidationHours: median(delays),
    activeAthletesPct: pct(activeLogs.length, athletes.length),
    activationPct: pct(activated, athletes.length),
    sharedVideosLast7Days: sharedVideos,
  };
};
