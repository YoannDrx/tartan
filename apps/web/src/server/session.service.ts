import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  type CalendarResponse,
  type SaveScheduledSessionInput,
  type SessionDraft,
  type SessionSnapshot,
  prescriptionSchema,
  sessionDraft,
  sessionSnapshot,
} from "@tartan/contracts";
import {
  addDays,
  generateAutonomousBlocks,
  hasAutonomousVersion,
  withSessionRefs,
  hasUniqueSessionRefs,
  copyDraftWithNewRefs,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  requireOrgMember,
  requireVisibleAthlete,
  requireGroupInScope,
  visibleAthleteIds,
  coachGroupIds,
  type Access,
} from "./access";
import { activeAudienceIds, athleteAssignedWhere } from "./session-audience.service";
export { activeAudienceIds, audienceAthleteIds } from "./session-audience.service";
import { freezeSessionPrescriptions } from "./prescription.service";
import { mediaSnapshot } from "./exercise.service";
import { firstNameOf } from "./me.service";
import { notify, notifyPublications } from "./notify.service";

const sessionConflict = () => new AppError(409, "session_version_conflict", m.builder.versionConflict);

const requireAthletesInScope = async (access: Access, ids: string[]) => {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const count = await prisma.athlete.count({ where: { organizationId: access.organizationId, id: { in: unique } } });
  if (count !== unique.length) throw notFound();
  if (access.role === "owner") return;
  const visible = new Set(await visibleAthleteIds(access));
  if (!unique.every((id) => visible.has(id))) throw forbidden();
};

const requireSessionWrite = async (access: Access, sessionId: string) => {
  const session = await prisma.scheduledSession.findFirst({
    where: { id: sessionId, organizationId: access.organizationId },
  });
  if (!session) throw notFound();
  // Coach adjoint : seulement ses propres séances (§ 5.3).
  if (access.role === "assistant" && session.createdBy !== access.userId) throw forbidden();
  if (access.role !== "owner") {
    const assignments = await prisma.assignment.findMany({ where: { scheduledSessionId: sessionId } });
    if (assignments.length === 0 && session.createdBy !== access.userId) throw forbidden();
    await requireGroupInScope(
      access,
      assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
    );
    const overrides = await prisma.athleteOverride.findMany({
      where: { scheduledSessionId: sessionId },
      select: { athleteId: true },
    });
    await requireAthletesInScope(access, [
      ...assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
      ...overrides.map((o) => o.athleteId),
    ]);
  }
  return session;
};

// Copie exercices et médias : supprimer un exercice ne change pas les séances déjà planifiées.
export const buildSnapshot = async (organizationId: string, draft: SessionDraft): Promise<SessionSnapshot> => {
  if (!hasUniqueSessionRefs(draft)) throw invalid();
  const ids = draft.blocks.flatMap((b) => b.items.map((i) => i.exerciseId));
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: ids }, OR: [{ organizationId }, { organizationId: null }] },
    include: { media: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return sessionSnapshot.parse({
    title: draft.title,
    type: draft.type,
    durationMin: draft.durationMin,
    coachNote: draft.coachNote,
    blocks: draft.blocks.map((block, b) => ({
      ref: block.ref ?? `b${b}`,
      name: block.name,
      variant: block.variant,
      items: block.items.map((item, i) => {
        const exercise = byId.get(item.exerciseId);
        if (!exercise) throw notFound();
        const load = item.prescription.load;
        if (load?.type === "pct_1rm" && load.test.startsWith("exercise:") && load.test !== `exercise:${exercise.id}`)
          throw invalid(m.strength.prescriptionMismatch);
        return {
          ref: item.ref ?? `b${b}-i${i}`,
          exerciseId: exercise.id,
          name: exercise.name,
          category: exercise.category,
          cues: exercise.cues,
          media: mediaSnapshot(exercise.media[0]),
          prescription: item.prescription,
        };
      }),
    })),
  });
};

