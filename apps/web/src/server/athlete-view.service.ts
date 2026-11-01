import {
  type AthleteSessionCard,
  type AthleteSessionDetail,
  type AthleteToday,
  type AttendanceStatus,
  type SessionLogInput,
  sessionLogInput,
  type SessionSnapshot,
  sessionSnapshot,
} from "@tartan/contracts";
import {
  addDays,
  applyOverride,
  blocksForVariant,
  cellStatusOf,
  exerciseCount,
  formatPrescription,
  hasAutonomousVersion,
  resolveLoadKg,
  resolveVariant,
  startOfWeek,
  type StrengthTest,
  weekDays,
} from "@tartan/domain";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { signedPlayback } from "@/lib/mux";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireAthleteAccess } from "./access";
import { consentForAthletes } from "./consent.service";
import { displayName, firstNameOf, namesFor } from "./me.service";
import { notify } from "./notify.service";
import { coachesOfAthlete } from "./org.service";

const assignedWhere = async (athleteId: string) => {
  const groups = await prisma.groupMember.findMany({ where: { athleteId }, select: { groupId: true } });
  return {
    publishedAt: { not: null },
    assignments: {
      some: {
        OR: [
          { targetType: "athlete" as const, targetId: athleteId },
          { targetType: "group" as const, targetId: { in: groups.map((g) => g.groupId) } },
        ],
      },
    },
  };
};

const loadTests = async (athleteId: string): Promise<StrengthTest[]> => {
  const rows = await prisma.strengthTest.findMany({ where: { athleteId } });
  return rows.map((t) => ({
    exerciseKey: t.exerciseKey,
    value: Number(t.value),
    kind: t.kind,
    date: fromDbDate(t.date),
  }));
};

type SessionRow = {
  id: string;
  date: Date;
  startTime: string | null;
  location: string | null;
  createdBy: string;
  snapshot: unknown;
};

const toCard = (
  session: SessionRow,
  snapshot: SessionSnapshot,
  attendance: AttendanceStatus,
  log: { status: "done" | "partial" | "missed" | "skipped"; variantDone: "club" | "autonomous" | null } | null,
  coachName: string | null,
  now: Date,
): AthleteSessionCard => {
  const date = fromDbDate(session.date);
  const variant = log?.variantDone ?? resolveVariant(attendance, snapshot);
  return {
    id: session.id,
    title: snapshot.title,
    type: snapshot.type,
    date,
    startTime: session.startTime,
    location: session.location,
    coachName,
    coachNote: snapshot.coachNote,
    durationMin: snapshot.durationMin,
    exerciseCount: exerciseCount(snapshot.blocks, variant),
    variant,
    hasAutonomous: hasAutonomousVersion(snapshot),
    status: cellStatusOf(log, date, now),
    attendance,
  };
};

