import { loadStrengthRecords } from "./strength-records";
import { confirmedStrengthImprovements } from "@tartan/domain";
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
  prescriptionSchema,
  detailedSetInput,
  painInput,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import {
  addDays,
  applyOverride,
  blocksForVariant,
  cellStatusOf,
  exerciseCount,
  formatPrescription,
  freezePrescription,
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
import { audit, requireAthleteAccess, requireOrgMember, requireVisibleAthlete } from "./access";
import { consentForAthletes } from "./consent.service";
import { displayName, namesFor } from "./me.service";
import { notify } from "./notify.service";
import { coachesOfAthlete } from "./org.service";
import { athleteAssignedWhere as assignedWhere } from "./session-audience.service";
import { strengthResolutionInputs } from "./strength.service";
import { loadPreviousExerciseSets } from "./previous-exercise-sets";

const loadTests = async (athleteId: string): Promise<StrengthTest[]> => {
  return strengthResolutionInputs(prisma, athleteId);
};

type SessionRow = {
  version: number;
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
  log: {
    status: "done" | "partial" | "missed" | "skipped";
    variantDone: "club" | "autonomous" | null;
    version: number;
  } | null,
  coachName: string | null,
  now: Date,
): AthleteSessionCard => {
  const date = fromDbDate(session.date);
  const variant = log?.variantDone ?? resolveVariant(attendance, snapshot);
  return {
    id: session.id,
    sessionVersion: session.version,
    logVersion: log?.version ?? 0,
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
      version: true,
      date: true,
      startTime: true,
      location: true,
      createdBy: true,
      snapshot: true,
      attendance: { where: { athleteId }, select: { status: true } },
      logs: { where: { athleteId }, select: { status: true, variantDone: true, version: true } },
    },
  });
  const coaches = await namesFor(sessions.map((s) => s.createdBy));
  // Une séance au contenu illisible disparaît seule : elle ne fait pas tomber tout le mois.
  return sessions.flatMap((s) => {
    const snapshot = sessionSnapshot.safeParse(s.snapshot);
    if (!snapshot.success) return [];
    return [
      toCard(
        s,
        snapshot.data,
        s.attendance[0]?.status ?? "unknown",
        s.logs[0] ?? null,
        coaches.get(s.createdBy) ?? null,
        now,
      ),
    ];
  });
};

