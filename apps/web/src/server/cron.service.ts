import { addDays, isOverdue } from "@tartan/domain";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { dispatchPending, notify } from "./notify.service";
import { audienceAthleteIds, publishRow } from "./session.service";

// Passe en « manquée » les séances non validées 24 h après la date prévue, avec une relance douce.
export const closeOverdueSessions = async (now: Date = new Date()): Promise<number> => {
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      publishedAt: { not: null },
      date: { gte: toDbDate(addDays(todayIso(now), -14)), lt: toDbDate(todayIso(now)) },
    },
    select: { id: true, date: true, organizationId: true, organization: { select: { overdueReminders: true } } },
  });
  let closed = 0;
  for (const session of sessions) {
    const date = fromDbDate(session.date);
    if (!isOverdue(date, now)) continue;
    const audience = await audienceAthleteIds(session.id);
    const logged = await prisma.sessionLog.findMany({
      where: { scheduledSessionId: session.id, athleteId: { in: audience } },
      select: { athleteId: true },
    });
    const missing = audience.filter((id) => !logged.some((l) => l.athleteId === id));
    if (missing.length === 0) continue;
    await prisma.sessionLog.createMany({
      data: missing.map((athleteId) => ({
        scheduledSessionId: session.id,
        athleteId,
        status: "missed" as const,
        reminderSentAt: now,
      })),
      skipDuplicates: true,
    });
    closed += missing.length;
    if (!session.organization.overdueReminders) continue;
    const users = await prisma.athlete.findMany({
      where: { id: { in: missing }, userId: { not: null } },
      select: { userId: true },
    });
    await notify(
      users.map((u) => u.userId as string),
      "session_reminder",
      { organizationId: session.organizationId, sessionId: session.id, link: `/seance/${session.id}` },
      now,
    );
  }
  log.info("cron_close_overdue", { count: closed });
  return closed;
};

export const publishScheduledSessions = async (now: Date = new Date()): Promise<number> => {
  const due = await prisma.scheduledSession.findMany({
    where: { publishedAt: null, publishAt: { lte: now } },
    select: { id: true, createdBy: true },
  });
  for (const session of due) await publishRow(session.id, session.createdBy, now);
  return due.length;
};

// « Seras-tu au club demain ? » la veille d'une séance, une seule fois par séance.
export const sendEveQuestions = async (now: Date = new Date()): Promise<number> => {
  const tomorrow = addDays(todayIso(now), 1);
  const sessions = await prisma.scheduledSession.findMany({
    where: { publishedAt: { not: null }, date: toDbDate(tomorrow) },
    select: { id: true, organizationId: true },
  });
  let sent = 0;
  for (const session of sessions) {
    const audience = await audienceAthleteIds(session.id);
    const athletes = await prisma.athlete.findMany({
      where: { id: { in: audience }, userId: { not: null }, attendance: { none: { scheduledSessionId: session.id } } },
      select: { userId: true },
    });
    const users = athletes.map((a) => a.userId as string);
    const already = await prisma.notification.findMany({
      where: { userId: { in: users }, type: "session_eve", payload: { path: ["sessionId"], equals: session.id } },
      select: { userId: true },
    });
    const remaining = users.filter((u) => !already.some((n) => n.userId === u));
    await notify(
      remaining,
      "session_eve",
      { organizationId: session.organizationId, sessionId: session.id, link: `/seance/${session.id}` },
      now,
    );
    sent += remaining.length;
  }
  return sent;
};

export const runHourlyJobs = async (now: Date = new Date()) => {
  const published = await publishScheduledSessions(now);
  const closed = await closeOverdueSessions(now);
  const eve = await sendEveQuestions(now);
  const dispatched = await dispatchPending(now);
  return { published, closed, eve, dispatched };
};