const fetchCards = async (athleteId: string, from: string, to: string, now: Date): Promise<AthleteSessionCard[]> => {
  const sessions = await prisma.scheduledSession.findMany({
    where: { ...(await assignedWhere(athleteId)), date: { gte: toDbDate(from), lte: toDbDate(to) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      location: true,
      createdBy: true,
      snapshot: true,
      attendance: { where: { athleteId }, select: { status: true } },
      logs: { where: { athleteId }, select: { status: true, variantDone: true } },
    },
  });
  const coaches = await namesFor(sessions.map((s) => s.createdBy));
  return sessions.map((s) =>
    toCard(
      s,
      sessionSnapshot.parse(s.snapshot),
      s.attendance[0]?.status ?? "unknown",
      s.logs[0] ?? null,
      coaches.get(s.createdBy) ?? null,
      now,
    ),
  );
};

export const getAthleteToday = async (
  userId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<AthleteToday> => {
  const access = await requireAthleteAccess(userId, organizationId);
  const today = todayIso(now);
  const monday = startOfWeek(today);
  const cards = await fetchCards(access.athleteId, monday, addDays(monday, 13), now);
  const todays = cards.filter((c) => c.date === today);
  const next = cards.find((c) => c.date > today) ?? null;
  const weekDots = weekDays(monday).map((date) => {
    const day = cards.filter((c) => c.date === date);
    const status = (() => {
      if (day.length === 0) return "rest" as const;
      if (day.every((c) => c.status === "done")) return "done" as const;
      if (date === today) return "today" as const;
      if (day.some((c) => c.status === "partial")) return "partial" as const;
      if (day.some((c) => c.status === "missed")) return "missed" as const;
      return "planned" as const;
    })();
    return { date, status };
  });
  const groups = await prisma.groupMember.findMany({
    where: { athleteId: access.athleteId },
    select: { groupId: true },
  });
  const pinned = await prisma.announcement.findFirst({
    where: { organizationId, pinned: true, groupId: { in: groups.map((g) => g.groupId) } },
    orderBy: { createdAt: "desc" },
  });
  const authors = pinned ? await namesFor([pinned.authorId]) : new Map<string, string>();
  const consent = (await consentForAthletes([access.athleteId])).get(access.athleteId);
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { firstName: true } });
  return {
    firstName: profile?.firstName ?? null,
    today: todays,
    next,
    week: weekDots,
    pinnedAnnouncement: pinned
      ? { id: pinned.id, body: pinned.body, authorName: authors.get(pinned.authorId) ?? null }
      : null,
    healthConsent: consent?.health ?? false,
    videoConsent: consent?.video ?? false,
    parentalConsentPending: consent?.parentalPending ?? false,
  };
};

export const getAthleteCalendar = async (
  userId: string,
  organizationId: string,
  query: { from: string; to: string },
  now: Date = new Date(),
) => {
  const access = await requireAthleteAccess(userId, organizationId);
  const [sessions, competitions] = await Promise.all([
    fetchCards(access.athleteId, query.from, query.to, now),
    prisma.competition.findMany({
      where: {
        organizationId,
        date: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
        athletes: { some: { athleteId: access.athleteId } },
      },
      orderBy: { date: "asc" },
      select: { id: true, name: true, date: true, location: true },
    }),
  ]);
  return { sessions, competitions: competitions.map((c) => ({ ...c, date: fromDbDate(c.date) })) };
};

export const getAthleteSession = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<AthleteSessionDetail> => {
  const access = await requireAthleteAccess(userId, organizationId);
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId)) },
    select: {
      id: true,
      date: true,
      startTime: true,
      location: true,
      createdBy: true,
      snapshot: true,
      attendance: { where: { athleteId: access.athleteId }, select: { status: true } },
      logs: {
        where: { athleteId: access.athleteId },
        select: { status: true, variantDone: true, rpe: true, durationMin: true, comment: true },
      },
      overrides: { where: { athleteId: access.athleteId }, select: { itemRef: true, prescription: true } },
    },
  });
  if (!session) throw notFound();
  const snapshot = sessionSnapshot.parse(session.snapshot);
  const coaches = await namesFor([session.createdBy]);
  const log = session.logs[0] ?? null;
  const card = toCard(
    session,
    snapshot,
    session.attendance[0]?.status ?? "unknown",
    log,
    coaches.get(session.createdBy) ?? null,
    now,
  );
  const tests = await loadTests(access.athleteId);
  const overrides = new Map(session.overrides.map((o) => [o.itemRef, o.prescription as object]));
  // Les vidéos du coach sont privées : lecture par jeton signé, à durée limitée (§ 11.4).
  const withStream = async (media: SessionSnapshot["blocks"][number]["items"][number]["media"]) => {
    if (media?.kind === "upload" && media.muxPlaybackId && env().MUX_SIGNING_KEY_ID) {
      const { hlsUrl, mp4Url } = await signedPlayback(media.muxPlaybackId);
      return { ...media, streamUrl: mp4Url, hlsUrl };
    }
    return media;
  };
  const blocks = await Promise.all(
    blocksForVariant(snapshot.blocks, card.variant).map(async (block) => ({
      ...block,
      items: await Promise.all(block.items.map(async (item) => ({ ...item, media: await withStream(item.media) }))),
    })),
  );
  return {
    ...card,
    blocks: blocks.map((block) => ({
      ref: block.ref,
      name: block.name,
      variant: block.variant,
      items: block.items.map((item) => {
        const prescription = applyOverride(item.prescription, overrides.get(item.ref));
        const resolvedLoadKg = resolveLoadKg(prescription, tests);
        return {
          ref: item.ref,
          name: item.name,
          category: item.category,
          cues: item.cues,
          media: item.media,
          prescription,
          resolvedLoadKg,
          summary: formatPrescription(prescription, resolvedLoadKg),
        };
      }),
    })),
    log: log ? { status: log.status, rpe: log.rpe, durationMin: log.durationMin, comment: log.comment } : null,
  };
};

