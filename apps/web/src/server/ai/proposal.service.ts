import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  clarifyPlannerProposalInput,
  createPlannerProposalInput,
  plannerInterpretation,
  plannerSelection,
  confirmPlannerProposalInput,
  plannerProposalResponse,
  previewPlannerLoadsInput,
  plannerLoadsPreview,
  type PreviewPlannerLoadsInput,
  type ConfirmPlannerProposalInput,
  type SaveScheduledSessionInput,
  type PlannerReviewedDraft,
  type ClarifyPlannerProposalInput,
  type CreatePlannerProposalInput,
} from "@tartan/contracts";
import {
  validatePlannerInterpretation,
  plannerPrescriptionToSession,
  plannerRetentionDeadline,
  plannerPhaseChoicesForDate,
  freezePrescription,
  isSessionAssigned,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { AppError, forbidden, notFound, invalid } from "@/lib/errors";
import { todayIso } from "@/lib/dates";
import type { AiPlannerProposal, Prisma } from "@/generated/prisma/client";
import { requireOrgMember } from "../access";
import { preparePhasePlanning } from "../training-phases.service";
import { createReviewedPlannerDraft, buildSnapshot } from "../session.service";
import { strengthResolutionInputsForAthletes } from "../strength.service";
import {
  assertPlannerTargets,
  buildPlannerBindings,
  plannerBindings,
  providerContextFor,
  recheckPlannerBindings,
  type PlannerBindings,
} from "./context";
import { openAiPlannerProvider, type PlannerProvider } from "./provider";
import {
  completePlannerOperation,
  failPlannerOperation,
  reservePlannerOperation,
  type PlannerOperationClaim,
} from "./usage.service";

const messagesSchema = z.array(z.string()).min(1).max(6);
const conflict = () => new AppError(409, "planner_proposal_conflict", m.aiPlanner.proposalConflict);
const expired = () => new AppError(410, "planner_expired", m.aiPlanner.expiredRequest);
export const plannerFingerprint = (input: unknown) =>
  createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update("tartan-planner-v1\n")
    .update(JSON.stringify(input))
    .digest("hex");
const lock = async (tx: Prisma.TransactionClient, organizationId: string) => {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
};
async function accessFor(userId: string, organizationId: string, db: Prisma.TransactionClient = prisma) {
  const access = await requireOrgMember(userId, organizationId, "manageSessions", db);
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { aiPlannerEnabled: true, plan: true },
  });
  if (env().AI_PLANNER_ENABLED !== "true" || !org.aiPlannerEnabled || org.plan === "discovery")
    throw new AppError(403, "planner_disabled", m.aiPlanner.disabled);
  return access;
}
async function owned(
  userId: string,
  organizationId: string,
  id: string,
  now: Date,
  db: Prisma.TransactionClient = prisma,
) {
  const row = await db.aiPlannerProposal.findFirst({ where: { id, organizationId } });
  if (!row) throw notFound();
  if (row.actorId !== userId) throw forbidden();
  if (row.expiresAt <= now) throw expired();
  return row;
}
async function effectiveState(row: AiPlannerProposal, now: Date, db: Prisma.TransactionClient = prisma) {
  if (row.state !== "processing") return row.state;
  const operation = await db.aiPlannerOperation.findUnique({
    where: { organizationId_id: { organizationId: row.organizationId, id: row.activeOperationId } },
  });
  if (operation?.state === "pending" && operation.leaseUntil > now) return "processing";
  return row.interpretation ? plannerInterpretation.parse(row.interpretation).status : "failed";
}

