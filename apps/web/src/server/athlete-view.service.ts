import { Prisma } from "@/generated/prisma/client";
import {
  type AthleteSessionCard,
  type AthleteSessionDetail,
  type AthleteToday,
  type AttendanceStatus,
  type SessionLogInput,
  sessionLogInput,
  type SessionSnapshot,
  sessionSnapshot,
  detailedSetInput,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
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
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { signedPlayback } from "@/lib/mux";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireAthleteAccess, requireOrgMember, requireVisibleAthlete } from "./access";
import { consentForAthletes } from "./consent.service";
import { displayName, namesFor } from "./me.service";
import { notify } from "./notify.service";
import { coachesOfAthlete } from "./org.service";
import { athleteAssignedWhere as assignedWhere } from "./session-audience.service";
import { strengthResolutionInputs } from "./strength.service";

const loadTests = async (athleteId: string): Promise<StrengthTest[]> => {
  return strengthResolutionInputs(prisma, athleteId);
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
  return readAthleteSession(organizationId, sessionId, access.athleteId, now);
};

export const getAthleteSessionForCoach = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  athleteId: string,
  now = new Date(),
): Promise<AthleteSessionDetail> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (access.role === "athlete" || access.role === "guardian") throw forbidden();
  await requireVisibleAthlete(access, athleteId);
  return readAthleteSession(organizationId, sessionId, athleteId, now);
};

