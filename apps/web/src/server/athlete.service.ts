import {
  athleteInput,
  type AthleteInput,
  type InjuryInput,
  performanceInput,
  type StrengthTestInput,
} from "@tartan/contracts";
import { can } from "@tartan/domain";
import type { z } from "zod";
import { fromDbDate, fromDbDateOrNull, toDbDate } from "@/lib/dates";
import { consentRequired, forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  audit,
  coachGroupIds,
  requireGroupInScope,
  requireOrgMember,
  requireVisibleAthlete,
  visibleAthleteIds,
  type Access,
} from "./access";
import { assertWithinPlan } from "./billing.service";
import { consentForAthletes } from "./consent.service";
import { namesFor } from "./me.service";

export const listAthletes = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const ids = await visibleAthleteIds(access);
  const rows = await prisma.athlete.findMany({
    where: { id: { in: ids } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      level: true,
      groups: { select: { group: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    hasAccount: a.userId !== null,
    level: a.level,
    groups: a.groups.map((g) => g.group),
  }));
};

export const saveAthlete = async (userId: string, organizationId: string, raw: AthleteInput) => {
  const input = athleteInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  if (input.id) await requireVisibleAthlete(access, input.id);
  const existingGroups = input.id
    ? await prisma.groupMember.findMany({ where: { athleteId: input.id }, select: { groupId: true } })
    : [];
  // Un coach peut conserver les groupes d'un collègue, mais jamais y ajouter un athlète.
  await requireGroupInScope(
    access,
    input.groupIds.filter((id) => !existingGroups.some((group) => group.groupId === id)),
  );
  const editableGroups = access.role === "owner" ? null : await coachGroupIds(access);
  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: input.birthDate ? toDbDate(input.birthDate) : null,
    disciplines: input.disciplines,
    level: input.level ?? null,
    takeoffFoot: input.takeoffFoot ?? null,
    approachSteps: input.approachSteps ?? null,
    goals: input.goals ?? null,
    particularities: input.particularities ?? null,
  };
  if (input.id) {
    await prisma.$transaction(async (tx) => {
      await tx.athlete.update({ where: { id: input.id }, data });
      await tx.groupMember.deleteMany({
        where: {
          athleteId: input.id,
          groupId: { notIn: input.groupIds, ...(editableGroups ? { in: editableGroups } : {}) },
        },
      });
      if (input.groupIds.length) {
        await tx.groupMember.createMany({
          data: input.groupIds.map((groupId) => ({ groupId, athleteId: input.id as string })),
          skipDuplicates: true,
        });
      }
    });
    return { id: input.id };
  }
  await assertWithinPlan(organizationId, "maxAthletes");
  const created = await prisma.athlete.create({
    data: {
      ...data,
      organizationId,
      groups: { create: input.groupIds.map((groupId) => ({ groupId })) },
    },
  });
  return { id: created.id };
};

const healthVisible = async (access: Access, athleteId: string): Promise<boolean> => {
  const consent = await consentForAthletes([athleteId]);
  return Boolean(consent.get(athleteId)?.health);
};

const logHealthAccess = async (access: Access, athleteId: string): Promise<void> => {
  // Accès aux données de santé journalisés pour les coachs (§ 15.2).
  if (access.athleteId === athleteId) return;
  await audit({
    organizationId: access.organizationId,
    actorId: access.userId,
    action: "health_read",
    entity: "athlete",
    entityId: athleteId,
  });
};

