import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import {
  type CalendarResponse,
  publishSessionsInput,
  type PublishSessionsInput,
  type DeleteSessionInput,
  confirmPrescriptionRefresh,
  type ConfirmPrescriptionRefresh,
  type SaveScheduledSessionInput,
  saveScheduledSessionInput,
  type SessionDraft,
  type SessionSnapshot,
  prescriptionSchema,
  sessionDraft,
  sessionSnapshot,
} from "@tartan/contracts";
import {
  addDays,
  can,
  groupPublications,
  generateAutonomousBlocks,
  hasAutonomousVersion,
  withSessionRefs,
  hasUniqueSessionRefs,
  copyDraftWithNewRefs,
  calendarCompletion,
  exerciseCount,
  expandSessionSnapshot,
  validSessionStructure,
  validExecutionBudget,
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
import { activeAudienceIds, athleteAssignedWhere, audienceBySession } from "./session-audience.service";
export { activeAudienceIds, audienceAthleteIds } from "./session-audience.service";
import { reviewSessionPhases, storedPhaseContext } from "./session-phase-context";
import { freezeSessionPrescriptions, preparePrescriptionRefresh } from "./prescription.service";
import { mediaSnapshot } from "./exercise.service";
import { readExerciseGuide } from "./exercise-catalog.service";
import { firstNameOf } from "./me.service";
import { notify, notifyPublications, queueNotifications, dispatchPending } from "./notify.service";

const sessionConflict = () => new AppError(409, "session_version_conflict", m.builder.versionConflict);

const checkExecutionBudgets = (snapshot: SessionSnapshot, overrides: SaveScheduledSessionInput["overrides"]) => {
  const athletes = new Set(overrides.map((override) => override.athleteId));
  if (
    !validExecutionBudget(snapshot) ||
    [...athletes].some(
      (id) =>
        !validExecutionBudget(
          snapshot,
          overrides.filter((override) => override.athleteId === id),
        ),
    )
  )
    throw invalid();
};

const requireAthletesInScope = async (access: Access, ids: string[], db: Prisma.TransactionClient = prisma) => {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const count = await db.athlete.count({ where: { organizationId: access.organizationId, id: { in: unique } } });
  if (count !== unique.length) throw notFound();
  if (access.role === "owner") return;
  const visible = new Set(await visibleAthleteIds(access, db));
  if (!unique.every((id) => visible.has(id))) throw forbidden();
};

const requireSessionWrite = async (access: Access, sessionId: string, db: Prisma.TransactionClient = prisma) => {
  const session = await db.scheduledSession.findFirst({
    where: { id: sessionId, organizationId: access.organizationId },
  });
  if (!session) throw notFound();
  // Coach adjoint : seulement ses propres séances (§ 5.3).
  if (access.role === "assistant" && session.createdBy !== access.userId) throw forbidden();
  if (access.role !== "owner") {
    const assignments = await db.assignment.findMany({ where: { scheduledSessionId: sessionId } });
    if (assignments.length === 0 && session.createdBy !== access.userId) throw forbidden();
    await requireGroupInScope(
      access,
      assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
      db,
    );
    const overrides = await db.athleteOverride.findMany({
      where: { scheduledSessionId: sessionId },
      select: { athleteId: true },
    });
    await requireAthletesInScope(
      access,
      [
        ...assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
        ...overrides.map((o) => o.athleteId),
      ],
      db,
    );
  }
  return session;
};

// Copie exercices et médias : supprimer un exercice ne change pas les séances déjà planifiées.
export const buildSnapshot = async (
  organizationId: string,
  draft: SessionDraft,
  db: Prisma.TransactionClient = prisma,
): Promise<SessionSnapshot> => {
  if (!hasUniqueSessionRefs(draft) || !validSessionStructure(draft)) throw invalid();
  const ids = draft.blocks.flatMap((b) => b.items.map((i) => i.exerciseId));
  const exercises = await db.exercise.findMany({
    where: { id: { in: ids }, OR: [{ organizationId }, { organizationId: null }] },
    include: { media: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const snapshot = sessionSnapshot.parse({
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
          classification: exercise.classification,
          cues: exercise.cues,
          guide: readExerciseGuide(exercise.guide),
          media: mediaSnapshot(exercise.media[0]),
          prescription: item.prescription,
          strengthLoadKind: exercise.strengthLoadKind,
          loadStepKg: Number(exercise.loadStepKg),
        };
      }),
    })),
  });
  return expandSessionSnapshot(draft, snapshot, m.builder.sequenceRecovery);
};

