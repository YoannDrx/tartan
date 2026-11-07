import { detailedSetInput } from "@tartan/contracts";
import { addDays, actualSetVolumes, sessionLoad, startOfWeek, toCsv, weekTrendPct } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireVisibleAthlete, visibleAthleteIds } from "./access";
import { consentForAthletes } from "./consent.service";

export type WeekStat = {
  weekStart: string;
  load: number | null;
  sessions: number;
  done: number;
  jumps: number;
  groundContacts: number | null;
  tonnageKg: number | null;
  distanceM: number | null;
  durationS: number | null;
  coverage: { detailedSessions: number; completedWorkSets: number; tonnageKnownSets: number; loadResponses: number };
};

// Charge et volumes par semaine (§ 7.9). Aide à la décision : l'interface n'affiche aucun risque calculé.
export const athleteWeeklyStats = async (
  userId: string,
  organizationId: string,
  athleteId: string,
  weeks = 8,
  now: Date = new Date(),
) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (access.role === "athlete") {
    if (access.athleteId !== athleteId) throw forbidden();
  } else {
    await requireVisibleAthlete(access, athleteId);
  }
  const firstWeek = addDays(startOfWeek(todayIso(now)), -7 * (weeks - 1));
  const [logs, jumps, consent] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { athleteId, session: { date: { gte: toDbDate(firstWeek) }, organizationId } },
      select: {
        status: true,
        rpe: true,
        durationMin: true,
        variantDone: true,
        prescriptionSnapshot: true,
        sets: true,
        session: {
          select: {
            date: true,
          },
        },
      },
    }),
    prisma.jumpAttempt.findMany({
      where: { athleteId, createdAt: { gte: toDbDate(firstWeek) } },
      select: { createdAt: true },
    }),
    consentForAthletes([athleteId]),
  ]);
  const health = consent.get(athleteId)?.health ?? false;
  const series = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7));
  const stats = new Map<string, WeekStat>(
    series.map((weekStart) => [
      weekStart,
      {
        weekStart,
        load: null,
        sessions: 0,
        done: 0,
        jumps: 0,
        groundContacts: null,
        tonnageKg: null,
        distanceM: null,
        durationS: null,
        coverage: { detailedSessions: 0, completedWorkSets: 0, tonnageKnownSets: 0, loadResponses: 0 },
      },
    ]),
  );
  for (const entry of logs) {
    const week = stats.get(startOfWeek(fromDbDate(entry.session.date)));
    if (!week) continue;
    week.sessions += 1;
    if (entry.status !== "done" && entry.status !== "partial") continue;
    week.done += 1;
    // Effort ressenti : donnée de santé, absente sans consentement.
    const load = health ? sessionLoad(entry.rpe, entry.durationMin) : null;
    if (load !== null) {
      week.load = (week.load ?? 0) + load;
      week.coverage.loadResponses++;
    }
    if (entry.prescriptionSnapshot) week.coverage.detailedSessions++;
    const realized = entry.sets.flatMap((set) => {
      const parsed = detailedSetInput.safeParse({
        ...set,
        loadKg: set.loadKg === null ? null : Number(set.loadKg),
        distanceM: set.distanceM === null ? null : Number(set.distanceM),
        timeS: set.timeS === null ? null : Number(set.timeS),
      });
      return parsed.success ? [parsed.data] : [];
    });
    const volumes = actualSetVolumes(realized);
    for (const key of ["groundContacts", "tonnageKg", "distanceM", "durationS"] as const) {
      if (volumes[key] !== null) week[key] = (week[key] ?? 0) + volumes[key];
    }
    week.coverage.completedWorkSets += volumes.completedWorkSets;
    week.coverage.tonnageKnownSets += volumes.tonnageKnownSets;
  }
  for (const jump of jumps) {
    const week = stats.get(startOfWeek(fromDbDate(jump.createdAt)));
    if (week) week.jumps += 1;
  }
  const rows = [...stats.values()];
  return { weeks: rows, loadTrendPct: health ? weekTrendPct(rows.map((w) => w.load)) : null, healthVisible: health };
};

const STATUS = m.status as Record<string, string>;

// Export CSV du suivi d'un groupe ou d'un athlète (§ 7.8). Effort et douleur restent soumis au consentement.
export const exportTrackingCsv = async (
  userId: string,
  organizationId: string,
  query: { from: string; to: string; athleteId?: string; groupId?: string },
): Promise<string> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (access.role === "athlete") throw forbidden();
  const visible = await visibleAthleteIds(access);
  const inGroup = query.groupId
    ? await prisma.groupMember.findMany({ where: { groupId: query.groupId }, select: { athleteId: true } })
    : null;
  const athleteIds = visible.filter(
    (id) =>
      (!query.athleteId || id === query.athleteId) && (!inGroup || inGroup.some((member) => member.athleteId === id)),
  );
  const logs = await prisma.sessionLog.findMany({
    where: {
      athleteId: { in: athleteIds },
      session: { organizationId, date: { gte: toDbDate(query.from), lte: toDbDate(query.to) } },
    },
    orderBy: [{ session: { date: "asc" } }],
    select: {
      athleteId: true,
      status: true,
      variantDone: true,
      rpe: true,
      durationMin: true,
      comment: true,
      athlete: { select: { firstName: true, lastName: true } },
      session: { select: { date: true, title: true, type: true } },
    },
  });
  const consents = await consentForAthletes(athleteIds);
  return toCsv(
    ["Date", "Athlète", "Séance", "Type", "Statut", "Version", "Effort", "Durée (min)", "Commentaire"],
    logs.map((l) => [
      fromDbDate(l.session.date),
      `${l.athlete.firstName} ${l.athlete.lastName}`,
      l.session.title,
      m.sessionType[l.session.type],
      STATUS[l.status] ?? l.status,
      l.variantDone ? m.variant[l.variantDone] : null,
      consents.get(l.athleteId)?.health ? l.rpe : null,
      l.durationMin,
      l.comment,
    ]),
  );
};
