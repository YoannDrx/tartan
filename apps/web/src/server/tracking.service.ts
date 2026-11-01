import { type CoachAlert, type RollCallInput, type TrackingGrid, sessionSnapshot } from "@tartan/contracts";
import {
  addDays,
  alertKinds,
  cellStatusOf,
  compareTrackingRows,
  completionPct,
  hasAutonomousVersion,
  startOfWeek,
  trailingMissedCount,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { audit, requireGroupInScope, requireOrgMember, visibleAthleteIds, type Access } from "./access";
import { activeInjuriesByAthlete } from "./athlete.service";
import { consentForAthletes } from "./consent.service";
import { firstNameOf } from "./me.service";
import { notify } from "./notify.service";
import { audienceAthleteIds } from "./session.service";

const scopedAthletes = async (access: Access, groupId?: string) => {
  const visible = await visibleAthleteIds(access);
  if (!groupId) return visible;
  await requireGroupInScope(access, [groupId]);
  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { athleteId: true } });
  const inGroup = new Set(members.map((r) => r.athleteId));
  return visible.filter((id) => inGroup.has(id));
};

export const getTrackingGrid = async (
  userId: string,
  organizationId: string,
  query: { week?: string; groupId?: string },
  now: Date = new Date(),
): Promise<TrackingGrid> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const weekStart = startOfWeek(query.week ?? todayIso(now));
  const athleteIds = await scopedAthletes(access, query.groupId);
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      groups: { select: { groupId: true, group: { select: { name: true } } } },
    },
  });
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      organizationId,
      publishedAt: { not: null },
      date: { gte: toDbDate(weekStart), lte: toDbDate(addDays(weekStart, 6)) },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      assignments: true,
      logs: {
        where: { athleteId: { in: athleteIds } },
        select: { athleteId: true, status: true, rpe: true, pain: true, variantDone: true },
      },
    },
  });
  const consents = await consentForAthletes(athleteIds);
  const healthIds = athleteIds.filter((id) => consents.get(id)?.health);
  const injuries = await activeInjuriesByAthlete(healthIds);

  const concerned = (s: (typeof sessions)[number], a: (typeof athletes)[number]): boolean =>
    s.assignments.some((t) =>
      t.targetType === "athlete" ? t.targetId === a.id : a.groups.some((g) => g.groupId === t.targetId),
    );
  const visibleSessions = sessions.filter((s) => athletes.some((a) => concerned(s, a)));

  const rows = athletes.map((a) => {
    const health = consents.get(a.id)?.health ?? false;
    const cells = visibleSessions.map((s) => {
      if (!concerned(s, a)) return { sessionId: s.id, status: null, rpe: null, hasPain: false, variant: null };
      const entry = s.logs.find((l) => l.athleteId === a.id) ?? null;
      return {
        sessionId: s.id,
        status: cellStatusOf(entry, fromDbDate(s.date), now),
        rpe: health ? (entry?.rpe ?? null) : null,
        hasPain: health && Boolean(entry?.pain),
        variant: entry?.variantDone ?? null,
      };
    });
    return {
      athleteId: a.id,
      name: `${a.firstName} ${a.lastName}`.trim(),
      initials: `${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase(),
      groupNames: a.groups.map((g) => g.group.name),
      activeInjury: injuries.get(a.id) ?? null,
      hasPain: cells.some((c) => c.hasPain),
      completionPct: completionPct(cells.map((c) => c.status)),
      cells,
    };
  });

  return {
    weekStart,
    sessions: visibleSessions.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      date: fromDbDate(s.date),
      startTime: s.startTime,
    })),
    rows: rows.sort((a, b) => compareTrackingRows({ ...a, name: a.name }, { ...b, name: b.name })),
  };
};

const PAIN_RECENT_DAYS = 7;

export const getAlerts = async (
  userId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<CoachAlert[]> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const athleteIds = await visibleAthleteIds(access);
  if (athleteIds.length === 0 || access.role === "athlete") return [];
  const since = addDays(todayIso(now), -21);
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds } },
    select: {
      id: true,
      firstName: true,
      groups: { select: { groupId: true } },
    },
  });
  const sessions = await prisma.scheduledSession.findMany({
    where: { organizationId, publishedAt: { not: null }, date: { gte: toDbDate(since), lte: toDbDate(todayIso(now)) } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      assignments: { select: { targetType: true, targetId: true } },
      logs: {
        where: { athleteId: { in: athleteIds } },
        select: { athleteId: true, status: true, rpe: true, pain: true, updatedAt: true },
      },
    },
  });
  const consents = await consentForAthletes(athleteIds);
  const injuries = await activeInjuriesByAthlete(athleteIds.filter((id) => consents.get(id)?.health));
  const alerts: CoachAlert[] = [];
  for (const a of athletes) {
    const mine = sessions.filter((s) =>
      s.assignments.some((t) =>
        t.targetType === "athlete" ? t.targetId === a.id : a.groups.some((g) => g.groupId === t.targetId),
      ),
    );
    const entries = mine.map((s) => ({
      date: fromDbDate(s.date),
      entry: s.logs.find((l) => l.athleteId === a.id) ?? null,
    }));
    const statuses = entries.map((e) => cellStatusOf(e.entry, e.date, now));
    const health = consents.get(a.id)?.health ?? false;
    const logged = entries.filter((e) => e.entry);
    const last = logged[logged.length - 1]?.entry ?? null;
    const painEntry = [...logged].reverse().find((e) => e.entry?.pain)?.entry ?? null;
    const painRecent = Boolean(
      painEntry && now.getTime() - painEntry.updatedAt.getTime() < PAIN_RECENT_DAYS * 86400 * 1000,
    );
    const pain = painEntry?.pain as { bodyArea?: keyof typeof m.bodyArea; side?: keyof typeof m.bodySide } | null;
    const kinds = alertKinds({
      recentStatuses: statuses,
      lastRpe: health ? (last?.rpe ?? null) : null,
      lastPain: health && painRecent ? { recent: true } : null,
      activeInjury: injuries.has(a.id),
    });
    for (const kind of kinds) {
      if (kind === "pain") {
        alerts.push({
          id: `${a.id}-pain`,
          kind,
          athleteId: a.id,
          athleteName: a.firstName,
          severity: "high",
          title: m.coach.alertPain(a.firstName),
          detail: pain?.bodyArea
            ? `${m.bodyArea[pain.bodyArea]}${pain.side && pain.side !== "none" ? ` ${m.bodySide[pain.side].toLowerCase()}` : ""}`
            : "",
        });
      } else if (kind === "missed_streak") {
        const count = trailingMissedCount(statuses);
        alerts.push({
          id: `${a.id}-missed`,
          kind,
          athleteId: a.id,
          athleteName: a.firstName,
          severity: "medium",
          title: m.coach.alertMissed(a.firstName, count),
          detail: "Aucune validation sur les dernières séances",
        });
      } else if (kind === "abnormal_rpe") {
        alerts.push({
          id: `${a.id}-rpe`,
          kind,
          athleteId: a.id,
          athleteName: a.firstName,
          severity: "medium",
          title: m.coach.alertRpe(a.firstName, last?.rpe ?? 0),
          detail: m.coach.loadDisclaimer,
        });
      } else {
        const area = injuries.get(a.id) as keyof typeof m.bodyArea | undefined;
        alerts.push({
          id: `${a.id}-injury`,
          kind,
          athleteId: a.id,
          athleteName: a.firstName,
          severity: "medium",
          title: m.coach.alertInjury(a.firstName),
          detail: area ? (m.bodyArea[area] ?? "") : "",
        });
      }
    }
  }
  const rank = { pain: 0, active_injury: 1, missed_streak: 2, abnormal_rpe: 3 };
  return alerts.sort((x, y) => rank[x.kind] - rank[y.kind]);
};

export const getSessionDetailForCoach = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  now: Date = new Date(),
) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const session = await prisma.scheduledSession.findFirst({ where: { id: sessionId, organizationId } });
  if (!session) throw notFound();
  const visible = new Set(await visibleAthleteIds(access));
  const audience = (await audienceAthleteIds(sessionId)).filter((id) => visible.has(id));
  const [athletes, logs, attendance] = await Promise.all([
    prisma.athlete.findMany({ where: { id: { in: audience } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.sessionLog.findMany({
      where: { scheduledSessionId: sessionId, athleteId: { in: audience } },
      include: { sets: true },
    }),
    prisma.attendance.findMany({ where: { scheduledSessionId: sessionId, athleteId: { in: audience } } }),
  ]);
  const consents = await consentForAthletes(audience);
  const date = fromDbDate(session.date);
  const snapshot = session.snapshot ? sessionSnapshot.parse(session.snapshot) : null;
  return {
    id: session.id,
    title: session.title,
    type: session.type,
    date,
    startTime: session.startTime,
    location: session.location,
    publishedAt: session.publishedAt?.toISOString() ?? null,
    hasAutonomous: snapshot ? hasAutonomousVersion(snapshot) : false,
    canEdit: access.role !== "assistant" || session.createdBy === userId,
    snapshot,
    athletes: athletes
      .map((a) => {
        const entry = logs.find((l) => l.athleteId === a.id) ?? null;
        const health = consents.get(a.id)?.health ?? false;
        return {
          athleteId: a.id,
          name: `${a.firstName} ${a.lastName}`.trim(),
          status: cellStatusOf(entry, date, now),
          attendance: attendance.find((t) => t.athleteId === a.id)?.status ?? ("unknown" as const),
          variant: entry?.variantDone ?? null,
          rpe: health ? (entry?.rpe ?? null) : null,
          durationMin: entry?.durationMin ?? null,
          comment: entry?.comment ?? null,
          pain: health ? ((entry?.pain as { bodyArea: string; side: string; intensity: number } | null) ?? null) : null,
          sets: (entry?.sets ?? []).map((s) => ({
            itemRef: s.itemRef,
            setIndex: s.setIndex,
            reps: s.reps,
            loadKg: s.loadKg === null ? null : Number(s.loadKg),
            done: s.done,
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  };
};

// Appel : les absents basculent en autonomie et sont prévenus ; sans version autonomie, on le signale au coach.
export const takeRollCall = async (userId: string, organizationId: string, sessionId: string, input: RollCallInput) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (access.role === "athlete") throw notFound();
  const session = await prisma.scheduledSession.findFirst({ where: { id: sessionId, organizationId } });
  if (!session?.snapshot) throw notFound();
  const visible = new Set(await visibleAthleteIds(access));
  const audience = new Set(await audienceAthleteIds(sessionId));
  const entries = input.entries.filter((e) => visible.has(e.athleteId) && audience.has(e.athleteId));
  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendance.upsert({
        where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: e.athleteId } },
        create: { scheduledSessionId: sessionId, athleteId: e.athleteId, status: e.status, source: "coach" },
        update: { status: e.status, source: "coach" },
      }),
    ),
  );
  const absentIds = entries.filter((e) => e.status === "absent").map((e) => e.athleteId);
  const hasAutonomous = hasAutonomousVersion(sessionSnapshot.parse(session.snapshot));
  if (absentIds.length && hasAutonomous) {
    const users = await prisma.athlete.findMany({
      where: { id: { in: absentIds }, userId: { not: null } },
      select: { userId: true },
    });
    await notify(
      users.map((u) => u.userId as string),
      "session_autonomous",
      { organizationId, sessionId, link: `/seance/${sessionId}` },
    );
  }
  return { absentCount: absentIds.length, hasAutonomous };
};

export const remindAthletes = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  athleteIds?: string[],
  now: Date = new Date(),
) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (access.role === "athlete") throw notFound();
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId, publishedAt: { not: null } },
  });
  if (!session) throw notFound();
  const visible = new Set(await visibleAthleteIds(access));
  const audience = (await audienceAthleteIds(sessionId)).filter((id) => visible.has(id));
  const logs = await prisma.sessionLog.findMany({
    where: { scheduledSessionId: sessionId, athleteId: { in: audience } },
    select: { athleteId: true, status: true },
  });
  const date = fromDbDate(session.date);
  const late = audience.filter((id) => {
    if (athleteIds && !athleteIds.includes(id)) return false;
    const status = cellStatusOf(
      logs.find((l) => l.athleteId === id),
      date,
      now,
    );
    return status === "missed" || status === "upcoming";
  });
  const users = await prisma.athlete.findMany({
    where: { id: { in: late }, userId: { not: null } },
    select: { userId: true },
  });
  await notify(
    users.map((u) => u.userId as string),
    "session_reminder",
    { coach: await firstNameOf(userId), organizationId, sessionId, link: `/seance/${sessionId}` },
    now,
  );
  await audit({
    organizationId,
    actorId: userId,
    action: "athletes_reminded",
    entity: "scheduled_session",
    entityId: sessionId,
  });
  return { count: users.length };
};