export const logSession = async (userId: string, organizationId: string, sessionId: string, raw: SessionLogInput) => {
  const input = sessionLogInput.parse(raw);
  const access = await requireAthleteAccess(userId, organizationId);
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId)) },
    select: { id: true, date: true },
  });
  if (!session) throw notFound();
  const consent = (await consentForAthletes([access.athleteId])).get(access.athleteId);
  // Effort ressenti et douleur sont des données de santé : sans accord, on ne les enregistre pas (§ 15.1).
  const rpe = consent?.health ? (input.rpe ?? null) : null;
  const pain = consent?.health ? (input.pain ?? null) : null;

  const existing = await prisma.sessionLog.findUnique({
    where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
    select: { id: true, clientId: true },
  });
  // Rejeu de la file hors ligne : même clientId, on ne refait rien (ni écriture, ni alerte).
  if (existing?.clientId && existing.clientId === input.clientId) return { id: existing.id, replayed: true };

  const data = {
    clientId: input.clientId,
    status: input.status,
    variantDone: input.variantDone,
    rpe,
    durationMin: input.durationMin ?? null,
    comment: input.comment ?? null,
    pain: pain ?? undefined,
    completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
  };
  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.sessionLog.upsert({
      where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
      create: { ...data, scheduledSessionId: sessionId, athleteId: access.athleteId },
      update: data,
    });
    await tx.setLog.deleteMany({ where: { sessionLogId: row.id } });
    if (input.sets.length) {
      await tx.setLog.createMany({
        data: input.sets.map((s) => ({
          sessionLogId: row.id,
          itemRef: s.itemRef,
          setIndex: s.setIndex,
          reps: s.reps ?? null,
          loadKg: s.loadKg ?? null,
          distanceM: s.distanceM ?? null,
          timeS: s.timeS ?? null,
          done: s.done,
        })),
        skipDuplicates: true,
      });
    }
    return row;
  });
  log.info("session_validated", { organizationId, entityId: sessionId });

  if (pain) {
    const coaches = await coachesOfAthlete(organizationId, access.athleteId);
    await notify(coaches, "pain_alert", {
      athlete: await firstNameOf(userId),
      organizationId,
      link: `/athletes/${access.athleteId}`,
    });
  }
  return { id: saved.id, replayed: false };
};

export const setMyAttendance = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  status: "present" | "absent",
) => {
  const access = await requireAthleteAccess(userId, organizationId);
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId)) },
    select: { id: true, snapshot: true, createdBy: true, date: true },
  });
  if (!session) throw notFound();
  await prisma.attendance.upsert({
    where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
    create: { scheduledSessionId: sessionId, athleteId: access.athleteId, status, source: "athlete" },
    update: { status, source: "athlete" },
  });
  const snapshot = sessionSnapshot.parse(session.snapshot);
  return { variant: resolveVariant(status, snapshot), hasAutonomous: hasAutonomousVersion(snapshot) };
};

export const athleteDisplayName = displayName;
