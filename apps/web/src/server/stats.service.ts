import { sessionSnapshot } from "@tartan/contracts";
import {
  addDays,
  addPrescriptionVolumes,
  applyOverride,
  blocksForVariant,
  emptyVolumes,
  resolveLoadKg,
  sessionLoad,
  startOfWeek,
  type StrengthTest,
  toCsv,
  weekTrendPct,
  type WeekVolumes,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireVisibleAthlete, visibleAthleteIds } from "./access";
import { consentForAthletes } from "./consent.service";

export type WeekStat = { weekStart: string; load: number | null; sessions: number; done: number } & WeekVolumes;

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
  const [logs, testRows, jumps, consent] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { athleteId, session: { date: { gte: toDbDate(firstWeek) }, organizationId } },
      select: {
        status: true,
        rpe: true,
        durationMin: true,
        variantDone: true,
        session: {
          select: {
            date: true,
            snapshot: true,
            overrides: { where: { athleteId }, select: { itemRef: true, prescription: true } },
          },
        },
      },
    }),
    prisma.strengthTest.findMany({ where: { athleteId } }),
    prisma.jumpAttempt.findMany({
      where: { athleteId, createdAt: { gte: toDbDate(firstWeek) } },
      select: { createdAt: true },
    }),
    consentForAthletes([athleteId]),
  ]);
  const health = consent.get(athleteId)?.health ?? false;
  const tests: StrengthTest[] = testRows.map((t) => ({
    exerciseKey: t.exerciseKey,
    value: Number(t.value),
    kind: t.kind,
    date: fromDbDate(t.date),
  }));
  const series = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7));
  const stats = new Map<string, WeekStat>(
    series.map((weekStart) => [weekStart, { weekStart, load: null, sessions: 0, done: 0, ...emptyVolumes() }]),
  );
  for (const entry of logs) {
    const week = stats.get(startOfWeek(fromDbDate(entry.session.date)));
    if (!week) continue;
    week.sessions += 1;
    if (entry.status !== "done" && entry.status !== "partial") continue;
    week.done += 1;
    // Effort ressenti : donnée de santé, absente sans consentement.
    const load = health ? sessionLoad(entry.rpe, entry.durationMin) : null;
    if (load !== null) week.load = (week.load ?? 0) + load;
    const parsed = sessionSnapshot.safeParse(entry.session.snapshot);
    if (!parsed.success) continue;
    const overrides = new Map(entry.session.overrides.map((o) => [o.itemRef, o.prescription as object]));
    const factor = entry.status === "partial" ? 0.5 : 1;
    let volumes = emptyVolumes();
    for (const block of blocksForVariant(parsed.data.blocks, entry.variantDone ?? "club")) {
      for (const item of block.items) {
        const p = applyOverride(item.prescription, overrides.get(item.ref));
        volumes = addPrescriptionVolumes(volumes, p, resolveLoadKg(p, tests));
      }
    }
    week.groundContacts += Math.round(volumes.groundContacts * factor);
    week.tonnageKg += Math.round(volumes.tonnageKg * factor);
    week.distanceM += Math.round(volumes.distanceM * factor);
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
