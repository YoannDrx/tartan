import {
  athleteExerciseIndex,
  athleteHistoryContext,
  detailedSetInput,
  exerciseHistoryQuery,
  exerciseHistoryResponse,
  sessionSnapshot,
  type ExerciseHistoryQuery,
  type ExerciseHistorySession,
} from "@tartan/contracts";
import { actualSetVolumes } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, toDbDate, todayIso } from "@/lib/dates";
import { AppError, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireVisibleAthlete } from "./access";
import { getExerciseStrength } from "./strength.service";

const requireHistoryAccess = async (userId: string, organizationId: string, athleteId: string) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  await requireVisibleAthlete(access, athleteId);
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { progressionEnabled: true },
  });
  if (!organization.progressionEnabled) throw new AppError(409, "progression_disabled", m.progression.disabled);
};

// Sélection fondée sur des liens explicites ; pas de rattachement d'une ancienne clé par nom.
export const listAthleteHistoryExercises = async (userId: string, organizationId: string, athleteId: string) => {
  await requireHistoryAccess(userId, organizationId, athleteId);
  return loadHistoryExercises(organizationId, athleteId);
};

export const getAthleteHistoryContext = async (userId: string, organizationId: string, athleteId: string) => {
  await requireHistoryAccess(userId, organizationId, athleteId);
  const [athlete, exercises] = await Promise.all([
    prisma.athlete.findFirstOrThrow({
      where: { id: athleteId, organizationId },
      select: { id: true, firstName: true, lastName: true },
    }),
    loadHistoryExercises(organizationId, athleteId),
  ]);
  return athleteHistoryContext.parse({ athlete, exercises, today: todayIso() });
};

const loadHistoryExercises = async (organizationId: string, athleteId: string) => {
  const [sets, tests, references] = await Promise.all([
    prisma.setLog.findMany({
      where: {
        exerciseId: { not: null },
        log: { athleteId, session: { organizationId }, status: { in: ["done", "partial"] } },
      },
      distinct: ["exerciseId"],
      select: { exerciseId: true },
    }),
    prisma.strengthTest.findMany({
      where: { organizationId, athleteId, exerciseId: { not: null } },
      distinct: ["exerciseId"],
      select: { exerciseId: true },
    }),
    prisma.strengthReference.findMany({ where: { organizationId, athleteId }, select: { exerciseId: true } }),
  ]);
  const realized = new Set(sets.map((set) => set.exerciseId));
  const tested = new Set(tests.map((test) => test.exerciseId));
  const referenced = new Set(references.map((reference) => reference.exerciseId));
  const ids = [...new Set([...realized, ...tested, ...referenced])].filter((id): id is string => id !== null);
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: ids }, OR: [{ organizationId }, { organizationId: null }] },
    select: { id: true, name: true, deletedAt: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return athleteExerciseIndex.parse(
    exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      archived: exercise.deletedAt !== null,
      hasRealizedSets: realized.has(exercise.id),
      hasStrengthTests: tested.has(exercise.id),
      hasStrengthReference: referenced.has(exercise.id),
    })),
  );
};

// Borné et explicite : une période tronquée ne doit jamais passer pour tout l'historique.
const LIMIT_SESSIONS = 200;
export const getAthleteExerciseHistory = async (
  userId: string,
  organizationId: string,
  athleteId: string,
  exerciseId: string,
  raw: ExerciseHistoryQuery,
) => {
  const range = exerciseHistoryQuery.parse(raw);
  await requireHistoryAccess(userId, organizationId, athleteId);
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ organizationId }, { organizationId: null }] },
    select: { deletedAt: true },
  });
  if (!exercise) throw notFound();
  const where = {
    athleteId,
    status: { in: ["done", "partial"] as ("done" | "partial")[] },
    session: { organizationId, date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } },
    sets: { some: { exerciseId } },
  };
  const [totalSessions, logs, strength] = await Promise.all([
    prisma.sessionLog.count({ where }),
    prisma.sessionLog.findMany({
      where,
      take: LIMIT_SESSIONS,
      orderBy: [{ session: { date: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        version: true,
        status: true,
        recordedBy: true,
        updatedAt: true,
        prescriptionSnapshot: true,
        session: { select: { id: true, title: true, date: true } },
        sets: {
          where: { exerciseId },
          orderBy: [{ itemRef: "asc" }, { setIndex: "asc" }],
          select: {
            itemRef: true,
            setIndex: true,
            reps: true,
            loadKg: true,
            distanceM: true,
            timeS: true,
            done: true,
            setKind: true,
            loadKind: true,
            repetitionScope: true,
            sideCount: true,
            groundContacts: true,
          },
        },
      },
    }),
    getExerciseStrength(userId, organizationId, athleteId, exerciseId),
  ]);
  let unusableSets = 0;
  const sessions: ExerciseHistorySession[] = logs.map((log) => {
    const snapshot = sessionSnapshot.safeParse(log.prescriptionSnapshot);
    const items = snapshot.success
      ? snapshot.data.blocks.flatMap((block) => block.items).filter((item) => item.exerciseId === exerciseId)
      : [];
    const byRef = new Map(items.map((item) => [item.ref, item]));
    const sets = log.sets.flatMap((set) => {
      const parsed = detailedSetInput.safeParse({
        ...set,
        loadKg: set.loadKg === null ? null : Number(set.loadKg),
        distanceM: set.distanceM === null ? null : Number(set.distanceM),
        timeS: set.timeS === null ? null : Number(set.timeS),
      });
      if (!parsed.success || !byRef.has(set.itemRef)) {
        unusableSets++;
        return [];
      }
      return [parsed.data];
    });
    return {
      sessionId: log.session.id,
      logId: log.id,
      date: fromDbDate(log.session.date),
      title: log.session.title,
      version: log.version,
      recordedBy: log.recordedBy,
      updatedAt: log.updatedAt.toISOString(),
      status: log.status as "done" | "partial",
      items: items.map((item) => ({
        itemRef: item.ref,
        name: item.name,
        prescription: item.prescription,
        resolvedLoadKg: item.resolvedLoadKg ?? null,
        strengthLoadKind: item.strengthLoadKind ?? null,
        strengthReference: item.strengthReference ?? null,
        sets: sets.filter((set) => set.itemRef === item.ref),
      })),
      volumes: actualSetVolumes(sets),
    };
  });
  return exerciseHistoryResponse.parse({
    ...strength,
    exercise: { ...strength.exercise, archived: exercise.deletedAt !== null },
    ...range,
    sessions,
    coverage: {
      totalSessions,
      returnedSessions: sessions.length,
      detailedSessions: sessions.filter((session) => session.items.some((item) => item.sets.length > 0)).length,
      unusableSets,
      limitSessions: LIMIT_SESSIONS,
      truncated: totalSessions > sessions.length,
    },
  });
};