// Fiche complète pour le staff. Les notes privées ne sont lues que si le rôle y a droit.
export const getAthleteFile = async (userId: string, organizationId: string, athleteId: string) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  await requireVisibleAthlete(access, athleteId);
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      disciplines: true,
      level: true,
      takeoffFoot: true,
      approachSteps: true,
      goals: true,
      particularities: true,
      userId: true,
      groups: { select: { group: { select: { id: true, name: true } } } },
      tests: { orderBy: { date: "desc" } },
      performances: { orderBy: { date: "desc" } },
    },
  });
  if (!athlete) throw notFound();
  const showHealth = await healthVisible(access, athleteId);
  const injuries =
    showHealth && can(access.role, "viewInjuries")
      ? await prisma.injury.findMany({ where: { athleteId }, orderBy: { startDate: "desc" } })
      : [];
  if (showHealth) await logHealthAccess(access, athleteId);
  const canReadNotes = can(access.role, "privateNotes");
  const notes = canReadNotes
    ? await prisma.coachNote.findMany({
        where: { athleteId, ...(access.role === "owner" ? {} : { authorId: userId }) },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const authors = await namesFor(notes.map((n) => n.authorId));
  const history = await prisma.sessionLog.findMany({
    where: { athleteId },
    orderBy: { session: { date: "desc" } },
    take: 30,
    select: {
      id: true,
      status: true,
      rpe: true,
      variantDone: true,
      session: { select: { id: true, title: true, date: true, type: true } },
    },
  });
  return {
    id: athlete.id,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    birthDate: fromDbDateOrNull(athlete.birthDate),
    disciplines: athlete.disciplines,
    level: athlete.level,
    takeoffFoot: athlete.takeoffFoot,
    approachSteps: athlete.approachSteps,
    goals: athlete.goals,
    particularities: athlete.particularities,
    hasAccount: athlete.userId !== null,
    groups: athlete.groups.map((g) => g.group),
    tests: athlete.tests.map((t) => ({
      id: t.id,
      exerciseKey: t.exerciseKey,
      value: Number(t.value),
      unit: t.unit,
      kind: t.kind,
      date: fromDbDate(t.date),
    })),
    performances: athlete.performances.map((p) => ({
      id: p.id,
      discipline: p.discipline,
      mark: Number(p.mark),
      unit: p.unit,
      wind: p.wind === null ? null : Number(p.wind),
      date: fromDbDate(p.date),
      location: p.location,
      isPb: p.isPb,
    })),
    healthVisible: showHealth,
    canEditInjuries: can(access.role, "editInjuries"),
    injuries: injuries.map((i) => ({
      id: i.id,
      bodyArea: i.bodyArea,
      side: i.side,
      description: i.description,
      startDate: fromDbDate(i.startDate),
      endDate: fromDbDateOrNull(i.endDate),
      status: i.status,
      restrictions: i.restrictions,
    })),
    canWriteNotes: canReadNotes,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorName: authors.get(n.authorId) ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    history: history.map((h) => ({
      id: h.id,
      status: h.status,
      rpe: showHealth ? h.rpe : null,
      variant: h.variantDone,
      sessionId: h.session.id,
      title: h.session.title,
      date: fromDbDate(h.session.date),
      type: h.session.type,
    })),
  };
};

// Vue athlète : sélection dédiée, jamais le modèle complet ni les notes du coach (§ 11.4).
export const getMyFile = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId);
  if (!access.athleteId) throw forbidden();
  const athlete = await prisma.athlete.findUnique({
    where: { id: access.athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      goals: true,
      particularities: true,
      takeoffFoot: true,
      approachSteps: true,
      tests: { orderBy: { date: "desc" }, select: { exerciseKey: true, value: true, kind: true, date: true } },
      performances: {
        orderBy: { date: "desc" },
        select: { discipline: true, mark: true, unit: true, date: true, location: true, isPb: true },
      },
    },
  });
  if (!athlete) throw notFound();
  const showHealth = await healthVisible(access, athlete.id);
  const injuries = showHealth
    ? await prisma.injury.findMany({
        where: { athleteId: athlete.id },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          bodyArea: true,
          side: true,
          status: true,
          startDate: true,
          endDate: true,
          restrictions: true,
          description: true,
        },
      })
    : [];
  return {
    ...athlete,
    tests: athlete.tests.map((t) => ({ ...t, value: Number(t.value), date: fromDbDate(t.date) })),
    performances: athlete.performances.map((p) => ({ ...p, mark: Number(p.mark), date: fromDbDate(p.date) })),
    healthVisible: showHealth,
    injuries: injuries.map((i) => ({ ...i, startDate: fromDbDate(i.startDate), endDate: fromDbDateOrNull(i.endDate) })),
  };
};

export const addStrengthTest = async (userId: string, organizationId: string, input: StrengthTestInput) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, input.athleteId);
  // Les charges étant calculées à la lecture depuis le dernier test, elles se recalculent d'elles-mêmes.
  await prisma.strengthTest.create({
    data: {
      organizationId,
      athleteId: input.athleteId,
      exerciseKey: input.exerciseKey,
      value: input.value,
      kind: input.kind,
      date: toDbDate(input.date),
    },
  });
};

export const addPerformance = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof performanceInput>,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, input.athleteId);
  const higherIsBetter = input.unit !== "s";
  const previous = await prisma.performance.findMany({
    where: { athleteId: input.athleteId, discipline: input.discipline },
    select: { mark: true },
  });
  const marks = previous.map((p) => Number(p.mark));
  const isPb =
    marks.length === 0 || (higherIsBetter ? input.mark > Math.max(...marks) : input.mark < Math.min(...marks));
  await prisma.performance.create({
    data: {
      organizationId,
      athleteId: input.athleteId,
      discipline: input.discipline,
      mark: input.mark,
      unit: input.unit,
      wind: input.wind ?? null,
      date: toDbDate(input.date),
      location: input.location ?? null,
      competitionId: input.competitionId ?? null,
      isPb,
    },
  });
};

export const saveInjury = async (userId: string, organizationId: string, input: InjuryInput) => {
  const access = await requireOrgMember(userId, organizationId, "editInjuries");
  if (access.role === "athlete") {
    if (access.athleteId !== input.athleteId) throw forbidden();
  } else {
    await requireVisibleAthlete(access, input.athleteId);
  }
  if (!(await healthVisible(access, input.athleteId))) throw consentRequired();
  const data = {
    bodyArea: input.bodyArea,
    side: input.side,
    description: input.description ?? null,
    startDate: toDbDate(input.startDate),
    endDate: input.endDate ? toDbDate(input.endDate) : null,
    status: input.status,
    restrictions: input.restrictions ?? null,
  };
  if (input.id) {
    const existing = await prisma.injury.findFirst({
      where: { id: input.id, athleteId: input.athleteId, organizationId },
    });
    if (!existing) throw notFound();
    await prisma.injury.update({ where: { id: input.id }, data });
  } else {
    await prisma.injury.create({ data: { ...data, organizationId, athleteId: input.athleteId } });
  }
  await audit({
    organizationId,
    actorId: userId,
    action: "injury_saved",
    entity: "athlete",
    entityId: input.athleteId,
  });
};

export const addCoachNote = async (userId: string, organizationId: string, athleteId: string, body: string) => {
  const access = await requireOrgMember(userId, organizationId, "privateNotes");
  await requireVisibleAthlete(access, athleteId);
  await prisma.coachNote.create({ data: { organizationId, athleteId, authorId: userId, body } });
};

export const activeInjuriesByAthlete = async (athleteIds: string[]): Promise<Map<string, string>> => {
  const rows = await prisma.injury.findMany({
    where: { athleteId: { in: athleteIds }, status: { in: ["active", "recovering"] } },
    select: { athleteId: true, bodyArea: true },
    orderBy: { startDate: "desc" },
  });
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.athleteId)) map.set(r.athleteId, r.bodyArea);
  return map;
};