export async function getPlannerProposal(userId: string, organizationId: string, id: string, now = new Date()) {
  const access = await accessFor(userId, organizationId);
  const row = await owned(userId, organizationId, id, now);
  const selection = plannerSelection.parse(row.selection),
    bindings = plannerBindings.parse(row.bindings);
  await assertPlannerTargets(prisma, access, selection);
  return plannerProposalResponse.parse({
    id: row.id,
    version: row.version,
    state: await effectiveState(row, now),
    clarificationCount: row.clarificationCount,
    expiresAt: row.expiresAt.toISOString(),
    selection,
    messages: messagesSchema.parse(row.messages),
    pendingText: row.pendingMessage,
    interpretation: row.interpretation ? plannerInterpretation.parse(row.interpretation) : null,
    targets: bindings.targets.map(({ aliases: _aliases, ...target }) => target),
    exercises: bindings.exercises,
    phaseReviews: bindings.phaseReviews,
    draftIds: row.draftIds,
  });
}
type Execution = { provider?: PlannerProvider; clock?: () => Date };
async function executeProposal(
  userId: string,
  organizationId: string,
  proposalId: string,
  operationId: string,
  claim: PlannerOperationClaim,
  execution: Execution,
) {
  const clock = execution.clock ?? (() => new Date());
  if (claim.state !== "claimed") return getPlannerProposal(userId, organizationId, proposalId, clock());
  try {
    const access = await accessFor(userId, organizationId);
    const row = await owned(userId, organizationId, proposalId, clock());
    const selection = plannerSelection.parse(row.selection),
      bindings = plannerBindings.parse(row.bindings);
    await assertPlannerTargets(prisma, access, selection);
    const messages = [...messagesSchema.parse(row.messages), ...(row.pendingMessage ? [row.pendingMessage] : [])];
    const context = providerContextFor(selection, bindings, messages);
    const raw = await (execution.provider ?? openAiPlannerProvider()).interpret(context);
    const checked = validatePlannerInterpretation(raw, {
      period: selection.period,
      reviewedInstructions: context.instructions,
      exercises: new Map(bindings.exercises.map((e) => [e.token, { id: e.id }])),
      targetTokens: new Set(bindings.targets.map((t) => t.token)),
    });
    if (!checked.ok) throw new Error("planner_invalid_output");
    const completed = await completePlannerOperation(
      userId,
      organizationId,
      operationId,
      claim.leaseToken,
      async (tx) => {
        const currentAccess = await accessFor(userId, organizationId, tx);
        const current = await owned(userId, organizationId, proposalId, clock(), tx);
        if (
          current.version !== row.version ||
          current.activeOperationId !== operationId ||
          current.state !== "processing"
        )
          throw conflict();
        await recheckPlannerBindings(tx, currentAccess, selection, bindings);
        const saved = await tx.aiPlannerProposal.update({
          where: { id: proposalId },
          data: {
            state: checked.value.status,
            interpretation: checked.value,
            messages,
            pendingMessage: null,
            version: { increment: 1 },
            ...(row.pendingMessage ? { clarificationCount: { increment: 1 } } : {}),
          },
        });
        return { proposalId, version: saved.version };
      },
      clock(),
    );
    if (completed.state === "refunded") throw new Error("planner_result_expired");
  } catch (error) {
    const settled = await failPlannerOperation(userId, organizationId, operationId, claim.leaseToken).catch(() => null);
    if (settled?.state === "succeeded") return getPlannerProposal(userId, organizationId, proposalId, clock());
    // Conserver l’ancienne clarification et la réponse saisie pour une reprise explicite.
    if (settled?.state === "refunded") {
      const row = await prisma.aiPlannerProposal.findFirst({
        where: { id: proposalId, organizationId, actorId: userId },
      });
      if (row)
        await prisma.aiPlannerProposal.updateMany({
          where: { id: row.id, organizationId, actorId: userId, activeOperationId: operationId, state: "processing" },
          data: {
            state: row.interpretation ? plannerInterpretation.parse(row.interpretation).status : "failed",
          },
        });
    }
    if (error instanceof AppError) throw error;
    throw new AppError(502, "planner_generation_failed", m.aiPlanner.proposalFailed);
  }
  return getPlannerProposal(userId, organizationId, proposalId, clock());
}

