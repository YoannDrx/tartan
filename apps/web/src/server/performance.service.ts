import { createHash } from "node:crypto";
import {
  performanceEntry,
  performanceInput,
  updatePerformanceInput,
  type PerformanceInput,
  type UpdatePerformanceInput,
} from "@tartan/contracts";
import { athleticRecordStates, performanceRule } from "@tartan/domain";
import { m } from "@tartan/i18n";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { AppError, forbidden, notFound, invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireOwnedRefs, requireVisibleAthlete } from "./access";

export const performanceSelect = {
  id: true,
  discipline: true,
  mark: true,
  unit: true,
  wind: true,
  date: true,
  location: true,
  competitionId: true,
  measurementType: true,
  recordDirection: true,
  comparisonContext: true,
  version: true,
  createdAt: true,
} as const satisfies Prisma.PerformanceSelect;
type Row = Prisma.PerformanceGetPayload<{ select: typeof performanceSelect }>;
const recordStates = (rows: Row[]) =>
  athleticRecordStates(
    rows.map((r) => ({ ...r, mark: Number(r.mark), date: fromDbDate(r.date), createdAt: r.createdAt.toISOString() })),
  );
export const performanceDtos = (rows: Row[]) => {
  const states = recordStates(rows);
  return rows.map((row) => {
    const state = states.get(row.id);
    const known = row.unit === "s" || row.unit === "m" || row.unit === "cm";
    return performanceEntry.parse({
      id: row.id,
      discipline: row.discipline,
      mark: Number(row.mark),
      unit: row.unit,
      wind: row.wind === null ? null : Number(row.wind),
      date: fromDbDate(row.date),
      location: row.location,
      competitionId: row.competitionId,
      version: row.version,
      comparisonContext: row.comparisonContext,
      measurementType: row.measurementType ?? (known ? (row.unit === "s" ? "time" : "distance") : null),
      recordDirection: row.recordDirection ?? (known ? (row.unit === "s" ? "lower" : "higher") : null),
      isPb: state?.isPb ?? false,
      isBaseline: state?.isBaseline ?? false,
    });
  });
};
const conflict = () => new AppError(409, "performance_conflict", m.performances.conflict);
const dataFor = (input: PerformanceInput | UpdatePerformanceInput) => ({
  discipline: input.discipline,
  mark: input.mark,
  unit: input.unit,
  ...performanceRule(input),
  comparisonContext: input.comparisonContext ?? "",
  wind: input.wind ?? null,
  date: toDbDate(input.date),
  location: input.location ?? null,
  competitionId: input.competitionId ?? null,
});
const recompute = async (tx: Prisma.TransactionClient, organizationId: string, athleteId: string) => {
  const rows = await tx.performance.findMany({ where: { organizationId, athleteId }, select: performanceSelect });
  const best = [...recordStates(rows).keys()];
  // Compatibilité du stockage historique : is_pb désigne la meilleure valeur, y compris la référence initiale.
  // Les DTO exposent séparément référence initiale et record amélioré.
  await tx.performance.updateMany({ where: { organizationId, athleteId }, data: { isPb: false } });
  if (best.length)
    await tx.performance.updateMany({ where: { organizationId, athleteId, id: { in: best } }, data: { isPb: true } });
};
export const addPerformance = async (userId: string, organizationId: string, raw: PerformanceInput) => {
  const parsed = performanceInput.safeParse(raw);
  if (!parsed.success) throw invalid(m.performances.invalid);
  const input = parsed.data;
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, input.athleteId);
  await requireOwnedRefs(organizationId, { competitionId: input.competitionId });
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(dataFor(input)))
      .digest("hex");
    if (input.clientId) {
      const prior = await tx.performanceCreation.findUnique({
        where: { id: input.clientId },
        include: { performance: { select: { id: true, version: true } } },
      });
      if (prior) {
        if (
          prior.organizationId !== organizationId ||
          prior.athleteId !== input.athleteId ||
          prior.fingerprint !== fingerprint ||
          !prior.performance
        )
          throw conflict();
        // Un rejeu de création ne réécrit jamais une correction ultérieure.
        return prior.performance;
      }
    }
    const row = await tx.performance.create({
      data: { ...dataFor(input), organizationId, athleteId: input.athleteId },
    });
    if (input.clientId)
      await tx.performanceCreation.create({
        data: { id: input.clientId, organizationId, athleteId: input.athleteId, performanceId: row.id, fingerprint },
      });
    await recompute(tx, organizationId, input.athleteId);
    return { id: row.id, version: row.version };
  });
};
export const updatePerformance = async (userId: string, organizationId: string, raw: UpdatePerformanceInput) => {
  const parsed = updatePerformanceInput.safeParse(raw);
  if (!parsed.success) throw invalid(m.performances.invalid);
  const input = parsed.data;
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, input.athleteId);
  await requireOwnedRefs(organizationId, { competitionId: input.competitionId });
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const prior = await tx.performance.findFirst({
      where: { id: input.id, organizationId, athleteId: input.athleteId },
    });
    if (!prior) throw notFound();
    if (prior.version !== input.expectedVersion) throw conflict();
    const row = await tx.performance.update({
      where: { id: prior.id },
      data: { ...dataFor(input), version: { increment: 1 } },
    });
    await recompute(tx, organizationId, input.athleteId);
    return { id: row.id, version: row.version };
  });
};
export const deletePerformance = async (
  userId: string,
  organizationId: string,
  id: string,
  expectedVersion?: number,
  athleteId?: string,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  const row = await prisma.performance.findFirst({
    where: { id, organizationId, ...(athleteId ? { athleteId } : {}) },
  });
  if (!row) throw notFound();
  await requireVisibleAthlete(access, row.athleteId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const current = await tx.performance.findFirst({
      where: { id, organizationId, ...(athleteId ? { athleteId } : {}) },
    });
    if (!current) throw notFound();
    if (current.version !== (expectedVersion ?? 1)) throw conflict();
    await tx.performance.delete({ where: { id } });
    await recompute(tx, organizationId, current.athleteId);
    return { athleteId: current.athleteId };
  });
};

// La carte de record : ce que l'image partagée montre, et rien d'autre. Le prénom, la discipline, la marque et la
// date ; ni lieu, ni vent, ni aucune donnée de santé. Seul un record battu a sa carte. L'athlète lit la sienne,
// ses coachs celles des athlètes qu'ils suivent.
export const performanceCard = async (
  userId: string,
  organizationId: string,
  athleteId: string,
  performanceId: string,
) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (access.role === "athlete") {
    if (access.athleteId !== athleteId) throw forbidden();
  } else {
    await requireVisibleAthlete(access, athleteId);
  }
  const [athlete, rows] = await Promise.all([
    prisma.athlete.findFirst({ where: { id: athleteId, organizationId }, select: { firstName: true } }),
    prisma.performance.findMany({ where: { organizationId, athleteId }, select: performanceSelect }),
  ]);
  const entry = performanceDtos(rows).find((row) => row.id === performanceId);
  // La référence initiale (la première marque) n'est pas un record : seul un progrès a sa carte.
  if (!athlete || !entry?.isPb || entry.isBaseline) throw notFound();
  return {
    firstName: athlete.firstName,
    discipline: entry.discipline,
    mark: entry.mark,
    unit: entry.unit,
    date: entry.date,
  };
};