// « À travailler » : la consigne du coach, les points techniques de la prochaine séance, la dernière remarque vidéo.
const athleteFocus = async (athleteId: string, card: AthleteSessionCard | null, videoConsent: boolean) => {
  const session = card
    ? await prisma.scheduledSession.findUnique({ where: { id: card.id }, select: { snapshot: true } })
    : null;
  const snapshot = session ? sessionSnapshot.safeParse(session.snapshot) : null;
  const cues = snapshot?.success
    ? blocksForVariant(snapshot.data.blocks, card!.variant)
        .flatMap((block) => block.items)
        .flatMap((item) => (item.cues[0] ? [{ exercise: item.name, cue: item.cues[0] }] : []))
        .slice(0, 3)
    : [];
  const latest = videoConsent
    ? await prisma.video.findFirst({
        where: { athleteId, sharedWithAthlete: true, annotations: { some: { text: { not: null } } } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          exercise: { select: { name: true } },
          annotations: {
            where: { text: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { text: true },
          },
        },
      })
    : null;
  const text = latest?.annotations[0]?.text;
  const video = latest && text ? { id: latest.id, exerciseName: latest.exercise?.name ?? null, text } : null;
  const coachNote = card?.coachNote ?? null;
  return coachNote || cues.length > 0 || video ? { coachNote, cues, video } : null;
};

// L'accueil d'un athlète qui vient d'arriver : il s'efface à la première séance validée, ou après une semaine.
const WELCOME_DAYS = 7;

export const getAthleteWelcome = async (
  userId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<{ group: string; coach: string } | null> => {
  const access = await requireAthleteAccess(userId, organizationId);
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { createdAt: true, organization: { select: { name: true, ownerId: true } } },
  });
  if (!member || now.getTime() - member.createdAt.getTime() > WELCOME_DAYS * 86_400_000) return null;
  const [validated, membership, leads] = await Promise.all([
    prisma.sessionLog.count({ where: { athleteId: access.athleteId, status: { in: ["done", "partial"] } } }),
    prisma.groupMember.findFirst({
      where: { athleteId: access.athleteId },
      orderBy: { createdAt: "asc" },
      select: { groupId: true, group: { select: { name: true } } },
    }),
    prisma.groupCoach.findMany({
      where: { role: "lead", group: { organizationId, members: { some: { athleteId: access.athleteId } } } },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
      take: 1,
    }),
  ]);
  if (validated > 0) return null;
  // Le coach qui suit le groupe signe l'accueil ; à défaut, le responsable de l'espace.
  const coachId = leads[0]?.userId ?? member.organization.ownerId;
  const names = await namesFor([coachId]);
  return {
    group: membership?.group.name ?? member.organization.name,
    coach: (names.get(coachId) ?? member.organization.name).split(" ")[0] ?? member.organization.name,
  };
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
  const focus = await athleteFocus(access.athleteId, todays[0] ?? next, consent?.video ?? false);
  return {
    focus,
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
  const [detail, athlete, scheduled] = await Promise.all([
    readAthleteSession(organizationId, sessionId, athleteId, now),
    prisma.athlete.findFirst({
      where: { id: athleteId, organizationId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.scheduledSession.findFirst({ where: { id: sessionId, organizationId }, select: { createdBy: true } }),
  ]);
  if (!athlete || !scheduled) throw notFound();
  // Effort et douleur affichés au coach : accès journalisé (§ 15.2).
  if (detail.healthConsent && (detail.log?.rpe != null || detail.log?.pain))
    await audit({ organizationId, actorId: userId, action: "health_read", entity: "athlete", entityId: athleteId });
  return {
    ...detail,
    athlete: { id: athlete.id, name: `${athlete.firstName} ${athlete.lastName}`.trim() },
    canRecordSets: access.role !== "assistant" || scheduled.createdBy === userId,
  };
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
      prescriptionFrozenAt: true,
      organization: { select: { progressionEnabled: true } },
      attendance: { where: { athleteId: access.athleteId }, select: { status: true } },
      logs: {
        where: { athleteId: access.athleteId },
        select: {
          status: true,
          variantDone: true,
          rpe: true,
          pain: true,
          durationMin: true,
          comment: true,
          version: true,
          clientId: true,
          sets: true,
          prescriptionSnapshot: true,
          sessionVersion: true,
        },
      },
      overrides: { where: { athleteId: access.athleteId }, select: { itemRef: true, prescription: true } },
    },
  });
  if (!session) throw notFound();
  const log = session.logs[0] ?? null;
  const healthConsent = (await consentForAthletes([athleteId])).get(athleteId)?.health ?? false;
  const visiblePain = healthConsent ? painInput.safeParse(log?.pain) : null;
  // Borne la copie à la version lue : une révision concurrente ne peut pas
  // associer une prescription plus récente à l'ancien jeton de version.
  const storedPrescription =
    !log?.prescriptionSnapshot && session.prescriptionFrozenAt
      ? (
          await prisma.sessionPrescription.findFirst({
            where: {
              scheduledSessionId: sessionId,
              athleteId,
              sessionVersion: { lte: log?.sessionVersion ?? session.version },
            },
            orderBy: { sessionVersion: "desc" },
          })
        )?.snapshot
      : undefined;
  const individualized = Boolean(log?.prescriptionSnapshot || storedPrescription || session.prescriptionFrozenAt);
  const snapshot = sessionSnapshot.parse(
    log?.prescriptionSnapshot ??
      storedPrescription ??
      (session.prescriptionFrozenAt
        ? freezePrescription(
            sessionSnapshot.parse(session.snapshot),
            [],
            session.overrides.map((o) => ({
              itemRef: o.itemRef,
              prescription: prescriptionSchema.parse(o.prescription),
            })),
          )
        : session.snapshot),
  );
  const coaches = await namesFor([session.createdBy]);
  const card = toCard(
    session,
    snapshot,
    session.attendance[0]?.status ?? "unknown",
    log,
    coaches.get(session.createdBy) ?? null,
    now,
  );
  const tests = individualized ? [] : await loadTests(access.athleteId);
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
  const previousExerciseSets = session.organization.progressionEnabled
    ? await loadPreviousExerciseSets({
        organizationId,
        athleteId,
        sessionId,
        date: session.date,
        startTime: session.startTime,
        items: blocks.flatMap((block) => block.items),
      })
    : undefined;
  return {
    ...card,
    ...(previousExerciseSets ? { previousExerciseSets, historyAthleteId: athleteId } : {}),
    sessionVersion: session.version,
    progressionEnabled: session.organization.progressionEnabled,
    healthConsent,
    blocks: blocks.map((block) => ({
      ref: block.ref,
      name: block.name,
      variant: block.variant,
      items: block.items.map((item) => {
        const prescription = individualized
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
          strengthLoadKind: item.strengthLoadKind,
          loadStepKg: item.loadStepKg,
          resolvedLoadKg,
          summary: formatPrescription(prescription, resolvedLoadKg),
        };
      }),
    })),
    log: log
      ? {
          status: log.status,
          rpe: healthConsent ? log.rpe : null,
          pain: visiblePain?.success ? visiblePain.data : null,
          durationMin: log.durationMin,
          comment: log.comment,
          version: log.version,
          clientId: log.clientId,
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
  return persistSessionLog(userId, organizationId, sessionId, access.athleteId, raw, true);
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
  if (access.role === "assistant") {
    const session = await prisma.scheduledSession.findFirst({
      where: { id: sessionId, organizationId },
      select: { createdBy: true },
    });
    if (!session) throw notFound();
    if (session.createdBy !== userId) throw forbidden();
  }
  // Le staff corrige les séries réalisées ; effort, douleur et commentaire restent ceux de l'athlète.
  // Une relecture de conflit renvoie la saisie complète : seules ses séries sont retenues.
  if (raw.writeScope === "status" || raw.writeScope === "feedback") throw forbidden();
  const { rpe: _rpe, pain: _pain, durationMin: _durationMin, comment: _comment, ...performed } = raw;
  const staffWrite = { ...performed, writeScope: "sets" as const };
  if (!sessionLogInput.safeParse(staffWrite).success) throw invalid();
  return persistSessionLog(userId, organizationId, sessionId, athleteId, staffWrite, false);
};

const persistSessionLog = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  athleteId: string,
  raw: SessionLogInput,
  athleteValidation: boolean,
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
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    // Sérialise aussi la première écriture : aucun upsert concurrent ne contourne la version attendue.
    await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const currentSession = await tx.scheduledSession.findFirst({
      where: { id: sessionId, organizationId, ...(await assignedWhere(access.athleteId, tx)) },
      include: {
        overrides: { where: { athleteId: access.athleteId } },
        prescriptions: { where: { athleteId: access.athleteId }, orderBy: { sessionVersion: "desc" }, take: 1 },
      },
    });
    if (!currentSession) throw notFound();
    const existing = await tx.sessionLog.findUnique({
      where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
    });
    const previousMutation = existing
      ? await tx.sessionLogMutation.findUnique({
          where: { sessionLogId_clientId: { sessionLogId: existing.id, clientId: input.clientId } },
        })
      : null;
    if (existing && (previousMutation || existing.clientId === input.clientId))
      return { ...existing, version: previousMutation?.version ?? existing.version, replayed: true };
    if (input.expectedVersion !== undefined && input.expectedVersion !== (existing?.version ?? 0))
      throw new AppError(409, "log_version_conflict", m.progression.logConflict);
    // Seules les séries détaillées se rattachent à une prescription précise : une validation simple reste possible.
    if (
      input.detailedSets !== undefined &&
      input.expectedSessionVersion !== undefined &&
      input.expectedSessionVersion !== currentSession.version
    )
      throw new AppError(409, "session_version_conflict", m.progression.sessionConflict);
    if (input.expectedVersion === undefined && existing?.prescriptionSnapshot)
      throw new AppError(409, "legacy_log_conflict", m.progression.legacyConflict);

    const individualized =
      existing?.sessionVersion && !existing.prescriptionSnapshot
        ? (
            await tx.sessionPrescription.findFirst({
              where: { scheduledSessionId: sessionId, athleteId, sessionVersion: { lte: existing.sessionVersion } },
              orderBy: { sessionVersion: "desc" },
            })
          )?.snapshot
        : currentSession.prescriptions[0]?.snapshot;
    const snapshot = sessionSnapshot.parse(
      existing?.prescriptionSnapshot ??
        individualized ??
        (currentSession.prescriptionFrozenAt
          ? freezePrescription(
              sessionSnapshot.parse(currentSession.snapshot),
              [],
              currentSession.overrides.map((o) => ({
                itemRef: o.itemRef,
                prescription: prescriptionSchema.parse(o.prescription),
              })),
            )
          : currentSession.snapshot),
    );
    const items = new Map(
      blocksForVariant(snapshot.blocks, input.variantDone).flatMap((b) => b.items.map((i) => [i.ref, i] as const)),
    );
    if (input.detailedSets?.some((set) => !items.has(set.itemRef))) throw invalid(m.progression.unknownItem);
    // Une case cochée sur un exercice retiré depuis ne doit pas faire perdre la validation.
    const sets = input.detailedSets ?? input.sets.filter((set) => items.has(set.itemRef));
    const version = (existing?.version ?? 0) + 1;
    // Fige l'identité et la prescription utilisée. Une correction garde la référence historique.
    const references =
      input.detailedSets !== undefined && !existing?.prescriptionSnapshot && !currentSession.prescriptionFrozenAt
        ? await strengthResolutionInputs(tx, access.athleteId)
        : [];
    const prescriptionSnapshot =
      input.detailedSets !== undefined && !existing?.prescriptionSnapshot
        ? {
            ...snapshot,
            blocks: snapshot.blocks.map((block) => ({
              ...block,
              items: block.items.map((item) => {
                const prescription = currentSession.prescriptionFrozenAt
                  ? item.prescription
                  : applyOverride(
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
    const claimCelebration = input.status === "done" && !existing?.celebrationClaimedAt;
    const versioned = {
      ...(claimCelebration ? { celebrationClaimedAt: new Date() } : {}),
      ...data,
      ...(input.expectedVersion !== undefined && existing?.completedAt ? { completedAt: existing.completedAt } : {}),
      ...(input.writeScope === "sets" || input.writeScope === "status"
        ? {
            rpe: consent?.health ? (existing?.rpe ?? null) : null,
            durationMin: existing?.durationMin ?? null,
            comment: existing?.comment ?? null,
            pain: consent?.health ? (existing?.pain ?? Prisma.DbNull) : Prisma.DbNull,
            completedAt: existing?.completedAt ?? data.completedAt,
          }
        : {}),
      ...(input.writeScope === "feedback"
        ? {
            rpe: consent?.health ? (input.rpe !== undefined ? input.rpe : (existing?.rpe ?? null)) : null,
            durationMin: input.durationMin !== undefined ? input.durationMin : (existing?.durationMin ?? null),
            comment: input.comment !== undefined ? input.comment : (existing?.comment ?? null),
            pain: consent?.health
              ? input.pain !== undefined
                ? (input.pain ?? Prisma.DbNull)
                : (existing?.pain ?? Prisma.DbNull)
              : Prisma.DbNull,
            completedAt: existing?.completedAt ?? data.completedAt,
          }
        : {}),
      version,
      recordedBy: userId,
      ...(currentSession.prescriptionFrozenAt && !existing?.sessionVersion
        ? { sessionVersion: currentSession.version }
        : {}),
      ...(prescriptionSnapshot
        ? {
            prescriptionSnapshot: prescriptionSnapshot as unknown as Prisma.InputJsonValue,
            sessionVersion: existing?.sessionVersion ?? currentSession.version,
          }
        : {}),
    };
    const recordsEnabled =
      (input.detailedSets !== undefined || (existing?.prescriptionSnapshot && existing.status !== input.status)) &&
      (await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { progressionEnabled: true } }))
        .progressionEnabled;
    const recordExercises = [
      ...new Set([...items.values()].flatMap((item) => (item.exerciseId ? [item.exerciseId] : []))),
    ];
    const beforeRecords = recordsEnabled
      ? await loadStrengthRecords(tx, organizationId, athleteId, recordExercises)
      : [];
    const row = await tx.sessionLog.upsert({
      where: { scheduledSessionId_athleteId: { scheduledSessionId: sessionId, athleteId: access.athleteId } },
      create: { ...versioned, scheduledSessionId: sessionId, athleteId: access.athleteId },
      update: versioned,
    });
    // Anciennes applications / action rapide : [] veut dire « aucun détail envoyé », pas « tout effacer ».
    // Le contrat détaillé versionné permet, lui, une suppression explicite avec detailedSets: [].
    if (input.detailedSets !== undefined || (sets.length > 0 && !existing?.prescriptionSnapshot)) {
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
    const afterRecords = recordsEnabled
      ? await loadStrengthRecords(tx, organizationId, athleteId, recordExercises)
      : [];
    const records = confirmedStrengthImprovements(beforeRecords, afterRecords, {
      logId: row.id,
      version,
      clientId: input.clientId,
    });
    const celebration =
      claimCelebration && athleteValidation
        ? {
            id: `${row.id}:${version}`,
            logVersion: version,
            records: afterRecords.filter((record) => record.logId === row.id && !record.baseline),
          }
        : null;
    return { ...row, replayed: false, records, celebration };
  });
  if (saved.replayed) return { id: saved.id, version: saved.version, replayed: true, records: [], celebration: null };
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
  return {
    id: saved.id,
    version: saved.version,
    replayed: false,
    records: "records" in saved ? saved.records : [],
    celebration: "celebration" in saved ? saved.celebration : null,
  };
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