export async function createPlannerProposal(
  userId: string,
  organizationId: string,
  raw: CreatePlannerProposalInput,
  execution: Execution = {},
) {
  const input = createPlannerProposalInput.parse(raw),
    clock = execution.clock ?? (() => new Date());
  const now = clock();
  await accessFor(userId, organizationId);
  const requestedAt = new Date(input.requestedAt);
  if (requestedAt.getTime() > now.getTime() + 5 * 60000 || requestedAt.getTime() + 7 * 86400000 <= now.getTime())
    throw expired();
  // Canoniser seulement les collections de sélection ; le texte reste celui qui a été relu.
  input.selection.groupIds.sort();
  input.selection.athleteIds.sort();
  input.selection.exerciseIds.sort();
  input.selection.phaseChoices.sort((a, b) => a.athleteId.localeCompare(b.athleteId));
  input.selection.phaseChoicesByDate?.sort((a, b) => a.date.localeCompare(b.date));
  for (const day of input.selection.phaseChoicesByDate ?? [])
    day.choices.sort((a, b) => a.athleteId.localeCompare(b.athleteId));
  const fingerprint = plannerFingerprint(input);
  const claim = await reservePlannerOperation(
    userId,
    organizationId,
    { id: input.id, kind: "proposal", fingerprint },
    now,
    async (tx) => {
      const access = await accessFor(userId, organizationId, tx);
      if (await tx.aiPlannerProposal.findUnique({ where: { id: input.id }, select: { id: true } })) throw conflict();
      const bindings = await buildPlannerBindings(tx, access, input.selection, now);
      await tx.aiPlannerProposal.create({
        data: {
          id: input.id,
          organizationId,
          actorId: userId,
          creationFingerprint: fingerprint,
          selection: input.selection,
          bindings: bindings as Prisma.InputJsonValue,
          messages: [input.text],
          activeOperationId: input.id,
          expiresAt: new Date(Math.min(now.getTime(), requestedAt.getTime()) + 7 * 86400000),
          createdAt: now,
        },
      });
    },
  );
  return executeProposal(userId, organizationId, input.id, input.id, claim, execution);
}

export async function clarifyPlannerProposal(
  userId: string,
  organizationId: string,
  proposalId: string,
  raw: ClarifyPlannerProposalInput,
  execution: Execution = {},
) {
  const input = clarifyPlannerProposalInput.parse(raw),
    clock = execution.clock ?? (() => new Date());
  const now = clock();
  await accessFor(userId, organizationId);
  await owned(userId, organizationId, proposalId, now);
  const claim = await reservePlannerOperation(
    userId,
    organizationId,
    {
      id: input.operationId,
      kind: "clarification",
      proposalId,
      fingerprint: plannerFingerprint({ proposalId, ...input }),
    },
    now,
    async (tx) => {
      const access = await accessFor(userId, organizationId, tx),
        row = await owned(userId, organizationId, proposalId, now, tx);
      if (
        row.version !== input.expectedVersion ||
        (await effectiveState(row, now, tx)) !== "clarification" ||
        row.clarificationCount >= 5
      )
        throw conflict();
      const selection = plannerSelection.parse(row.selection),
        bindings = plannerBindings.parse(row.bindings);
      await recheckPlannerBindings(tx, access, selection, bindings);
      const previous = plannerInterpretation.parse(row.interpretation);
      const pendingMessage = `${previous.questions.map((q) => q.question).join("\n")}\n${input.text}`;
      // Le contexte complet reste borné, y compris les questions conservées avec la réponse.
      if (pendingMessage.length > 12000) throw conflict();
      await tx.aiPlannerProposal.update({
        where: { id: proposalId },
        data: { state: "processing", activeOperationId: input.operationId, pendingMessage },
      });
    },
  );
  return executeProposal(userId, organizationId, proposalId, input.operationId, claim, execution);
}

export async function preparePlannerDrafts(
  userId: string,
  organizationId: string,
  proposalId: string,
  expectedVersion: number,
  now = new Date(),
) {
  await accessFor(userId, organizationId);
  return prisma.$transaction(
    async (tx) => {
      await lock(tx, organizationId);
      const access = await accessFor(userId, organizationId, tx),
        row = await owned(userId, organizationId, proposalId, now, tx);
      if (row.version !== expectedVersion || row.state !== "proposal") throw conflict();
      const selection = plannerSelection.parse(row.selection),
        bindings = plannerBindings.parse(row.bindings);
      await recheckPlannerBindings(tx, access, selection, bindings);
      const output = plannerInterpretation.parse(row.interpretation);
      const sessions: PlannerReviewedDraft[] = [];
      for (const [index, session] of output.sessions.entries()) {
        const assignments = session.targetTokens.map((token) => {
          const target = bindings.targets.find((t) => t.token === token);
          if (!target) throw conflict();
          return { targetType: target.type, targetId: target.id };
        });
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { phasesEnabled: true },
        });
        let phaseReview: SaveScheduledSessionInput["phaseReview"];
        if (org.phasesEnabled) {
          const targets = {
            date: session.date,
            groupIds: assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
            athleteIds: assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
          };
          const preliminary = await preparePhasePlanning(access, { ...targets, choices: [] }, tx);
          const choices = plannerPhaseChoicesForDate(selection, session.date).filter((c) =>
            preliminary.athletes.some((a) => a.id === c.athleteId),
          );
          const phases = choices.length ? await preparePhasePlanning(access, { ...targets, choices }, tx) : preliminary;
          if (phases.athletes.some((a) => a.result.kind === "choose_group")) throw conflict();
          phaseReview = { token: phases.token, choices };
        }
        sessions.push({
          date: session.date,
          startTime: session.startTime,
          location: null,
          publishAt: null,
          assignments,
          overrides: [],
          ...(phaseReview ? { phaseReview } : {}),
          draft: {
            title: session.title,
            type: session.type,
            durationMin: session.durationMin,
            coachNote: null,
            blocks: session.blocks.map((block, b) => ({
              ref: `ai-${proposalId}-${index}-b${b}`,
              name: block.name,
              variant: "club",
              items: block.items.map((item, i) => {
                const exercise = bindings.exercises.find((e) => e.token === item.exerciseToken);
                if (!exercise) throw conflict();
                return {
                  ref: `ai-${proposalId}-${index}-b${b}-i${i}`,
                  exerciseId: exercise.id,
                  prescription: plannerPrescriptionToSession(item.prescription, exercise.id),
                };
              }),
            })),
          },
        });
      }
      return { proposalId, version: row.version, sessions };
    },
    { timeout: 30000 },
  );
}