const readAthleteSession = async (
  organizationId: string,
  sessionId: string,
  athleteId: string,
  now: Date,
): Promise<AthleteSessionDetail> => {
  const access = { athleteId };
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId)) },
    select: {
      id: true,
      version: true,
      date: true,
      startTime: true,
      location: true,
      createdBy: true,
      snapshot: true,
      attendance: { where: { athleteId: access.athleteId }, select: { status: true } },
      logs: {
        where: { athleteId: access.athleteId },
        select: {
          status: true,
          variantDone: true,
          rpe: true,
          durationMin: true,
          comment: true,
          version: true,
          sets: true,
          prescriptionSnapshot: true,
        },
      },
      overrides: { where: { athleteId: access.athleteId }, select: { itemRef: true, prescription: true } },
    },
  });
  if (!session) throw notFound();
  const log = session.logs[0] ?? null;
  const snapshot = sessionSnapshot.parse(log?.prescriptionSnapshot ?? session.snapshot);
  const coaches = await namesFor([session.createdBy]);
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
    sessionVersion: session.version,
    blocks: blocks.map((block) => ({
      ref: block.ref,
      name: block.name,
      variant: block.variant,
      items: block.items.map((item) => {
        const prescription = log?.prescriptionSnapshot
          ? item.prescription
          : applyOverride(item.prescription, overrides.get(item.ref));
        const resolvedLoadKg =
          item.resolvedLoadKg !== undefined ? item.resolvedLoadKg : resolveLoadKg(prescription, tests);
        return {
          ref: item.ref,
          exerciseId: item.exerciseId,
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
    log: log
      ? {
          status: log.status,
          rpe: log.rpe,
          durationMin: log.durationMin,
          comment: log.comment,
          version: log.version,
          detailedSets: log.sets.flatMap((set) => {
            const parsed = detailedSetInput.safeParse({
              ...set,
              loadKg: set.loadKg === null ? null : Number(set.loadKg),
              distanceM: set.distanceM === null ? null : Number(set.distanceM),
              timeS: set.timeS === null ? null : Number(set.timeS),
            });
            return parsed.success ? [parsed.data] : [];
          }),
        }
      : null,
  };
};

// Quatre semaines de régularité : un encouragement simple, sans donnée de santé et sans notification en plus.
export const getMyRegularity = async (userId: string, organizationId: string, now: Date = new Date()) => {
  const access = await requireAthleteAccess(userId, organizationId);
  const today = todayIso(now);
  const logs = await prisma.sessionLog.findMany({
    where: {
      athleteId: access.athleteId,
      session: { date: { gte: toDbDate(addDays(today, -27)), lte: toDbDate(today) } },
    },
    select: { status: true },
  });
  return {
    done: logs.filter((log) => log.status === "done" || log.status === "partial").length,
    total: logs.length,
  };
};

export const logSession = async (userId: string, organizationId: string, sessionId: string, raw: SessionLogInput) => {
  const access = await requireAthleteAccess(userId, organizationId);
  return persistSessionLog(userId, organizationId, sessionId, access.athleteId, raw);
};

export const logSessionForAthlete = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  athleteId: string,
  raw: SessionLogInput,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  await requireVisibleAthlete(access, athleteId);
  return persistSessionLog(userId, organizationId, sessionId, athleteId, raw);
};

const persistSessionLog = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  athleteId: string,
  raw: SessionLogInput,
) => {
  const input = sessionLogInput.parse(raw);
  const access = { athleteId };
  if (input.detailedSets !== undefined) {
    const space = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { progressionEnabled: true },
    });
    if (!space.progressionEnabled) throw new AppError(409, "progression_disabled", m.progression.disabled);
  }
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId)) },
    select: { id: true, date: true },
  });
  if (!session) throw notFound();
  const consent = (await consentForAthletes([access.athleteId])).get(access.athleteId);
  // Effort ressenti et douleur sont des données de santé : sans accord, on ne les enregistre pas (§ 15.1).
  const rpe = consent?.health ? (input.rpe ?? null) : null;
  const pain = consent?.health ? (input.pain ?? null) : null;

  const data = {
    clientId: input.clientId,
    status: input.status,
    variantDone: input.variantDone,
    rpe,
    durationMin: input.durationMin ?? null,
    comment: input.comment ?? null,
    // Corriger une validation doit pouvoir retirer une douleur saisie par erreur.
    pain: pain ?? Prisma.DbNull,
    completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
  };
  const saved = await prisma.$transaction(async (tx) => {
    // Sérialise aussi la première écriture : aucun upsert concurrent ne contourne la version attendue.
    await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const currentSession = await tx.scheduledSession.findFirst({
      where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId)) },
      include: { overrides: { where: { athleteId: access.athleteId } } },
    });
    if (!currentSession) throw notFound();
    const existing = await tx.sessionLog.findUnique({
      where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
    });
    if (
      existing &&
      (existing.clientId === input.clientId ||
        (await tx.sessionLogMutation.findUnique({
          where: { sessionLogId_clientId: { sessionLogId: existing.id, clientId: input.clientId } },
        })))
    )
      return { ...existing, replayed: true };
    if (input.expectedVersion !== undefined && input.expectedVersion !== (existing?.version ?? 0))
      throw new AppError(409, "log_version_conflict", m.progression.logConflict);
    if (input.expectedSessionVersion !== undefined && input.expectedSessionVersion !== currentSession.version)
      throw new AppError(409, "session_version_conflict", m.progression.sessionConflict);
    if (input.expectedVersion === undefined && existing?.prescriptionSnapshot)
      throw new AppError(409, "legacy_log_conflict", m.progression.legacyConflict);

    const snapshot = sessionSnapshot.parse(existing?.prescriptionSnapshot ?? currentSession.snapshot);
    const items = new Map(
      blocksForVariant(snapshot.blocks, input.variantDone).flatMap((b) => b.items.map((i) => [i.ref, i] as const)),
    );
    const sets = input.detailedSets ?? input.sets;
    if (sets.some((set) => !items.has(set.itemRef))) throw invalid(m.progression.unknownItem);
    const version = (existing?.version ?? 0) + 1;
    // Fige l'identité et la prescription utilisée. Une correction garde la référence historique.
    const references =
      input.detailedSets !== undefined && !existing?.prescriptionSnapshot
        ? await strengthResolutionInputs(tx, access.athleteId)
        : [];
    const prescriptionSnapshot =
      input.detailedSets !== undefined && !existing?.prescriptionSnapshot
        ? {
            ...snapshot,
            blocks: snapshot.blocks.map((block) => ({
              ...block,
              items: block.items.map((item) => {
                const prescription = applyOverride(
                  item.prescription,
                  currentSession.overrides.find((o) => o.itemRef === item.ref)?.prescription as object | undefined,
                );
                const referenceKey = prescription.load?.type === "pct_1rm" ? prescription.load.test : null;
                const row = references.find((t) => t.exerciseKey === referenceKey);
                const reference = row
                  ? {
                      id: row.id,
                      exerciseKey: row.exerciseKey,
                      value: Number(row.value),
                      kind: row.kind,
                      date: row.date,
                      originKind: row.originKind,
                      sourceTestId: row.sourceTestId,
                      loadKind: row.loadKind,
                      stepKg: row.stepKg,
                    }
                  : null;
                return {
                  ...item,
                  prescription,
                  resolvedLoadKg:
                    item.resolvedLoadKg !== undefined
                      ? item.resolvedLoadKg
                      : resolveLoadKg(prescription, reference ? [reference] : []),
                  strengthReference: item.strengthReference !== undefined ? item.strengthReference : reference,
                };
              }),
            })),
          }
        : undefined;
    const versioned = {
      ...data,
      version,
      recordedBy: userId,
      ...(prescriptionSnapshot
        ? {
            prescriptionSnapshot: prescriptionSnapshot as unknown as Prisma.InputJsonValue,
            sessionVersion: currentSession.version,
          }
        : {}),
    };
    const row = await tx.sessionLog.upsert({
      where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
      create: { ...versioned, scheduledSessionId: sessionId, athleteId: access.athleteId },
      update: versioned,
    });
    // Anciennes applications / action rapide : [] veut dire « aucun détail envoyé », pas « tout effacer ».
    // Le contrat détaillé versionné permet, lui, une suppression explicite avec detailedSets: [].
    if (input.detailedSets !== undefined || sets.length > 0) {
      await tx.setLog.deleteMany({ where: { sessionLogId: row.id } });
      await tx.setLog.createMany({
        data: sets.map((s, index) => ({
          sessionLogId: row.id,
          itemRef: s.itemRef,
          exerciseId: items.get(s.itemRef)?.exerciseId,
          setIndex: s.setIndex,
          reps: s.reps ?? null,
          loadKg: s.loadKg ?? null,
          distanceM: s.distanceM ?? null,
          timeS: s.timeS ?? null,
          done: s.done,
          ...(input.detailedSets?.[index]
            ? {
                setKind: input.detailedSets[index].setKind,
                loadKind: input.detailedSets[index].loadKind,
                repetitionScope: input.detailedSets[index].repetitionScope,
                sideCount: input.detailedSets[index].sideCount,
                groundContacts: input.detailedSets[index].groundContacts ?? null,
              }
            : {}),
        })),
      });
    }
    await tx.sessionLogMutation.create({ data: { sessionLogId: row.id, clientId: input.clientId, version } });
    return { ...row, replayed: false };
  });
  if (saved.replayed) return { id: saved.id, version: saved.version, replayed: true };
  log.info("session_validated", { organizationId, entityId: sessionId });

  if (pain) {
    const coaches = await coachesOfAthlete(organizationId, access.athleteId);
    const athlete = await prisma.athlete.findUniqueOrThrow({ where: { id: athleteId }, select: { firstName: true } });
    await notify(coaches, "pain_alert", {
      athlete: athlete.firstName,
      organizationId,
      link: `/athletes/${access.athleteId}`,
    });
  }
  return { id: saved.id, version: saved.version, replayed: false };
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
