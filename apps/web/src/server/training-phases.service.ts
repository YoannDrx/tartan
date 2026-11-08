import { createHash } from "node:crypto";
import { phasePlanningQuery, phasePlanningResponse, type PhasePlanningQuery } from "@tartan/contracts";
import { resolveTrainingPhase } from "@tartan/domain";
import {
  saveTrainingPhaseInput,
  trainingPhaseQuery,
  trainingPhaseSummary,
  trainingPhaseVisibilityInput,
  trainingPhaseVersion,
  type SaveTrainingPhaseInput,
  type TrainingPhaseQuery,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, toDbDate, todayIso } from "@/lib/dates";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  coachGroupIds,
  requireGroupInScope,
  requireOrgMember,
  requireVisibleAthlete,
  visibleAthleteIds,
  type Access,
} from "./access";

type Target = SaveTrainingPhaseInput["target"];
const disabled = () => new AppError(409, "phases_disabled", m.trainingPhases.disabled);
const conflict = () => new AppError(409, "phase_conflict", m.trainingPhases.conflict);
const ensureEnabled = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { phasesEnabled: true } });
  if (!org?.phasesEnabled) throw disabled();
};
const lockWriter = async (tx: Prisma.TransactionClient, userId: string, organizationId: string) => {
  const [org] = await tx.$queryRaw<
    { phases_enabled: boolean }[]
  >`SELECT phases_enabled FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
  if (!org?.phases_enabled) throw disabled();
  const member = await tx.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, status: true },
  });
  if (!member || member.status !== "active" || (member.role !== "owner" && member.role !== "coach")) throw forbidden();
  return member.role;
};
const requireTarget = async (
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  role: string,
  target: Target,
) => {
  if (target.type === "group") {
    if (!(await tx.group.count({ where: { id: target.id, organizationId } }))) throw notFound();
    if (role !== "owner" && !(await tx.groupCoach.count({ where: { userId, groupId: target.id } }))) throw forbidden();
  } else {
    if (!(await tx.athlete.count({ where: { id: target.id, organizationId } }))) throw notFound();
    if (
      role !== "owner" &&
      !(await tx.groupMember.count({
        where: { athleteId: target.id, group: { organizationId, coaches: { some: { userId } } } },
      }))
    )
      throw forbidden();
  }
};
const targetOf = (row: { groupId: string | null; athleteId: string | null }): Target =>
  row.groupId ? { type: "group", id: row.groupId } : { type: "athlete", id: row.athleteId! };
const activity = async (
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  phaseId: string,
  action: string,
) => {
  await tx.organization.update({ where: { id: organizationId }, data: { lastBusinessActivityAt: new Date() } });
  await tx.auditLog.create({
    data: { actorId: userId, organizationId, action, entity: "training_phase", entityId: phaseId },
  });
};

// Projection publique dédiée : jamais private_note, même pour calculer une priorité.
export const publicTrainingPhaseSelect = {
  id: true,
  groupId: true,
  athleteId: true,
  name: true,
  kind: true,
  startDate: true,
  endDate: true,
  objective: true,
  description: true,
  publishedAt: true,
  version: true,
  group: { select: { name: true } },
  athlete: { select: { firstName: true, lastName: true } },
} as const satisfies Prisma.TrainingPhaseSelect;
type PublicRow = Prisma.TrainingPhaseGetPayload<{ select: typeof publicTrainingPhaseSelect }>;
const dto = (row: PublicRow & { privateNote?: string }) =>
  trainingPhaseSummary.parse({
    id: row.id,
    target: targetOf(row),
    targetName: row.group?.name ?? [row.athlete?.firstName, row.athlete?.lastName].filter(Boolean).join(" "),
    name: row.name,
    kind: row.kind,
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
    objective: row.objective,
    description: row.description,
    shared: row.publishedAt !== null,
    version: row.version,
    ...(row.privateNote !== undefined ? { privateNote: row.privateNote } : {}),
  });
const scopeFor = async (access: Access, query: TrainingPhaseQuery) => {
  if (query.groupId) {
    if (access.role === "athlete") {
      if (
        !(await prisma.groupMember.count({
          where: {
            athleteId: access.athleteId!,
            groupId: query.groupId,
            group: { organizationId: access.organizationId },
          },
        }))
      )
        throw forbidden();
    } else await requireGroupInScope(access, [query.groupId]);
  }
  const athleteId = access.role === "athlete" ? access.athleteId : query.athleteId;
  if (access.role === "athlete" && (!athleteId || (query.athleteId && query.athleteId !== athleteId)))
    throw forbidden();
  if (athleteId) {
    await requireVisibleAthlete(access, athleteId);
    const memberships = await prisma.groupMember.findMany({
      where: { athleteId, group: { organizationId: access.organizationId } },
      select: { groupId: true },
    });
    if (query.groupId && !memberships.some((r) => r.groupId === query.groupId)) throw forbidden();
    const allowedGroups = access.role === "owner" || access.role === "athlete" ? null : await coachGroupIds(access);
    return {
      OR: [
        { athleteId },
        {
          groupId: {
            in: memberships
              .map((r) => r.groupId)
              .filter(
                (id) => (!allowedGroups || allowedGroups.includes(id)) && (!query.groupId || id === query.groupId),
              ),
          },
        },
      ],
    };
  }
  const groups = query.groupId
    ? [query.groupId]
    : access.role === "owner"
      ? (await prisma.group.findMany({ where: { organizationId: access.organizationId }, select: { id: true } })).map(
          (r) => r.id,
        )
      : await coachGroupIds(access);
  const athletes = query.groupId
    ? (await prisma.groupMember.findMany({ where: { groupId: query.groupId }, select: { athleteId: true } })).map(
        (r) => r.athleteId,
      )
    : await visibleAthleteIds(access);
  return { OR: [{ groupId: { in: groups } }, { athleteId: { in: athletes } }] };
};
export const listTrainingPhases = async (userId: string, organizationId: string, raw: TrainingPhaseQuery) => {
  const parsed = trainingPhaseQuery.safeParse(raw);
  if (!parsed.success) throw invalid(m.trainingPhases.invalid);
  const query = parsed.data;
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  await ensureEnabled(organizationId);
  const canManage = access.role === "owner" || access.role === "coach";
  const where = {
    organizationId,
    deletedAt: null,
    startDate: { lte: toDbDate(query.to) },
    endDate: { gte: toDbDate(query.from) },
    ...(await scopeFor(access, query)),
    ...(!canManage ? { publishedAt: { not: null } } : {}),
  } satisfies Prisma.TrainingPhaseWhereInput;
  const orderBy = [{ startDate: "asc" as const }, { id: "asc" as const }];
  const rows = canManage
    ? await prisma.trainingPhase.findMany({
        where,
        orderBy,
        select: { ...publicTrainingPhaseSelect, privateNote: true },
      })
    : await prisma.trainingPhase.findMany({ where, orderBy, select: publicTrainingPhaseSelect });
  return { canManage, phases: rows.map(dto) };
};
export const getTrainingPhaseContext = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await ensureEnabled(organizationId);
  return loadPhaseTargets(access);
};
const loadPhaseTargets = async (access: Access) => {
  const { organizationId } = access;
  const groups = await prisma.group.findMany({
    where: { organizationId, ...(access.role !== "owner" ? { id: { in: await coachGroupIds(access) } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const athletes = await prisma.athlete.findMany({
    where: { organizationId, id: { in: await visibleAthleteIds(access) } },
    select: { id: true, firstName: true, lastName: true, groups: { select: { groupId: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return {
    groups,
    athletes: athletes.map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      groupIds: a.groups.map((g) => g.groupId).filter((id) => groups.some((g) => g.id === id)),
    })),
  };
};

export const getPhasePlanning = async (userId: string, organizationId: string, raw: PhasePlanningQuery) => {
  const parsed = phasePlanningQuery.safeParse(raw);
  if (!parsed.success) throw invalid(m.trainingPhases.invalid);
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  await ensureEnabled(organizationId);
  const input = parsed.data;
  const context = await loadPhaseTargets(access);
  const groupIds = new Set(input.groupIds);
  const athleteIds = new Set(input.athleteIds);
  if (
    input.groupIds.some((id) => !context.groups.some((group) => group.id === id)) ||
    input.athleteIds.some((id) => !context.athletes.some((athlete) => athlete.id === id))
  )
    throw forbidden();
  const memberships = await prisma.groupMember.findMany({
    where: { athleteId: { in: context.athletes.map((a) => a.id) }, groupId: { in: context.groups.map((g) => g.id) } },
    select: { athleteId: true, groupId: true, createdAt: true },
  });
  const datedAthletes = context.athletes.map((a) => ({
    ...a,
    groupIds: memberships
      .filter((member) => member.athleteId === a.id && todayIso(member.createdAt) <= input.date)
      .map((member) => member.groupId),
  }));
  const athletes = datedAthletes.filter((a) => athleteIds.has(a.id) || a.groupIds.some((id) => groupIds.has(id)));
  const groups = context.groups.filter((g) => groupIds.has(g.id));
  for (const choice of input.choices) {
    const athlete = athletes.find((a) => a.id === choice.athleteId);
    if (!athlete?.groupIds.includes(choice.groupId)) throw forbidden();
  }
  const relevantGroups = [...new Set([...groupIds, ...athletes.flatMap((a) => a.groupIds)])];
  const rows = await prisma.trainingPhase.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(access.role === "assistant" ? { publishedAt: { not: null } } : {}),
      startDate: { lte: toDbDate(input.date) },
      endDate: { gte: toDbDate(input.date) },
      OR: [{ groupId: { in: relevantGroups } }, { athleteId: { in: athletes.map((a) => a.id) } }],
    },
    select: publicTrainingPhaseSelect,
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  const phases = rows.map(dto);
  // Un choix périmé ne supprime pas silencieusement les autres phases disponibles.
  const choices = new Map(input.choices.map((c) => [c.athleteId, c.groupId]));
  return phasePlanningResponse.parse({
    date: input.date,
    groups: groups.map((g) => ({
      ...g,
      phase: phases.find((p) => p.target.type === "group" && p.target.id === g.id) ?? null,
    })),
    athletes: athletes.map((a) => {
      const selected = choices.get(a.id);
      if (selected && !phases.some((p) => p.target.type === "group" && p.target.id === selected)) throw conflict();
      return {
        id: a.id,
        name: a.name,
        result: resolveTrainingPhase(phases, {
          date: input.date,
          athleteId: a.id,
          groupIds: a.groupIds,
          selectedGroupId: selected,
        }),
      };
    }),
  });
};
export const saveTrainingPhase = async (userId: string, organizationId: string, raw: SaveTrainingPhaseInput) => {
  const parsed = saveTrainingPhaseInput.safeParse(raw);
  if (!parsed.success) throw invalid(m.trainingPhases.invalid);
  const input = parsed.data;
  await requireOrgMember(userId, organizationId, "manageAthletes");
  const data = {
    groupId: input.target.type === "group" ? input.target.id : null,
    athleteId: input.target.type === "athlete" ? input.target.id : null,
    name: input.name,
    kind: input.kind,
    startDate: toDbDate(input.startDate),
    endDate: toDbDate(input.endDate),
    objective: input.objective,
    description: input.description,
    privateNote: input.privateNote,
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return prisma.$transaction(async (tx) => {
    const role = await lockWriter(tx, userId, organizationId);
    await requireTarget(tx, userId, organizationId, role, input.target);
    const existing = await tx.trainingPhase.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.organizationId !== organizationId || existing.deletedAt) throw conflict();
      await requireTarget(tx, userId, organizationId, role, targetOf(existing));
      if (input.expectedVersion === 0) {
        if (existing.creationFingerprint !== fingerprint) throw conflict();
        return { id: existing.id, version: existing.version };
      }
      if (existing.version !== input.expectedVersion) throw conflict();
    } else if (input.expectedVersion !== 0) throw notFound();
    const overlap = await tx.trainingPhase.count({
      where: {
        organizationId,
        id: { not: input.id },
        deletedAt: null,
        groupId: data.groupId,
        athleteId: data.athleteId,
        startDate: { lte: data.endDate },
        endDate: { gte: data.startDate },
      },
    });
    if (overlap) throw new AppError(409, "phase_overlap", m.trainingPhases.overlap);
    const row = existing
      ? await tx.trainingPhase.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.trainingPhase.create({
          data: { ...data, id: input.id, organizationId, createdBy: userId, creationFingerprint: fingerprint },
        });
    await activity(tx, userId, organizationId, row.id, existing ? "phase_updated" : "phase_created");
    return { id: row.id, version: row.version };
  });
};
export const setTrainingPhaseVisibility = async (
  userId: string,
  organizationId: string,
  id: string,
  raw: { expectedVersion: number; shared: boolean },
) => {
  const input = trainingPhaseVisibilityInput.parse(raw);
  await requireOrgMember(userId, organizationId, "manageAthletes");
  return prisma.$transaction(async (tx) => {
    const role = await lockWriter(tx, userId, organizationId);
    const row = await tx.trainingPhase.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!row) throw notFound();
    await requireTarget(tx, userId, organizationId, role, targetOf(row));
    if (row.version !== input.expectedVersion) throw conflict();
    const saved = await tx.trainingPhase.update({
      where: { id },
      data: { publishedAt: input.shared ? new Date() : null, version: { increment: 1 } },
    });
    await activity(tx, userId, organizationId, id, input.shared ? "phase_shared" : "phase_private");
    return { id: saved.id, version: saved.version };
  });
};
export const deleteTrainingPhase = async (
  userId: string,
  organizationId: string,
  id: string,
  raw: { expectedVersion: number },
) => {
  const input = trainingPhaseVersion.parse(raw);
  await requireOrgMember(userId, organizationId, "manageAthletes");
  return prisma.$transaction(async (tx) => {
    const role = await lockWriter(tx, userId, organizationId);
    const row = await tx.trainingPhase.findFirst({ where: { id, organizationId } });
    if (!row) throw notFound();
    await requireTarget(tx, userId, organizationId, role, targetOf(row));
    if (row.deletedAt) return { id: row.id, version: row.version };
    if (row.version !== input.expectedVersion) throw conflict();
    const saved = await tx.trainingPhase.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        publishedAt: null,
        name: "",
        objective: "",
        description: "",
        privateNote: "",
        createdBy: null,
        creationFingerprint: "",
        version: { increment: 1 },
      },
    });
    await activity(tx, userId, organizationId, id, "phase_deleted");
    return { id: saved.id, version: saved.version };
  });
};