function assertReviewedScope(
  draft: PlannerReviewedDraft,
  selection: ReturnType<typeof plannerSelection.parse>,
  bindings: PlannerBindings,
) {
  const targets = new Set(bindings.targets.map((t) => `${t.type}:${t.id}`));
  const exercises = new Set(bindings.exercises.map((e) => e.id));
  const allItems = draft.draft.blocks.flatMap((b) => b.items);
  const items = new Map(allItems.map((i) => [i.ref, i] as const));
  if (
    draft.date < selection.period.from ||
    draft.date > selection.period.to ||
    !draft.assignments.length ||
    draft.assignments.some((a) => !targets.has(`${a.targetType}:${a.targetId}`)) ||
    allItems.some((i) => !i.ref) ||
    items.size !== allItems.length ||
    allItems.some(
      (i) =>
        !exercises.has(i.exerciseId) ||
        (i.prescription.load?.type === "pct_1rm" && i.prescription.load.test !== `exercise:${i.exerciseId}`),
    ) ||
    draft.overrides.some(
      (o) =>
        !items.has(o.itemRef) ||
        (o.prescription.load?.type === "pct_1rm" &&
          o.prescription.load.test !== `exercise:${items.get(o.itemRef)?.exerciseId}`),
    ) ||
    new Set(draft.overrides.map((o) => `${o.athleteId}:${o.itemRef}`)).size !== draft.overrides.length
  )
    throw conflict();
}

async function reviewedAudience(tx: Prisma.TransactionClient, organizationId: string, draft: PlannerReviewedDraft) {
  const direct = draft.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  const groups = draft.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const rows = await tx.athlete.findMany({
    where: { organizationId, OR: [{ id: { in: direct } }, { groups: { some: { groupId: { in: groups } } } }] },
    select: { id: true, firstName: true, lastName: true, groups: { select: { groupId: true, createdAt: true } } },
    orderBy: { id: "asc" },
  });
  const athletes = rows.filter((a) =>
    isSessionAssigned({
      date: draft.date,
      assignments: draft.assignments,
      athleteId: a.id,
      hasLog: false,
      groups: a.groups.map((g) => ({ groupId: g.groupId, joinedOn: todayIso(g.createdAt) })),
    }),
  );
  if (draft.overrides.some((o) => !athletes.some((a) => a.id === o.athleteId))) throw forbidden();
  return athletes;
}