const audienceUsers = async (sessionId: string): Promise<string[]> => {
  const ids = await activeAudienceIds(sessionId);
  const rows = await prisma.athlete.findMany({
    where: { id: { in: ids }, userId: { not: null } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId as string);
};

const checkAudience = async (access: Access, input: SaveScheduledSessionInput): Promise<void> => {
  const groups = input.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const athletes = input.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  await requireGroupInScope(access, groups);
  await requireAthletesInScope(access, [...athletes, ...input.overrides.map((o) => o.athleteId)]);
};

export const saveScheduledSession = async (
  userId: string,
  organizationId: string,
  input: SaveScheduledSessionInput,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  await checkAudience(access, input);
  const snapshot = await buildSnapshot(organizationId, input.draft);
  const existing = input.id ? await requireSessionWrite(access, input.id) : null;
  const currentItems = existing
    ? withSessionRefs(sessionDraft.parse(existing.draft)).blocks.flatMap((b) => b.items)
    : [];
  const snapshotItems = snapshot.blocks.flatMap((b) => b.items);
  const itemIds = new Map(snapshotItems.map((i) => [i.ref, i.exerciseId]));
  if (input.overrides.some((o) => !itemIds.has(o.itemRef))) throw invalid();
  for (const override of input.overrides) {
    const load = override.prescription.load;
    if (
      load?.type === "pct_1rm" &&
      load.test.startsWith("exercise:") &&
      load.test !== `exercise:${itemIds.get(override.itemRef)}`
    )
      throw invalid(m.strength.prescriptionMismatch);
  }
  if (existing && input.expectedVersion !== undefined && input.expectedVersion !== existing.version)
    throw sessionConflict();
  const data = {
    date: toDbDate(input.date),
    startTime: input.startTime,
    location: input.location,
    title: input.draft.title,
    type: input.draft.type,
    draft: input.draft,
    publishAt: input.publishAt ? new Date(input.publishAt) : null,
    ...(existing?.publishedAt ? { snapshot } : {}),
  };
  const saved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    if (existing) {
      // Le verrou est partagé avec les saisies athlètes : une validation ne peut pas
      // apparaître entre le contrôle de compatibilité et la modification de séance.
      await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${existing.id}::uuid FOR UPDATE`;
      const storedDraft = sessionDraft.parse(existing.draft);
      const hasPersistentRefs = storedDraft.blocks.some((b) => b.ref || b.items.some((i) => i.ref));
      const hasLogs = await tx.sessionLog.count({ where: { scheduledSessionId: existing.id } });
      if ((hasPersistentRefs || hasLogs > 0 || existing.prescriptionFrozenAt) && input.expectedVersion === undefined)
        throw new AppError(409, "legacy_session_conflict", m.builder.legacyConflict);
      if (input.expectedVersion !== undefined) {
        if (input.draft.blocks.some((b) => !b.ref || b.items.some((i) => !i.ref))) throw invalid();
        if (currentItems.some((i) => itemIds.has(i.ref!) && itemIds.get(i.ref!) !== i.exerciseId))
          throw new AppError(409, "session_identity_conflict", m.builder.identityConflict);
      }
      const updated = await tx.scheduledSession.updateMany({
        where: { id: existing.id, version: input.expectedVersion ?? existing.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw sessionConflict();
    }
    const row = existing
      ? await tx.scheduledSession.findUniqueOrThrow({ where: { id: existing.id } })
      : await tx.scheduledSession.create({ data: { ...data, organizationId, createdBy: userId } });
    await tx.assignment.deleteMany({ where: { scheduledSessionId: row.id } });
    await tx.assignment.createMany({
      data: input.assignments.map((a) => ({
        scheduledSessionId: row.id,
        targetType: a.targetType,
        targetId: a.targetId,
      })),
      skipDuplicates: true,
    });
    await tx.athleteOverride.deleteMany({ where: { scheduledSessionId: row.id } });
    await tx.athleteOverride.createMany({
      data: input.overrides.map((o) => ({
        scheduledSessionId: row.id,
        athleteId: o.athleteId,
        itemRef: o.itemRef,
        prescription: o.prescription,
      })),
    });
    if (row.publishedAt) await freezeSessionPrescriptions(tx, row.id, "revision");
    return row;
  });
  // Modifier une séance déjà publiée notifie les athlètes concernés (§ 7.5).
  if (existing?.publishedAt) {
    await notify(await audienceUsers(saved.id), "session_updated", {
      date: input.date,
      organizationId,
      sessionId: saved.id,
      link: `/seance/${saved.id}`,
    });
  }
  return { id: saved.id, version: saved.version };
};

export const publishSession = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  now: Date = new Date(),
  expectedVersion?: number,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  if (expectedVersion !== undefined && expectedVersion !== session.version) throw sessionConflict();
  await publishRow(session.id, session.createdBy, now, { expectedVersion: session.version });
  return { id: session.id };
};

// Fige la séance et ses prescriptions individuelles dans la même transaction, puis notifie.
export type Publication = { userId: string; date: string; sessionId: string };

// `silent` : l'appelant regroupe les notifications d'un lot de séances.
export const publishRow = async (
  sessionId: string,
  authorId: string,
  now: Date,
  options: { silent?: boolean; expectedVersion?: number } = {},
): Promise<Publication[]> => {
  const session = await prisma.scheduledSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (options.expectedVersion !== undefined && options.expectedVersion !== session.version) throw sessionConflict();
  if (session.publishedAt) return [];
  const assignmentCount = await prisma.assignment.count({ where: { scheduledSessionId: sessionId } });
  if (assignmentCount === 0) throw invalid(m.builder.noAudience);
  const snapshot = await buildSnapshot(session.organizationId, sessionDraft.parse(session.draft));
  const didPublish = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${session.organizationId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const published = await tx.scheduledSession.updateMany({
      where: { id: sessionId, version: session.version, publishedAt: null },
      data: { snapshot, publishedAt: now, version: { increment: 1 } },
    });
    if (published.count !== 1) {
      if ((await tx.scheduledSession.findUnique({ where: { id: sessionId } }))?.publishedAt) return false;
      throw sessionConflict();
    }
    await freezeSessionPrescriptions(tx, sessionId, "publication");
    return true;
  });
  if (!didPublish) return [];
  const users = await audienceUsers(sessionId);
  const publications = users.map((userId) => ({ userId, date: fromDbDate(session.date), sessionId }));
  if (!options.silent) {
    await notifyPublications(publications, {
      coach: await firstNameOf(authorId),
      organizationId: session.organizationId,
    });
  }
  log.info("session_published", { organizationId: session.organizationId, entityId: sessionId, count: users.length });
  return publications;
};

export const getSessionForEdit = async (userId: string, organizationId: string, sessionId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  const [rows, overrides, logCount] = await Promise.all([
    prisma.assignment.findMany({ where: { scheduledSessionId: sessionId } }),
    prisma.athleteOverride.findMany({ where: { scheduledSessionId: sessionId } }),
    prisma.sessionLog.count({ where: { scheduledSessionId: sessionId, status: { in: ["done", "partial"] } } }),
  ]);
  // Une ancienne attribution orpheline ne doit pas empêcher de réenregistrer la séance.
  const targetIds = rows.map((a) => a.targetId);
  const [groups, athletes] = await Promise.all([
    prisma.group.findMany({ where: { organizationId, id: { in: targetIds } }, select: { id: true } }),
    prisma.athlete.findMany({ where: { organizationId, id: { in: targetIds } }, select: { id: true } }),
  ]);
  const existing = new Set([...groups, ...athletes].map((target) => target.id));
  const assignments = rows.filter((a) => existing.has(a.targetId));
  return {
    id: session.id,
    version: session.version,
    expectedVersion: session.version,
    date: fromDbDate(session.date),
    startTime: session.startTime,
    location: session.location,
    publishedAt: session.publishedAt?.toISOString() ?? null,
    publishAt: session.publishAt?.toISOString() ?? null,
    logCount,
    draft: withSessionRefs(sessionDraft.parse(session.draft)),
    assignments: assignments.map((a) => ({ targetType: a.targetType, targetId: a.targetId })),
    overrides: overrides.map((o) => ({
      athleteId: o.athleteId,
      itemRef: o.itemRef,
      prescription: prescriptionSchema.parse(o.prescription),
    })),
  };
};

export const deleteSession = async (userId: string, organizationId: string, sessionId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  // À calculer avant : la suppression emporte les attributions.
  const date = fromDbDate(session.date);
  const upcoming = Boolean(session.publishedAt) && date >= todayIso();
  const users = upcoming ? await audienceUsers(session.id) : [];
  await prisma.scheduledSession.delete({ where: { id: session.id } });
  await notify(users, "session_cancelled", { date, organizationId, link: "/aujourdhui" });
};

export const deleteTemplate = async (userId: string, organizationId: string, templateId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const template = await prisma.sessionTemplate.findFirst({ where: { id: templateId, organizationId } });
  if (!template) throw notFound();
  if (access.role !== "owner" && template.createdBy !== userId) throw forbidden();
  await prisma.sessionTemplate.delete({ where: { id: template.id } });
};

export const moveSession = async (userId: string, organizationId: string, sessionId: string, date: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const moved = await tx.scheduledSession.updateMany({
      where: { id: session.id, version: session.version },
      data: { date: toDbDate(date), version: { increment: 1 } },
    });
    if (moved.count !== 1) throw sessionConflict();
    if (session.publishedAt) await freezeSessionPrescriptions(tx, session.id, "revision");
  });
  if (session.publishedAt) {
    await notify(await audienceUsers(session.id), "session_updated", {
      date,
      organizationId,
      sessionId,
      link: `/seance/${session.id}`,
    });
  }
};

const copySession = async (
  session: {
    id: string;
    organizationId: string;
    startTime: string | null;
    location: string | null;
    title: string;
    type: SessionSnapshot["type"];
    draft: unknown;
  },
  userId: string,
  date: string,
  groupId?: string,
) => {
  const [assignments, overrides] = await Promise.all([
    prisma.assignment.findMany({ where: { scheduledSessionId: session.id } }),
    // Vers un autre groupe, les adaptations individuelles n'ont plus de sens.
    groupId ? [] : prisma.athleteOverride.findMany({ where: { scheduledSessionId: session.id } }),
  ]);
  return prisma.scheduledSession.create({
    data: {
      organizationId: session.organizationId,
      createdBy: userId,
      date: toDbDate(date),
      startTime: session.startTime,
      location: session.location,
      title: session.title,
      type: session.type,
      draft: session.draft as object,
      assignments: {
        create: groupId
          ? [{ targetType: "group" as const, targetId: groupId }]
          : assignments.map((a) => ({ targetType: a.targetType, targetId: a.targetId })),
      },
      overrides: {
        create: overrides.map((o) => ({
          athleteId: o.athleteId,
          itemRef: o.itemRef,
          prescription: o.prescription as Prisma.InputJsonValue,
        })),
      },
    },
  });
};

export const duplicateSession = async (userId: string, organizationId: string, sessionId: string, date: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  const copy = await copySession(session, userId, date);
  return { id: copy.id };
};

export const duplicateWeek = async (
  userId: string,
  organizationId: string,
  input: { fromWeek: string; toWeek: string; targetGroupId?: string },
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  if (input.targetGroupId) await requireGroupInScope(access, [input.targetGroupId]);
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      organizationId,
      date: { gte: toDbDate(input.fromWeek), lte: toDbDate(addDays(input.fromWeek, 6)) },
      ...(access.role === "assistant" ? { createdBy: userId } : {}),
    },
  });
  const offset = Math.round((toDbDate(input.toWeek).getTime() - toDbDate(input.fromWeek).getTime()) / 86400000);
  for (const session of sessions) {
    await copySession(session, userId, addDays(fromDbDate(session.date), offset), input.targetGroupId);
  }
  return { count: sessions.length };
};

export const generateAutonomousVersion = async (userId: string, organizationId: string, sessionId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  const draft = withSessionRefs(sessionDraft.parse(session.draft));
  const generated = generateAutonomousBlocks(draft.blocks);
  const copied = copyDraftWithNewRefs(
    { ...draft, blocks: generated.filter((b) => b.variant === "autonomous") },
    randomUUID,
  );
  const next = { ...draft, blocks: [...generated.filter((b) => b.variant !== "autonomous"), ...copied.blocks] };
  const snapshot = session.publishedAt ? await buildSnapshot(organizationId, next) : null;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const updated = await tx.scheduledSession.updateMany({
      where: { id: session.id, version: session.version },
      data: { draft: next, version: { increment: 1 }, ...(snapshot ? { snapshot } : {}) },
    });
    if (updated.count !== 1) throw sessionConflict();
    if (session.publishedAt) await freezeSessionPrescriptions(tx, session.id, "revision");
  });
};

export const listCalendar = async (
  userId: string,
  organizationId: string,
  query: { from: string; to: string; groupId?: string },
): Promise<CalendarResponse> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const scopeGroups = access.role === "owner" ? null : await coachGroupIds(access);
  const scopeAthletes = access.role === "owner" ? null : await visibleAthleteIds(access);
  // Un athlète ne voit jamais un brouillon, ni les compétitions auxquelles il n'est pas inscrit.
  const athleteId = access.role === "athlete" ? access.athleteId : null;
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      organizationId,
      date: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
      ...(athleteId ? await athleteAssignedWhere(athleteId) : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { assignments: true },
  });
  const groupRows = await prisma.group.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const groupNames = new Map(groupRows.map((g) => [g.id, g.name]));
  const inScope = sessions.filter((s) => {
    if (query.groupId && !s.assignments.some((a) => a.targetType === "group" && a.targetId === query.groupId)) {
      return false;
    }
    if (athleteId || !scopeGroups || !scopeAthletes) return true;
    // Chaque coach voit ses séances et celles qui concernent ses athlètes (§ 5.2).
    return (
      s.createdBy === userId ||
      s.assignments.some((a) =>
        a.targetType === "group" ? scopeGroups.includes(a.targetId) : scopeAthletes.includes(a.targetId),
      )
    );
  });
  const competitions = await prisma.competition.findMany({
    where: {
      organizationId,
      date: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
      ...(athleteId ? { athletes: { some: { athleteId } } } : {}),
    },
    orderBy: { date: "asc" },
  });
  return {
    sessions: inScope.map((s) => {
      const draft = sessionDraft.safeParse(s.draft);
      const groups = s.assignments.filter((a) => a.targetType === "group").map((a) => groupNames.get(a.targetId) ?? "");
      const athletes = s.assignments.filter((a) => a.targetType === "athlete").length;
      const audience = [...groups, ...(athletes ? [`${athletes} athlète${athletes > 1 ? "s" : ""}`] : [])].join(", ");
      return {
        id: s.id,
        title: s.title,
        type: s.type,
        date: fromDbDate(s.date),
        startTime: s.startTime,
        location: s.location,
        publishedAt: s.publishedAt?.toISOString() ?? null,
        audience,
        hasAutonomous: draft.success ? hasAutonomousVersion(draft.data) : false,
      };
    }),
    competitions: competitions.map((c) => ({ id: c.id, name: c.name, date: fromDbDate(c.date), location: c.location })),
  };
};

export const saveTemplate = async (userId: string, organizationId: string, draft: SessionDraft) => {
  await requireOrgMember(userId, organizationId, "manageSessions");
  // Un exercice d'un autre espace ne doit pas entrer par un modèle.
  const exerciseIds = [...new Set(draft.blocks.flatMap((block) => block.items.map((item) => item.exerciseId)))];
  const known = await prisma.exercise.count({
    where: { id: { in: exerciseIds }, OR: [{ organizationId }, { organizationId: null }] },
  });
  if (known !== exerciseIds.length) throw notFound();
  const template = await prisma.sessionTemplate.create({
    data: {
      organizationId,
      createdBy: userId,
      title: draft.title,
      type: draft.type,
      durationMin: draft.durationMin,
      coachNote: draft.coachNote,
      blocks: {
        create: draft.blocks.map((block, position) => ({
          name: block.name,
          variant: block.variant,
          position,
          items: {
            create: block.items.map((item, itemPosition) => ({
              exerciseId: item.exerciseId,
              position: itemPosition,
              prescription: item.prescription,
            })),
          },
        })),
      },
    },
  });
  return { id: template.id };
};

export const listTemplates = async (
  userId: string,
  organizationId: string,
): Promise<(SessionDraft & { id: string })[]> => {
  await requireOrgMember(userId, organizationId, "manageSessions");
  const rows = await prisma.sessionTemplate.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      blocks: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    durationMin: t.durationMin,
    coachNote: t.coachNote,
    blocks: t.blocks.map((b) => ({
      name: b.name,
      variant: b.variant,
      items: b.items.map((i) => ({
        exerciseId: i.exerciseId,
        prescription: i.prescription as SessionDraft["blocks"][number]["items"][number]["prescription"],
      })),
    })),
  }));
};

// Une compétition partagée avec un athlète hors périmètre ne se retire pas à sa place.
export const deleteCompetition = async (userId: string, organizationId: string, competitionId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    select: { id: true, athletes: { select: { athleteId: true } } },
  });
  if (!competition) throw notFound();
  for (const { athleteId } of competition.athletes) await requireVisibleAthlete(access, athleteId);
  await prisma.competition.delete({ where: { id: competition.id } });
};

export const saveCompetition = async (
  userId: string,
  organizationId: string,
  input: {
    id?: string;
    name: string;
    date: string;
    location?: string | null;
    level?: string | null;
    athleteIds: string[];
  },
) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  for (const id of input.athleteIds) await requireVisibleAthlete(access, id);
  const data = {
    name: input.name,
    date: toDbDate(input.date),
    location: input.location ?? null,
    level: input.level ?? null,
  };
  if (input.id) {
    const existing = await prisma.competition.findFirst({ where: { id: input.id, organizationId } });
    if (!existing) throw notFound();
    await prisma.competition.update({ where: { id: input.id }, data });
    await prisma.competitionAthlete.deleteMany({ where: { competitionId: input.id } });
    await prisma.competitionAthlete.createMany({
      data: input.athleteIds.map((athleteId) => ({ competitionId: input.id as string, athleteId })),
    });
    return { id: input.id };
  }
  const created = await prisma.competition.create({
    data: {
      ...data,
      organizationId,
      athletes: { create: input.athleteIds.map((athleteId) => ({ athleteId })) },
    },
  });
  return { id: created.id };
};

export const listTestKeys = async (userId: string, organizationId: string): Promise<string[]> => {
  await requireOrgMember(userId, organizationId, "manageSessions");
  const rows = await prisma.strengthTest.findMany({
    where: { organizationId },
    distinct: ["exerciseKey"],
    select: { exerciseKey: true },
  });
  return rows.map((r) => r.exerciseKey);
};
