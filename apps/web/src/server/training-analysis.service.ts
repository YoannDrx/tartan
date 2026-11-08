import {
  trainingAnalysisContext,
  detailedSetInput,
  sessionSnapshot,
  trainingAnalysisQuery,
  trainingAnalysisResponse,
  type TrainingAnalysisQuery,
  type TrainingAnalysis,
} from "@tartan/contracts";
import {
  addDays,
  analysisEntryTotals,
  blocksForVariant,
  isSessionAssigned,
  resolveVariant,
  startOfWeek,
  sumAnalysisTotals,
  scopeAnalysisEntries,
  analyzeExerciseClassification,
  type AnalysisEntry,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  coachGroupIds,
  audit,
  requireGroupInScope,
  requireOrgMember,
  requireVisibleAthlete,
  visibleAthleteIds,
} from "./access";
import { consentForAthletes } from "./consent.service";

// Lecture commune au web et au natif. Aucun maximum actuel, aucune note privée et aucune douleur.
export async function getTrainingAnalysis(
  userId: string,
  organizationId: string,
  raw: TrainingAnalysisQuery,
  now: Date = new Date(),
): Promise<TrainingAnalysis> {
  const parsed = trainingAnalysisQuery.safeParse(raw);
  if (!parsed.success) throw invalid(m.analysis.invalid);
  const query = { ...parsed.data };
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { progressionEnabled: true, phasesEnabled: true },
  });
  if (!org.progressionEnabled) throw new AppError(409, "progression_disabled", m.progression.disabled);
  if (access.role === "athlete") {
    if (!access.athleteId || (query.athleteId && query.athleteId !== access.athleteId)) throw forbidden();
    query.athleteId = access.athleteId;
  }
  let phase: TrainingAnalysis["phase"] = null;
  const canAttribute = access.role === "owner" || access.role === "coach";
  const historicalPhase = Boolean(query.phaseId && canAttribute);
  if (query.phaseId) {
    if (!org.phasesEnabled) throw new AppError(409, "phases_disabled", m.trainingPhases.disabled);
    const row = await prisma.trainingPhase.findFirst({
      where: {
        id: query.phaseId,
        organizationId,
        deletedAt: null,
        ...(["athlete", "assistant"].includes(access.role) ? { publishedAt: { not: null } } : {}),
      },
      select: { id: true, name: true, groupId: true, athleteId: true, startDate: true, endDate: true },
    });
    if (!row) throw notFound();
    if (row.athleteId) {
      await requireVisibleAthlete(access, row.athleteId);
      if (!historicalPhase) {
        if (query.athleteId && query.athleteId !== row.athleteId) throw forbidden();
        query.athleteId = row.athleteId;
      }
    } else if (row.groupId) {
      if (canAttribute) await requireGroupInScope(access, [row.groupId]);
      if (!historicalPhase) {
        if (query.groupId && query.groupId !== row.groupId) throw forbidden();
        query.groupId = row.groupId;
      }
    }
    if (!historicalPhase) {
      query.from = query.from > fromDbDate(row.startDate) ? query.from : fromDbDate(row.startDate);
      query.to = query.to < fromDbDate(row.endDate) ? query.to : fromDbDate(row.endDate);
    }
    if (query.from > query.to) throw invalid(m.analysis.invalid);
    phase = { id: row.id, name: row.name, basis: historicalPhase ? "prescription" : "shared_period" };
  }
  if (query.athleteId) await requireVisibleAthlete(access, query.athleteId);
  if (query.groupId) {
    if (access.role === "athlete") {
      if (
        !(await prisma.groupMember.count({
          where: { groupId: query.groupId, athleteId: access.athleteId!, group: { organizationId } },
        }))
      )
        throw forbidden();
    } else await requireGroupInScope(access, [query.groupId]);
  }
  const visible = query.athleteId ? [query.athleteId] : await visibleAthleteIds(access);
  const athletes = await prisma.athlete.findMany({
    where: {
      organizationId,
      id: { in: visible },
      ...(query.groupId ? { groups: { some: { groupId: query.groupId } } } : {}),
    },
    select: { id: true, groups: { select: { groupId: true, createdAt: true } } },
  });
  const athleteIds = athletes.map((a) => a.id);
  const days = Math.round((Date.parse(query.to) - Date.parse(query.from)) / 86400000) + 1;
  const previousTo = addDays(query.from, -1),
    previousFrom = addDays(query.from, -days);
  const diversityFrom = addDays(query.to, -27);
  const first = previousFrom < diversityFrom ? previousFrom : diversityFrom;
  const dates = { gte: toDbDate(first), lte: toDbDate(query.to) };
  const consents = await consentForAthletes(athleteIds);
  const healthIds = athleteIds.filter((id) => consents.get(id)?.health);
  const [sessions, healthLogs] = await Promise.all([
    prisma.scheduledSession.findMany({
      where: { organizationId, publishedAt: { not: null }, date: dates },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      take: 5001,
      select: {
        id: true,
        version: true,
        date: true,
        assignments: { select: { targetType: true, targetId: true } },
        attendance: { where: { athleteId: { in: athleteIds } }, select: { athleteId: true, status: true } },
        prescriptions: {
          where: { athleteId: { in: athleteIds } },
          orderBy: { sessionVersion: "desc" },
          distinct: ["athleteId"],
          select: {
            athleteId: true,
            sessionVersion: true,
            snapshot: true,
            ...(historicalPhase ? { phaseId: true } : {}),
          },
        },
        logs: {
          where: { athleteId: { in: athleteIds } },
          select: {
            id: true,
            athleteId: true,
            status: true,
            variantDone: true,
            sessionVersion: true,
            prescriptionSnapshot: true,
            sets: {
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
        },
      },
    }),
    // Les colonnes santé ne sont même pas lues pour les personnes sans consentement.
    healthIds.length
      ? prisma.sessionLog.findMany({
          where: { athleteId: { in: healthIds }, session: { organizationId, publishedAt: { not: null }, date: dates } },
          select: { id: true, rpe: true, durationMin: true },
        })
      : [],
  ]);
  if (sessions.length > 5000) throw invalid(m.analysis.tooLarge);
  // The latest copy may have changed after an athlete's validation. Match that validation's exact version.
  // No private phase references are selected for the public/shared-period view.
  const recordedCopies =
    historicalPhase && athleteIds.length
      ? await prisma.$queryRaw<
          {
            logId: string;
            phaseId: string | null;
            snapshot: unknown;
          }[]
        >(Prisma.sql`
    SELECT l.id AS "logId", p.phase_id AS "phaseId", p.snapshot
    FROM session_logs l
    JOIN scheduled_sessions s ON s.id = l.scheduled_session_id
    JOIN session_prescriptions p ON p.scheduled_session_id = l.scheduled_session_id
      AND p.athlete_id = l.athlete_id AND p.session_version = l.session_version
    WHERE s.organization_id = ${organizationId}::uuid AND s.published_at IS NOT NULL
      AND s.date >= ${dates.gte} AND s.date <= ${dates.lte}
      AND p.session_version <= s.version
      AND l.athlete_id IN (${Prisma.join(athleteIds.map((id) => Prisma.sql`${id}::uuid`))})
  `)
      : [];
  const recordedCopyById = new Map(recordedCopies.map((copy) => [copy.logId, copy]));
  if (healthLogs.length && access.role !== "athlete")
    await audit({ organizationId, actorId: userId, action: "health_read", entity: "training_analysis" });
  const healthById = new Map(healthLogs.map((l) => [l.id, l]));
  const entries: { date: string; athleteId: string; phaseId: string | null; entry: AnalysisEntry }[] = [];
  for (const session of sessions) {
    const date = fromDbDate(session.date);
    const logs = new Map(session.logs.map((l) => [l.athleteId, l]));
    const copies = new Map(session.prescriptions.map((p) => [p.athleteId, p]));
    const attendance = new Map(session.attendance.map((a) => [a.athleteId, a.status]));
    for (const athlete of athletes) {
      const log = logs.get(athlete.id);
      if (
        !isSessionAssigned({
          date,
          assignments: session.assignments,
          athleteId: athlete.id,
          groups: athlete.groups.map((g) => ({ groupId: g.groupId, joinedOn: todayIso(g.createdAt) })),
          hasLog: Boolean(log) || (date < todayIso(now) && Boolean(copies.get(athlete.id))),
        })
      )
        continue;
      const copy = copies.get(athlete.id);
      const validCopy =
        copy &&
        copy.sessionVersion <= session.version &&
        (!log?.sessionVersion || copy.sessionVersion === log.sessionVersion)
          ? copy
          : null;
      const recordedCopy = log ? recordedCopyById.get(log.id) : undefined;
      const frozen = log?.prescriptionSnapshot ?? recordedCopy?.snapshot ?? validCopy?.snapshot;
      const snapshot = sessionSnapshot.safeParse(frozen);
      const detail = healthById.get(log?.id ?? "");
      entries.push({
        date,
        athleteId: athlete.id,
        phaseId: historicalPhase
          ? ((!log || (log.status === "missed" && log.sessionVersion === null)
              ? validCopy?.phaseId
              : recordedCopy?.phaseId) ?? null)
          : null,
        entry: {
          snapshot: snapshot.success ? snapshot.data : null,
          frozen: Boolean(frozen) && snapshot.success,
          variant:
            log?.variantDone ??
            (snapshot.success ? resolveVariant(attendance.get(athlete.id) ?? "unknown", snapshot.data) : "club"),
          status: log?.status ?? null,
          health: consents.get(athlete.id)?.health ?? false,
          rpe: detail?.rpe ?? null,
          durationMin: detail?.durationMin ?? null,
          sets: (log?.sets ?? []).flatMap((s) => {
            const value = detailedSetInput.safeParse({
              ...s,
              loadKg: s.loadKg === null ? null : Number(s.loadKg),
              distanceM: s.distanceM === null ? null : Number(s.distanceM),
              timeS: s.timeS === null ? null : Number(s.timeS),
            });
            return value.success ? [value.data] : [];
          }),
        },
      });
    }
  }
  const scope = scopeAnalysisEntries(entries, {
    from: query.from,
    to: query.to,
    previousFrom,
    previousTo,
    ...(historicalPhase ? { phaseId: query.phaseId } : {}),
  });
  const current = scope.current;
  if (phase && historicalPhase) phase.coverage = scope.coverage;
  const totals = (rows: typeof entries) => sumAnalysisTotals(rows.map((e) => analysisEntryTotals(e.entry)));
  const weeks: TrainingAnalysis["weeks"] = [];
  for (let week = startOfWeek(query.from); week <= query.to; week = addDays(week, 7)) {
    weeks.push({ weekStart: week, totals: totals(current.filter((e) => startOfWeek(e.date) === week)) });
  }
  const exercises = new Map<string, TrainingAnalysis["exercises"][number]>();
  const distinct28 = new Set<string>();
  let occurrences28 = 0,
    unidentifiedItems = 0;
  for (const { date, entry } of scope.attributed) {
    const items = entry.snapshot ? blocksForVariant(entry.snapshot.blocks, entry.variant).flatMap((b) => b.items) : [];
    for (const item of items) {
      if (date >= diversityFrom) {
        occurrences28++;
        if (item.exerciseId) distinct28.add(item.exerciseId);
        else unidentifiedItems++;
      }
      if (date < query.from || date > query.to) continue;
      // Identité explicite ; aucune fusion de variantes par ressemblance de nom.
      const key = item.exerciseId ? `${item.exerciseId}:${item.category}` : `unlinked:${item.name}:${item.category}`;
      const row = exercises.get(key) ?? {
        key,
        exerciseId: item.exerciseId,
        name: item.name,
        category: item.category,
        occurrences: 0,
        plannedSets: 0,
        completedWorkSets: 0,
      };
      row.occurrences++;
      row.plannedSets += item.prescription.sets ?? 0;
      if (entry.status === "done" || entry.status === "partial")
        row.completedWorkSets += entry.sets.filter(
          (s) => s.itemRef === item.ref && s.done && s.setKind === "work",
        ).length;
      exercises.set(key, row);
    }
  }
  const categories = new Map<string, TrainingAnalysis["categories"][number]>();
  for (const item of exercises.values()) {
    const row = categories.get(item.category) ?? {
      category: item.category,
      occurrences: 0,
      plannedSets: 0,
      completedWorkSets: 0,
    };
    row.occurrences += item.occurrences;
    row.plannedSets += item.plannedSets;
    row.completedWorkSets += item.completedWorkSets;
    categories.set(item.category, row);
  }
  return trainingAnalysisResponse.parse({
    from: query.from,
    to: query.to,
    previousFrom,
    previousTo,
    phase,
    classification: analyzeExerciseClassification(current.map((row) => row.entry)),
    athleteCount: historicalPhase ? scope.athleteIds.size : athletes.length,
    healthVisible: healthIds.length > 0,
    totals: totals(current),
    previous: totals(scope.previous),
    weeks,
    exercises: [...exercises.values()].sort(
      (a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "fr"),
    ),
    categories: [...categories.values()].sort((a, b) => b.occurrences - a.occurrences),
    diversity28Days: {
      from: diversityFrom,
      to: query.to,
      distinctExercises: distinct28.size,
      occurrences: occurrences28,
      unidentifiedItems,
    },
  });
}

export async function getTrainingAnalysisContext(userId: string, organizationId: string) {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { progressionEnabled: true, phasesEnabled: true },
  });
  if (!org.progressionEnabled) throw new AppError(409, "progression_disabled", m.progression.disabled);
  const ids = await visibleAthleteIds(access);
  const [athletes, groups] = await Promise.all([
    prisma.athlete.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.group.findMany({
      where: {
        organizationId,
        ...(access.role === "owner"
          ? {}
          : access.role === "athlete"
            ? { members: { some: { athleteId: access.athleteId! } } }
            : { id: { in: await coachGroupIds(access) } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const phases = org.phasesEnabled
    ? await prisma.trainingPhase.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [{ groupId: { in: groups.map((g) => g.id) } }, { athleteId: { in: ids } }],
          ...(["athlete", "assistant"].includes(access.role) ? { publishedAt: { not: null } } : {}),
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          group: { select: { name: true } },
          athlete: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ startDate: "desc" }, { id: "asc" }],
      })
    : [];
  // Expand the coach's analysis window to include recorded references even after phase dates change.
  // Public views only use the shared period; private references must not influence their bounds.
  const ranges =
    (access.role === "owner" || access.role === "coach") && phases.length && ids.length
      ? await prisma.$queryRaw<{ phaseId: string; first: Date; last: Date }[]>(Prisma.sql`
        SELECT p.phase_id AS "phaseId", MIN(s.date) AS first, MAX(s.date) AS last
        FROM session_prescriptions p JOIN scheduled_sessions s ON s.id = p.scheduled_session_id
        WHERE s.organization_id = ${organizationId}::uuid AND s.published_at IS NOT NULL
          AND p.phase_id IN (${Prisma.join(phases.map((phase) => Prisma.sql`${phase.id}::uuid`))})
          AND p.athlete_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        GROUP BY p.phase_id
      `)
      : [];
  const rangeByPhase = new Map(ranges.map((row) => [row.phaseId, row]));
  return trainingAnalysisContext.parse({
    today: todayIso(),
    groups,
    athletes: athletes.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
    phases: phases.map((p) => ({
      id: p.id,
      name: p.name,
      targetName: p.group?.name ?? `${p.athlete?.firstName ?? ""} ${p.athlete?.lastName ?? ""}`.trim(),
      startDate: fromDbDate(
        rangeByPhase.get(p.id)?.first && rangeByPhase.get(p.id)!.first < p.startDate
          ? rangeByPhase.get(p.id)!.first
          : p.startDate,
      ),
      endDate: fromDbDate(
        rangeByPhase.get(p.id)?.last && rangeByPhase.get(p.id)!.last > p.endDate
          ? rangeByPhase.get(p.id)!.last
          : p.endDate,
      ),
    })),
  });
}