// Aperçu local au serveur, sans appel IA, sans quota et sans écriture de séance.
// Dix athlètes par page pour borner les réponses avec des groupes de 120 personnes.
export async function previewPlannerLoads(
  userId: string,
  organizationId: string,
  proposalId: string,
  raw: PreviewPlannerLoadsInput,
  now = new Date(),
) {
  const input = previewPlannerLoadsInput.parse(raw);
  await accessFor(userId, organizationId);
  return prisma.$transaction(
    async (tx) => {
      await lock(tx, organizationId);
      const access = await accessFor(userId, organizationId, tx),
        row = await owned(userId, organizationId, proposalId, now, tx);
      if (row.version !== input.expectedVersion || row.state !== "proposal") throw conflict();
      const selection = plannerSelection.parse(row.selection),
        bindings = plannerBindings.parse(row.bindings);
      await recheckPlannerBindings(tx, access, selection, bindings);
      assertReviewedScope(input.session, selection, bindings);
      const athletes = await reviewedAudience(tx, organizationId, input.session);
      const start = input.afterAthleteId ? athletes.findIndex((a) => a.id === input.afterAthleteId) + 1 : 0;
      if (input.afterAthleteId && !start) throw invalid();
      const itemCount = input.session.draft.blocks.reduce((sum, block) => sum + block.items.length, 0);
      const pageSize = Math.min(10, Math.max(1, Math.floor(1500 / Math.max(1, itemCount))));
      const page = athletes.slice(start, start + pageSize);
      const [snapshot, references] = await Promise.all([
        buildSnapshot(organizationId, input.session.draft, tx),
        strengthResolutionInputsForAthletes(
          tx,
          page.map((a) => a.id),
        ),
      ]);
      return plannerLoadsPreview.parse({
        athleteCount: athletes.length,
        offset: start,
        nextCursor: start + page.length < athletes.length ? page.at(-1)!.id : null,
        athletes: page.map((a) => ({
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          items: freezePrescription(
            snapshot,
            references.get(a.id) ?? [],
            input.session.overrides.filter((o) => o.athleteId === a.id),
          ).blocks.flatMap((b) =>
            b.items.map((item) => ({
              ref: item.ref,
              exerciseId: item.exerciseId,
              name: item.name,
              prescription: item.prescription,
              resolvedLoadKg: item.resolvedLoadKg ?? null,
              source: item.strengthReference
                ? {
                    value: item.strengthReference.value,
                    kind: item.strengthReference.originKind ?? item.strengthReference.kind,
                    date: item.strengthReference.date,
                  }
                : null,
            })),
          ),
        })),
      });
    },
    { timeout: 30000 },
  );
}

export async function confirmPlannerProposal(
  userId: string,
  organizationId: string,
  proposalId: string,
  raw: ConfirmPlannerProposalInput,
  now = new Date(),
) {
  const input = confirmPlannerProposalInput.parse(raw);
  await accessFor(userId, organizationId);
  const fingerprint = plannerFingerprint(input);
  return prisma.$transaction(
    async (tx) => {
      await lock(tx, organizationId);
      const access = await accessFor(userId, organizationId, tx),
        row = await owned(userId, organizationId, proposalId, now, tx);
      const selection = plannerSelection.parse(row.selection),
        bindings = plannerBindings.parse(row.bindings);
      await assertPlannerTargets(tx, access, selection);
      if (row.state === "committed") {
        if (row.commitFingerprint !== fingerprint) throw conflict();
        return {
          sessions: z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })).parse(row.draftIds),
        };
      }
      if (row.version !== input.expectedVersion || row.state !== "proposal") throw conflict();
      await recheckPlannerBindings(tx, access, selection, bindings);
      const sessions: { id: string; version: number }[] = [];
      for (const draft of input.sessions) {
        assertReviewedScope(draft, selection, bindings);
        await reviewedAudience(tx, organizationId, draft);
        sessions.push(await createReviewedPlannerDraft(tx, userId, organizationId, draft));
      }
      await tx.aiPlannerProposal.update({
        where: { id: proposalId },
        data: {
          state: "committed",
          version: { increment: 1 },
          committedAt: now,
          commitFingerprint: fingerprint,
          draftIds: sessions,
          expiresAt: new Date(
            Math.min(row.expiresAt.getTime(), plannerRetentionDeadline(row.createdAt, now).getTime()),
          ),
        },
      });
      await tx.organization.update({ where: { id: organizationId }, data: { lastBusinessActivityAt: now } });
      return { sessions };
    },
    { timeout: 30000 },
  );
}

// Cron authentifié ; l’effacement reste actif même si le planificateur est coupé.
export async function purgePlannerProposals(now = new Date()) {
  const due = await prisma.aiPlannerProposal.findMany({
    where: { expiresAt: { lte: now } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: 50,
  });
  let removed = 0;
  for (const row of due)
    removed += await prisma.$transaction(async (tx) => {
      await lock(tx, row.organizationId);
      return (
        await tx.aiPlannerProposal.deleteMany({
          where: { organizationId: row.organizationId, expiresAt: { lte: now } },
        })
      ).count;
    });
  return { removed };
}