const audienceUsers = async (sessionId: string, db: Prisma.TransactionClient = prisma): Promise<string[]> => {
  const ids = await activeAudienceIds(sessionId, db);
  const rows = await db.athlete.findMany({
    where: { id: { in: ids }, userId: { not: null } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId as string);
};

const checkAudience = async (
  access: Access,
  input: SaveScheduledSessionInput,
  db: Prisma.TransactionClient = prisma,
): Promise<void> => {
  const groups = input.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const athletes = input.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  await requireGroupInScope(access, groups, db);
  await requireAthletesInScope(access, [...athletes, ...input.overrides.map((o) => o.athleteId)], db);
};

// Création interne des brouillons relus du planificateur. L’appelant détient le
// verrou d’espace et inclut ces écritures dans la confirmation de proposition.
// Aucun chemin de publication, de programmation ou de notification ici.
export async function createReviewedPlannerDraft(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  raw: Omit<SaveScheduledSessionInput, "id" | "expectedVersion">,
) {
  const input = saveScheduledSessionInput.omit({ id: true, expectedVersion: true }).strict().parse(raw);
  if (input.publishAt !== null) throw invalid();
  const access = await requireOrgMember(userId, organizationId, "manageSessions", tx);
  await checkAudience(access, input, tx);
  const snapshot = await buildSnapshot(organizationId, input.draft, tx);
  checkExecutionBudgets(snapshot, input.overrides);
  const items = new Map(
    snapshot.blocks.flatMap((b) =>
      b.items
        .filter((i) => i.kind !== "recovery")
        .flatMap(
          (i) =>
            [
              [i.ref, i.exerciseId],
              [i.sourceRef ?? i.ref, i.exerciseId],
            ] as const,
        ),
    ),
  );
  for (const override of input.overrides) {
    if (!items.has(override.itemRef)) throw invalid();
    const load = override.prescription.load;
    if (
      load?.type === "pct_1rm" &&
      load.test.startsWith("exercise:") &&
      load.test !== `exercise:${items.get(override.itemRef)}`
    )
      throw invalid(m.strength.prescriptionMismatch);
  }
  const phaseContext = await reviewSessionPhases(tx, access, input, null, true);
  const row = await tx.scheduledSession.create({
    data: {
      organizationId,
      createdBy: userId,
      date: toDbDate(input.date),
      startTime: input.startTime,
      location: input.location,
      title: input.draft.title,
      type: input.draft.type,
      draft: input.draft,
      phaseContext: phaseContext ?? Prisma.DbNull,
    },
  });
  await tx.assignment.createMany({
    data: input.assignments.map((a) => ({ scheduledSessionId: row.id, ...a })),
    skipDuplicates: true,
  });
  if (input.overrides.length)
    await tx.athleteOverride.createMany({ data: input.overrides.map((o) => ({ scheduledSessionId: row.id, ...o })) });
  return { id: row.id, version: row.version };
}

export const saveScheduledSession = async (
  userId: string,
  organizationId: string,
  input: SaveScheduledSessionInput,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  await checkAudience(access, input);
  const snapshot = await buildSnapshot(organizationId, input.draft);
  checkExecutionBudgets(snapshot, input.overrides);
  const existing = input.id ? await requireSessionWrite(access, input.id) : null;
  const currentItems = existing
    ? withSessionRefs(sessionDraft.parse(existing.draft)).blocks.flatMap((b) => b.items)
    : [];
  const snapshotItems = snapshot.blocks.flatMap((b) => b.items);
  const itemIds = new Map(
    snapshotItems
      .filter((i) => i.kind !== "recovery")
      .flatMap(
        (i) =>
          [
            [i.ref, i.exerciseId],
            [i.sourceRef ?? i.ref, i.exerciseId],
          ] as const,
      ),
  );
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
  // La révision fige aussi les prescriptions sous verrou, comme une publication groupée.
  const saved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const currentAccess = await requireOrgMember(userId, organizationId, "manageSessions", tx);
    await checkAudience(currentAccess, input, tx);
    if (existing) await requireSessionWrite(currentAccess, existing.id, tx);
    const phaseContext = await reviewSessionPhases(
      tx,
      currentAccess,
      input,
      existing?.phaseContext,
      Boolean(existing?.publishedAt || input.publishAt),
    );
    const reviewedData = { ...data, phaseContext: phaseContext ?? Prisma.DbNull };
    if (existing) {
      // Le verrou est partagé avec les saisies athlètes : une validation ne peut pas
      // apparaître entre le contrôle de compatibilité et la modification de séance.
      await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${existing.id}::uuid FOR UPDATE`;
      const storedDraft = sessionDraft.parse(existing.draft);
      if (storedDraft.structureVersion === 2 && input.draft.structureVersion !== 2)
        throw new AppError(409, "session_structure_upgrade_required", m.builder.structureUpgrade);
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
        data: { ...reviewedData, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw sessionConflict();
    }
    const row = existing
      ? await tx.scheduledSession.findUniqueOrThrow({ where: { id: existing.id } })
      : await tx.scheduledSession.create({ data: { ...reviewedData, organizationId, createdBy: userId } });
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
  }, { timeout: 30000 });
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
  await publishRow(session.id, session.createdBy, now, { expectedVersion: session.version, actorId: userId });
  return { id: session.id };
};

// Fige la séance et ses prescriptions individuelles dans la même transaction, puis notifie.
export type Publication = { userId: string; date: string; sessionId: string };

// `silent` : l'appelant regroupe les notifications d'un lot de séances.
export const publishRow = async (
  sessionId: string,
  authorId: string,
  now: Date,
  options: { silent?: boolean; expectedVersion?: number; actorId?: string } = {},
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
    const currentAccess = await requireOrgMember(
      options.actorId ?? authorId,
      session.organizationId,
      "manageSessions",
      tx,
    );
    const current = await requireSessionWrite(currentAccess, sessionId, tx);
    if (current.publishedAt) return false;
    const assignments = await tx.assignment.findMany({
      where: { scheduledSessionId: sessionId },
      select: { targetType: true, targetId: true },
    });
    const phaseContext = await reviewSessionPhases(
      tx,
      currentAccess,
      { date: fromDbDate(current.date), assignments },
      current.phaseContext,
      true,
    );
    const published = await tx.scheduledSession.updateMany({
      where: { id: sessionId, version: session.version, publishedAt: null },
      data: { snapshot, phaseContext: phaseContext ?? Prisma.DbNull, publishedAt: now, version: { increment: 1 } },
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

// Publication atomique de 1–14 brouillons. Le passage publié et la version servent de garde de rejeu.
// Un rejeu après une modification ultérieure exige de relire la sélection ; il n'écrase jamais la séance.
export const publishSessions = async (
  userId: string,
  organizationId: string,
  raw: PublishSessionsInput,
  now = new Date(),
) => {
  const input = publishSessionsInput.parse(raw);
  await requireOrgMember(userId, organizationId, "manageSessions");
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const access = await requireOrgMember(userId, organizationId, "manageSessions", tx);
      const publications: Publication[] = [];
      let publishedCount = 0;
      const sessions: { id: string; version: number }[] = [];
      for (const requested of [...input.sessions].sort((a, b) => a.id.localeCompare(b.id))) {
        await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${requested.id}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`;
        const current = await requireSessionWrite(access, requested.id, tx);
        if (current.publishedAt) {
          if (current.version !== requested.expectedVersion + 1) throw sessionConflict();
          sessions.push({ id: current.id, version: current.version });
          continue;
        }
        if (current.version !== requested.expectedVersion) throw sessionConflict();
        const assignments = await tx.assignment.findMany({
          where: { scheduledSessionId: current.id },
          select: { targetType: true, targetId: true },
        });
        if (!assignments.length) throw invalid(m.builder.noAudience);
        await requireGroupInScope(
          access,
          assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
          tx,
        );
        await requireAthletesInScope(
          access,
          assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
          tx,
        );
        const phaseContext = await reviewSessionPhases(
          tx,
          access,
          { date: fromDbDate(current.date), assignments },
          current.phaseContext,
          true,
        );
        const snapshot = await buildSnapshot(organizationId, sessionDraft.parse(current.draft), tx);
        await tx.scheduledSession.update({
          where: { id: current.id },
          data: {
            snapshot,
            phaseContext: phaseContext ?? Prisma.DbNull,
            publishedAt: now,
            publishAt: null,
            version: { increment: 1 },
          },
        });
        await freezeSessionPrescriptions(tx, current.id, "publication");
        publishedCount++;
        for (const target of await audienceUsers(current.id, tx))
          publications.push({ userId: target, date: fromDbDate(current.date), sessionId: current.id });
        sessions.push({ id: current.id, version: current.version + 1 });
      }
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, profile: { select: { firstName: true } } },
      });
      const coach = actor?.profile?.firstName || actor?.name.split(" ")[0] || m.batchPublication.coach;
      const notificationIds: string[] = [];
      for (const group of groupPublications(publications)) {
        const own = publications.filter((p) => p.userId === group.userId);
        notificationIds.push(
          ...(await queueNotifications(
            tx,
            [group.userId],
            own.length > 1 ? "session_batch_published" : "session_published",
            {
              organizationId,
              coach,
              ...(own.length > 1
                ? { count: own.length, link: "/accueil" }
                : { date: own[0]!.date, sessionId: own[0]!.sessionId, link: `/seance/${own[0]!.sessionId}` }),
            },
            now,
          )),
        );
      }
      if (publishedCount)
        await tx.organization.update({ where: { id: organizationId }, data: { lastBusinessActivityAt: now } });
      return { sessions, notificationIds };
    },
    { timeout: 30000 },
  );
  // L'outbox est durable : un échec de livraison n'annule pas une publication confirmée.
  if (result.notificationIds.length)
    await dispatchPending(now, result.notificationIds).catch(() =>
      log.error("publication_dispatch_pending", { organizationId }),
    );
  return { sessions: result.sessions };
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
  const phaseContext = storedPhaseContext.safeParse(session.phaseContext);
  const phaseGroups = access.role === "owner" ? null : await coachGroupIds(access);
  const phaseAthletes = access.role === "owner" ? null : new Set(await visibleAthleteIds(access));
  const phaseReview =
    phaseContext.success &&
    phaseContext.data.review.choices.every(
      (c) => (!phaseGroups || phaseGroups.includes(c.groupId)) && (!phaseAthletes || phaseAthletes.has(c.athleteId)),
    )
      ? phaseContext.data.review
      : undefined;
  return {
    ...(phaseReview ? { phaseReview } : {}),
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

export const deleteSession = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  confirmation?: DeleteSessionInput,
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const session = await requireSessionWrite(access, sessionId);
  const notificationIds = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const current = await tx.scheduledSession.findUnique({ where: { id: sessionId } });
    if (!current) throw notFound();
    const logCount = await tx.sessionLog.count({ where: { scheduledSessionId: sessionId } });
    if (
      current.version !== session.version ||
      (confirmation && current.version !== confirmation.expectedVersion) ||
      (confirmation && confirmation.expectedLogCount !== logCount)
    )
      throw sessionConflict();
    // Avant la suppression des attributions, sous le même verrou que les validations.
    const date = fromDbDate(current.date);
    const upcoming = Boolean(current.publishedAt) && date >= todayIso();
    const users = upcoming ? await audienceUsers(sessionId, tx) : [];
    await tx.scheduledSession.delete({ where: { id: sessionId } });
    const ids = await queueNotifications(tx, users, "session_cancelled", {
      date,
      organizationId,
      link: "/aujourdhui",
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        actorId: userId,
        action: "session_deleted",
        entity: "scheduled_session",
        entityId: sessionId,
      },
    });
    await tx.organization.update({ where: { id: organizationId }, data: { lastBusinessActivityAt: new Date() } });
    return ids;
  });
  try {
    if (notificationIds.length) await dispatchPending(new Date(), notificationIds);
  } catch {
    log.warn("session_cancellation_delivery_deferred", { organizationId, entityId: sessionId });
  }
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
    const currentAccess = await requireOrgMember(userId, organizationId, "manageSessions", tx);
    const current = await requireSessionWrite(currentAccess, sessionId, tx);
    const assignments = await tx.assignment.findMany({
      where: { scheduledSessionId: sessionId },
      select: { targetType: true, targetId: true },
    });
    const phaseContext = await reviewSessionPhases(
      tx,
      currentAccess,
      { date, assignments },
      current.phaseContext,
      Boolean(current.publishedAt || current.publishAt),
    );
    const moved = await tx.scheduledSession.updateMany({
      where: { id: session.id, version: session.version },
      data: { date: toDbDate(date), phaseContext: phaseContext ?? Prisma.DbNull, version: { increment: 1 } },
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
  // La semaine d'un coach ne comprend pas les séances des groupes qu'il n'encadre pas.
  const writable = await Promise.all(
    sessions.map((session) =>
      requireSessionWrite(access, session.id).then(
        () => true,
        (error: unknown) => {
          if (error instanceof AppError && error.status === 403) return false;
          throw error;
        },
      ),
    ),
  );
  const copied = sessions.filter((_, index) => writable[index]);
  for (const session of copied) {
    await copySession(session, userId, addDays(fromDbDate(session.date), offset), input.targetGroupId);
  }
  return { count: copied.length };
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
  if (!validSessionStructure(next)) throw invalid();
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

// Réalisation du mois : une lecture des journaux et une lecture d'athlètes, quel que soit le nombre de séances.
const calendarCompletions = async (
  organizationId: string,
  sessions: {
    id: string;
    date: Date;
    publishedAt: Date | null;
    assignments: { targetType: "group" | "athlete"; targetId: string }[];
  }[],
  scopeAthletes: string[] | null,
) => {
  const published = sessions.filter((s) => s.publishedAt);
  const logs = published.length
    ? await prisma.sessionLog.findMany({
        where: {
          scheduledSessionId: { in: published.map((s) => s.id) },
          ...(scopeAthletes ? { athleteId: { in: scopeAthletes } } : {}),
        },
        select: { scheduledSessionId: true, athleteId: true, status: true },
      })
    : [];
  const logged = new Map<string, Set<string>>();
  const statuses = new Map<string, (typeof logs)[number]["status"][]>();
  for (const log of logs) {
    logged.set(log.scheduledSessionId, (logged.get(log.scheduledSessionId) ?? new Set<string>()).add(log.athleteId));
    statuses.set(log.scheduledSessionId, [...(statuses.get(log.scheduledSessionId) ?? []), log.status]);
  }
  const audience = await audienceBySession(organizationId, published, logged, scopeAthletes);
  return new Map(
    published.map((s) => [s.id, calendarCompletion(statuses.get(s.id) ?? [], audience.get(s.id)?.length ?? 0)]),
  );
};

export const listCalendar = async (
  userId: string,
  organizationId: string,
  query: { from: string; to: string; groupId?: string; summary?: "true" | "false" | boolean },
): Promise<CalendarResponse> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  const scopeGroups = access.role === "owner" ? null : await coachGroupIds(access);
  const scopeAthletes = access.role === "owner" ? null : await visibleAthleteIds(access);
  // Un athlète ne voit jamais un brouillon, ni les compétitions auxquelles il n'est pas inscrit.
  const athleteId = access.role === "athlete" ? access.athleteId : null;
  // Un filtre de groupe garde aussi les séances attribuées individuellement à ses membres.
  const groupMemberIds = query.groupId
    ? (
        await prisma.groupMember.findMany({
          where: { groupId: query.groupId, group: { organizationId } },
          select: { athleteId: true },
        })
      ).map((row) => row.athleteId)
    : [];
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      organizationId,
      date: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
      ...(athleteId ? await athleteAssignedWhere(athleteId) : {}),
      ...(query.groupId
        ? {
            assignments: {
              some: {
                OR: [
                  { targetType: "group" as const, targetId: query.groupId },
                  { targetType: "athlete" as const, targetId: { in: groupMemberIds } },
                ],
              },
            },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      version: true,
      publishAt: true,
      title: true,
      type: true,
      date: true,
      startTime: true,
      location: true,
      publishedAt: true,
      createdBy: true,
      draft: true,
      snapshot: true,
      assignments: { select: { targetType: true, targetId: true } },
      overrides: { select: { athleteId: true } },
    },
  });
  const groupRows = await prisma.group.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const groupNames = new Map(groupRows.map((g) => [g.id, g.name]));
  const inScope = sessions.filter((s) => {
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
  const wantsSummary = query.summary === true || query.summary === "true";
  const completionBySession =
    wantsSummary && !athleteId ? await calendarCompletions(organizationId, inScope, scopeAthletes) : null;
  return {
    sessions: inScope.map((s) => {
      const draft = sessionDraft.safeParse(s.draft);
      const plan = s.snapshot ? sessionSnapshot.safeParse(s.snapshot) : draft;
      const groups = s.assignments.filter((a) => a.targetType === "group").map((a) => groupNames.get(a.targetId) ?? "");
      const athletes = s.assignments.filter((a) => a.targetType === "athlete").length;
      const audience = [...groups, ...(athletes ? [`${athletes} athlète${athletes > 1 ? "s" : ""}`] : [])].join(", ");
      return {
        id: s.id,
        version: s.version,
        publishAt: s.publishAt?.toISOString() ?? null,
        canPublish:
          can(access.role, "manageSessions") &&
          !s.publishedAt &&
          (access.role !== "assistant" || s.createdBy === userId) &&
          (!scopeGroups ||
            (s.assignments.every((a) =>
              a.targetType === "group" ? scopeGroups.includes(a.targetId) : scopeAthletes!.includes(a.targetId),
            ) &&
              s.overrides.every((o) => scopeAthletes!.includes(o.athleteId)))),
        title: s.title,
        type: s.type,
        date: fromDbDate(s.date),
        startTime: s.startTime,
        location: s.location,
        publishedAt: s.publishedAt?.toISOString() ?? null,
        audience,
        hasAutonomous: draft.success ? hasAutonomousVersion(draft.data) : false,
        ...(wantsSummary && plan.success
          ? {
              durationMin: plan.data.durationMin,
              exerciseCount: exerciseCount<{ variant: string; items: unknown[] }>(plan.data.blocks, "club"),
            }
          : {}),
        ...(completionBySession?.has(s.id) ? { completion: completionBySession.get(s.id) } : {}),
      };
    }),
    competitions: competitions.map((c) => ({ id: c.id, name: c.name, date: fromDbDate(c.date), location: c.location })),
  };
};

export const saveTemplate = async (userId: string, organizationId: string, draft: SessionDraft) => {
  await requireOrgMember(userId, organizationId, "manageSessions");
  if (!validSessionStructure(draft)) throw invalid();
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
      ...(draft.structureVersion === 2 ? { draft } : {}),
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
  supportsSequences = false,
): Promise<(SessionDraft & { id: string; canDelete: boolean })[]> => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const rows = await prisma.sessionTemplate.findMany({
    where: { organizationId, ...(!supportsSequences ? { draft: { equals: Prisma.DbNull } } : {}) },
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
    canDelete: access.role === "owner" || t.createdBy === userId,
    title: t.title,
    type: t.type,
    durationMin: t.durationMin,
    coachNote: t.coachNote,
    ...(t.draft ? sessionDraft.parse(t.draft) : {}),
    blocks: t.draft
      ? sessionDraft.parse(t.draft).blocks
      : t.blocks.map((b) => ({
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

// Aperçu et confirmation passent par les mêmes verrous ; aucun appel prestataire
// pendant la transaction. Une validation arrivée entre les deux invalide l'aperçu.
const withPrescriptionRefresh = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  confirmation?: ConfirmPrescriptionRefresh,
) => {
  await requireOrgMember(userId, organizationId, "manageSessions");
  return prisma.$transaction(async (tx) => {
    const [space] = await tx.$queryRaw<
      { progression_enabled: boolean }[]
    >`SELECT progression_enabled FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    if (!space?.progression_enabled) throw new AppError(409, "progression_disabled", m.progression.disabled);
    const access = await requireOrgMember(userId, organizationId, "manageSessions");
    await requireSessionWrite(access, sessionId);
    await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const session = await tx.scheduledSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (!session.publishedAt || !session.prescriptionFrozenAt)
      throw new AppError(409, "prescription_not_frozen", m.prescriptionRefresh.unavailable);
    const prepared = await preparePrescriptionRefresh(tx, sessionId);
    let notificationIds: string[] = [];
    if (confirmation) {
      if (confirmation.expectedVersion !== session.version || confirmation.token !== prepared.preview.token)
        throw new AppError(409, "prescription_refresh_conflict", m.prescriptionRefresh.conflict);
      if (!prepared.updates.length) throw invalid(m.prescriptionRefresh.empty);
      const version = session.version + 1;
      await tx.scheduledSession.update({ where: { id: sessionId }, data: { version } });
      await tx.sessionPrescription.createMany({
        data: prepared.updates.map((row) => ({
          scheduledSessionId: sessionId,
          athleteId: row.athleteId,
          sessionVersion: version,
          origin: "load_refresh",
          phaseId: row.phaseId,
          phaseVersion: row.phaseVersion,
          snapshot: row.snapshot as unknown as Prisma.InputJsonValue,
        })),
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: userId,
          action: "prescription_loads_refreshed",
          entity: "scheduled_session",
          entityId: sessionId,
        },
      });
      await tx.organization.update({ where: { id: organizationId }, data: { lastBusinessActivityAt: new Date() } });
      const recipients = await tx.athlete.findMany({
        where: { id: { in: prepared.updates.map((row) => row.athleteId) }, userId: { not: null } },
        select: { userId: true },
      });
      notificationIds = await queueNotifications(
        tx,
        recipients.map((a) => a.userId!),
        "session_updated",
        {
          date: fromDbDate(session.date),
          organizationId,
          sessionId,
          link: `/seance/${sessionId}`,
        },
      );
    }
    return { preview: prepared.preview, notificationIds };
  });
};

export const previewPrescriptionRefresh = async (userId: string, organizationId: string, sessionId: string) =>
  (await withPrescriptionRefresh(userId, organizationId, sessionId)).preview;

export const refreshPublishedLoads = async (
  userId: string,
  organizationId: string,
  sessionId: string,
  input: ConfirmPrescriptionRefresh,
) => {
  const { preview, notificationIds } = await withPrescriptionRefresh(
    userId,
    organizationId,
    sessionId,
    confirmPrescriptionRefresh.parse(input),
  );
  // L'enregistrement est acquis : une panne d'envoi laisse la file au cron.
  try {
    if (notificationIds.length) await dispatchPending(new Date(), notificationIds);
  } catch {
    log.warn("prescription_refresh_delivery_deferred", { organizationId, entityId: sessionId });
  }
  return { id: sessionId, version: preview.sessionVersion + 1 };
};
