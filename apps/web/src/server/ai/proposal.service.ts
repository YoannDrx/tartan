import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  resolvePlannerExerciseInput,
  type ResolvePlannerExerciseInput,
  clarifyPlannerProposalInput,
  createPlannerProposalInput,
  plannerRichInterpretation,
  exerciseClassification,
  exerciseInput,
  plannerSelection,
  confirmPlannerProposalInput,
  plannerProposalResponse,
  plannerProposalList,
  plannerProposalListQuery,
  type PlannerProposalListQuery,
  previewPlannerLoadsInput,
  plannerLoadsPreview,
  type PreviewPlannerLoadsInput,
  type ConfirmPlannerProposalInput,
  type SaveScheduledSessionInput,
  type PlannerReviewedDraft,
  type ClarifyPlannerProposalInput,
  type CreatePlannerProposalInput,
  plannerFailureCode,
  plannerStepName,
  type PlannerFailureCode,
  type PlannerMatch,
  type PlannerMatchConfidence,
  type PlannerRichInterpretation,
  type PlannerSelection,
  type PlannerStepName,
  type PlannerStreamMatch,
  type PlannerStreamPlanLine,
  type PlannerWarning,
  PLANNER_LEGACY_WARNING_CODES,
  PLANNER_SLOT_EXERCISE_ID,
  PLANNER_SLOT_PREFIX,
} from "@tartan/contracts";
import {
  validatePlannerInterpretation,
  plannerServerEnabled,
  sessionExerciseReferences,
  validSessionStructure,
  plannerSessionToDraft,
  plannerDisplayText,
  plannerRetentionDeadline,
  plannerPhaseChoicesForDate,
  freezePrescription,
  cleanExerciseAliases,
  isSessionAssigned,
  isPlannerSlotToken,
  plannerLegacyInterpretation,
  plannerFillSlot,
  plannerOpenSlots,
  plannerRemoveSlot,
  plannerDraftItemPlace,
  plannerProbableItem,
  plannerRebaseOnDrafts,
  plannerSettleProbable,
  PLANNER_MAX_ADJUSTMENTS,
  PLANNER_MAX_CLARIFICATIONS,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { requireAiConsent } from "./consent.service";
import { env } from "@/lib/env";
import { AppError, forbidden, notFound, invalid } from "@/lib/errors";
import { todayIso } from "@/lib/dates";
import type { AiPlannerProposal, Prisma } from "@/generated/prisma/client";
import { requireOrgMember } from "../access";
import { preparePhasePlanning } from "../training-phases.service";
import { createReviewedPlannerDraft, buildSnapshot } from "../session.service";
import { strengthResolutionInputsForAthletes } from "../strength.service";
import { learnExerciseTermAlias, learnedExerciseAliases } from "./alias.service";
import {
  assertPlannerTargets,
  buildPlannerBindings,
  plannerBindings,
  providerContextFor,
  recheckPlannerBindings,
  type PlannerBindings,
} from "./context";
import { plannerFailureError } from "./failure";
import { fakePlannerEnabled, fakePlannerProvider } from "./fake-provider";
import { matchMovements, runPlannerPipeline, PLANNER_REQUEST_TIMEOUT_MS } from "./pipeline";
import { plannerPlanLines } from "./stream";
import { openAiPlannerProvider, PlannerProviderError, type PlannerProvider } from "./provider";
import {
  completePlannerOperation,
  failPlannerOperation,
  reservePlannerOperation,
  type PlannerOperationClaim,
} from "./usage.service";

// La consigne, cinq réponses aux questions et cinq ajustements au plus.
const messagesSchema = z
  .array(z.string())
  .min(1)
  .max(1 + PLANNER_MAX_CLARIFICATIONS + PLANNER_MAX_ADJUSTMENTS);
const visibleMessages = (messages: string[]) =>
  messages.length > 6 ? [messages[0]!, ...messages.slice(-5)] : messages;
export { plannerFailureError };
// Une panne inattendue (base, code) reste une réponse inexploitable pour le coach : jamais de détail technique.
const failureOf = (error: unknown): PlannerFailureCode | null => {
  if (error instanceof PlannerProviderError) return error.code === "disabled" ? "configuration" : error.code;
  if (error instanceof AppError) return null;
  return "invalid_output";
};
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
  if (!plannerServerEnabled(env()) || !org.aiPlannerEnabled || org.plan === "discovery")
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
  return row.interpretation ? plannerRichInterpretation.parse(row.interpretation).status : "failed";
}
// La cause du dernier échec, s'il porte sur l'opération active : rien quand elle a réussi ou expiré sans cause connue.
async function lastFailure(row: AiPlannerProposal) {
  const operation = await prisma.aiPlannerOperation.findUnique({
    where: { organizationId_id: { organizationId: row.organizationId, id: row.activeOperationId } },
    select: { state: true, failureCode: true, failureStep: true },
  });
  const code = plannerFailureCode.safeParse(operation?.state === "refunded" ? operation.failureCode : null);
  const step = plannerStepName.safeParse(operation?.failureStep);
  return code.success
    ? { code: code.data, message: m.aiPlanner.failures[code.data], step: step.success ? step.data : null }
    : null;
}

const acceptsOf = (bindings: PlannerBindings) => new Set(bindings.accepts ?? []);
const exerciseView = (bindings: PlannerBindings, token: string | null | undefined) => {
  const exercise = token ? bindings.exercises.find((entry) => entry.token === token) : undefined;
  return exercise ? { exerciseId: exercise.id, name: exercise.name } : null;
};
// Les emplacements encore à compléter, avec les fiches voisines proposées et de quoi préremplir une création.
const slotViews = (value: PlannerRichInterpretation, bindings: PlannerBindings) =>
  plannerOpenSlots(value).map((slot) => ({
    id: slot.id,
    said: slot.said,
    session: slot.session,
    block: slot.block,
    item: slot.item,
    candidates: slot.alternatives.flatMap((token) => exerciseView(bindings, token) ?? []),
    ...(slot.suggestion ? { suggestion: slot.suggestion } : {}),
  }));

/**
 * L'adaptateur des clients d'avant : un client qui ne déclare pas `slots` ne sait pas afficher un emplacement à
 * compléter. La séance lui revient donc sous l'ancienne forme, une question nommée sur chaque exercice absent ;
 * il choisit ou crée la fiche, répond, et la demande repart avec ce choix.
 */
export function plannerLegacySlots(value: PlannerRichInterpretation, accepts: ReadonlySet<string>) {
  if (value.status !== "proposal" || accepts.has("slots")) return value;
  const slots = plannerOpenSlots(value);
  if (!slots.length) return value;
  return {
    status: "clarification" as const,
    sessions: [],
    assumptions: [],
    suggestions: [],
    ...(value.understanding ? { understanding: value.understanding } : {}),
    // Trois questions au plus à la fois, comme avant : les suivantes viennent au tour d'après.
    questions: slots.slice(0, 3).map((slot) => ({
      id: slot.id,
      field: "exercise" as const,
      question: m.aiPlanner.unknownExercise(slot.said),
      exerciseName: slot.said,
      options: [],
    })),
  };
}

export async function getPlannerProposal(userId: string, organizationId: string, id: string, now = new Date()) {
  const access = await accessFor(userId, organizationId);
  const row = await owned(userId, organizationId, id, now);
  const selection = plannerSelection.parse(row.selection),
    bindings = plannerBindings.parse(row.bindings);
  await assertPlannerTargets(prisma, access, selection);
  const rich = row.interpretation ? plannerRichInterpretation.parse(row.interpretation) : null;
  return plannerProposalResponse.parse({
    failure: await lastFailure(row),
    id: row.id,
    version: row.version,
    state: await effectiveState(row, now),
    clarificationCount: row.clarificationCount,
    adjustmentCount: row.adjustmentCount,
    expiresAt: row.expiresAt.toISOString(),
    selection,
    // Les applications installées lisent six messages au plus : la consigne, puis les cinq derniers échanges.
    messages: visibleMessages(messagesSchema.parse(row.messages)),
    pendingText: row.pendingMessage,
    // Projection stricte que les applications installées savent lire ; le détail passe par les brouillons préparés.
    interpretation: rich ? plannerLegacyInterpretation(rich) : null,
    understanding: rich?.understanding
      ? {
          intent: rich.understanding.intent,
          summary: plannerDisplayText(rich.understanding.summary, bindings),
          movements: rich.understanding.movements.map((movement) => ({
            said: movement.said,
            prescription: movement.prescription,
            confidence: movement.confidence,
            exercise: exerciseView(bindings, movement.exerciseToken),
          })),
          corrections: rich.understanding.corrections,
        }
      : null,
    ...(rich && acceptsOf(bindings).has("slots")
      ? { slots: slotViews(rich, bindings).map(({ block: _block, item: _item, ...slot }) => slot) }
      : {}),
    targets: bindings.targets.map(({ aliases: _aliases, ...target }) => target),
    // Toute la bibliothèque figée : c'est aussi la liste où le coach peut remplacer un exercice à la relecture.
    exercises: bindings.exercises.map(({ token, id: exerciseId, name, category, updatedAt }) => ({
      token,
      id: exerciseId,
      name,
      category,
      updatedAt,
    })),
    exerciseResolutions: bindings.resolutions
      ?.filter((r) => r.clarificationCount === row.clarificationCount && r.exerciseId)
      .map(({ questionId, exerciseId, name }) => ({ questionId, exerciseId, name })),
    phaseReviews: bindings.phaseReviews,
    draftIds: row.draftIds,
  });
}

// Index privé volontairement sans texte, noms, prescriptions ou échanges. La
// lecture détaillée recontrôle les droits et résout l'état d'une opération interrompue.
export async function listPlannerProposals(
  userId: string,
  organizationId: string,
  input: PlannerProposalListQuery = {},
  now = new Date(),
) {
  const access = await accessFor(userId, organizationId);
  const { before } = plannerProposalListQuery.parse(input);
  const cursor = before
    ? await prisma.aiPlannerProposal.findFirst({
        where: { id: before, organizationId, actorId: userId },
        select: { id: true, createdAt: true },
      })
    : null;
  if (before && !cursor) throw notFound();
  const rows = await prisma.aiPlannerProposal.findMany({
    where: {
      organizationId,
      actorId: userId,
      expiresAt: { gt: now },
      ...(cursor
        ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
    select: { id: true, state: true, selection: true, createdAt: true, expiresAt: true },
  });
  const items = [];
  for (const row of rows.slice(0, 20)) {
    const selection = plannerSelection.parse(row.selection);
    try {
      await assertPlannerTargets(prisma, access, selection);
    } catch (error) {
      // Un changement de groupe peut retirer l'accès à une ancienne proposition.
      // Les erreurs d'infrastructure restent visibles : pas de faux résultat vide.
      if (error instanceof AppError && [403, 404].includes(error.status)) continue;
      throw error;
    }
    items.push({
      id: row.id,
      state: row.state,
      period: selection.period,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    });
  }
  return plannerProposalList.parse({ items, nextCursor: rows.length > 20 ? rows[19]!.id : null });
}

/** Ce que le service donne à voir pendant qu'il travaille : un rappel par étape, noms déjà résolus pour l'écran. */
export type PlannerExecution = {
  provider?: PlannerProvider;
  clock?: () => Date;
  // « Ce que j'ai compris », à mesure qu'il s'écrit.
  onUnderstanding?: (summary: string | null, done: boolean) => void;
  // Les fiches retrouvées pour chaque mouvement cité.
  onMatching?: (movements: PlannerStreamMatch[], done: boolean) => void;
  // Le plan de la séance pendant qu'il s'écrit : noms de blocs et d'exercices, rien d'autre.
  onPlan?: (lines: PlannerStreamPlanLine[]) => void;
  // Les contrôles, et le nombre de réparations ciblées lancées.
  onChecking?: (repairs: number, done: boolean) => void;
};
const isAdjustment = (message: string | null) => Boolean(message?.startsWith(m.aiPlanner.adjustmentPrefix));

/**
 * Un client d'avant choisit un jour à l'écran ; si la demande en cite un autre, c'est la demande qui vaut. La
 * période enregistrée suit alors les séances écrites, sur sept jours au plus : c'est ce que ces clients savent lire.
 * `null` : des jours trop éloignés pour tenir dans une période.
 */
function selectionFor(selection: PlannerSelection, value: PlannerRichInterpretation): PlannerSelection | null {
  const dates = value.sessions.map((session) => session.date).sort();
  if (!dates.length || dates.every((date) => date >= selection.period.from && date <= selection.period.to))
    return selection;
  const period = { from: dates[0]!, to: dates.at(-1)! };
  const shifted = plannerSelection.safeParse({
    ...selection,
    period,
    ...(selection.brief ? { brief: { ...selection.brief, date: period.from } } : {}),
    phaseChoicesByDate: selection.phaseChoicesByDate?.filter((day) => day.date >= period.from && day.date <= period.to),
  });
  const span = (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86400000;
  return shifted.success && span <= 6 ? shifted.data : null;
}

async function executeProposal(
  userId: string,
  organizationId: string,
  proposalId: string,
  operationId: string,
  claim: PlannerOperationClaim,
  execution: PlannerExecution,
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
    const adjusting = isAdjustment(row.pendingMessage) && Boolean(row.interpretation);
    // « Ajuster » envoie la séance précédente : le modèle la modifie au lieu d'en refaire une autre.
    const previous = adjusting ? plannerRichInterpretation.parse(row.interpretation) : undefined;
    // Les alias appris de cet espace, et de lui seul, lus au moment de l'appel : un choix fait hier vaut aujourd'hui.
    const learned = await learnedExerciseAliases(organizationId);
    const context = providerContextFor(selection, bindings, messages, { previous, learned });
    const provider = execution.provider ?? (fakePlannerEnabled() ? fakePlannerProvider() : openAiPlannerProvider());
    const names = new Map(bindings.exercises.map((exercise) => [exercise.token, exercise.name]));
    // Un emplacement n'a pas de fiche : dans le plan diffusé, il porte le terme dit par le coach.
    const slotNames: string[] = [];
    let written = "";
    const result = await runPlannerPipeline(context, provider, {
      onUnderstanding: (summary, done) =>
        execution.onUnderstanding?.(summary === null ? null : plannerDisplayText(summary, bindings), done),
      onMatching: (matches: readonly PlannerMatch[], done) => {
        if (done)
          slotNames.push(...matches.filter((match) => match.confidence === "absent").map((match) => match.said));
        execution.onMatching?.(
          matches.map((match) => ({
            said: match.said,
            confidence: match.confidence,
            name: match.exerciseToken ? (names.get(match.exerciseToken) ?? null) : null,
          })),
          done,
        );
      },
      ...(execution.onPlan
        ? {
            // Le texte du modèle arrive par morceaux : à chaque morceau, les lignes du plan déjà lisibles.
            onComposing: (delta: string) => {
              written += delta;
              execution.onPlan!(
                plannerPlanLines(written, (token) =>
                  isPlannerSlotToken(token)
                    ? (slotNames[Number(token.slice(PLANNER_SLOT_PREFIX.length)) - 1] ?? null)
                    : (names.get(token) ?? null),
                ).map((line) => (line.kind === "block" ? { ...line, label: plannerDisplayText(line.label, bindings) } : line)),
              );
            },
          }
        : {}),
      onChecking: execution.onChecking,
    });
    let value = result.interpretation;
    let stored = selection;
    if (value.status === "proposal") {
      const shifted = selectionFor(selection, value);
      if (!shifted)
        // Des jours trop éloignés pour la période d'un client d'avant : la question nomme la période.
        value = {
          status: "clarification",
          sessions: [],
          assumptions: [],
          suggestions: [],
          ...(value.understanding ? { understanding: value.understanding } : {}),
          questions: [
            {
              id: "date-1",
              field: "date",
              question: m.aiPlanner.askDateOutOfPeriod(
                null,
                historyDate(selection.period.from),
                historyDate(selection.period.to),
              ),
              exerciseName: null,
              options: [],
            },
          ],
        };
      else stored = shifted;
    }
    const checked = validatePlannerInterpretation(value, {
      period: stored.period,
      reviewedInstructions: context.instructions,
      citations: false,
      exercises: new Map<string, { id: string }>([
        ...bindings.exercises.map((e) => [e.token, { id: e.id }] as const),
        // Un emplacement à compléter tient la place d'une fiche jusqu'au choix du coach.
        ...plannerOpenSlots(value).map((slot) => [slot.id, { id: PLANNER_SLOT_EXERCISE_ID }] as const),
      ]),
      targetTokens: new Set(bindings.targets.map((t) => t.token)),
    });
    if (!checked.ok) throw new PlannerProviderError("invalid_output", "compose");
    const interpretation = plannerLegacySlots(checked.value, acceptsOf(bindings));
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
            state: interpretation.status,
            interpretation,
            ...(stored !== selection ? { selection: stored } : {}),
            messages,
            pendingMessage: null,
            version: { increment: 1 },
            ...(row.pendingMessage
              ? adjusting
                ? { adjustmentCount: { increment: 1 } }
                : { clarificationCount: { increment: 1 } }
              : {}),
          },
        });
        return { proposalId, version: saved.version };
      },
      clock(),
    );
    if (completed.state === "refunded") throw new PlannerProviderError("timeout");
  } catch (error) {
    const failure = failureOf(error);
    const step = error instanceof PlannerProviderError ? error.step : null;
    const settled = await failPlannerOperation(
      userId,
      organizationId,
      operationId,
      claim.leaseToken,
      failure ?? undefined,
      step,
    ).catch(() => null);
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
            state: row.interpretation ? plannerRichInterpretation.parse(row.interpretation).status : "failed",
          },
        });
    }
    if (error instanceof AppError) throw error;
    throw plannerFailureError(failure ?? "invalid_output", step);
  }
  return getPlannerProposal(userId, organizationId, proposalId, clock());
}

export async function createPlannerProposal(
  userId: string,
  organizationId: string,
  raw: CreatePlannerProposalInput,
  execution: PlannerExecution = {},
) {
  const input = createPlannerProposalInput.parse(raw),
    clock = execution.clock ?? (() => new Date());
  const now = clock();
  await accessFor(userId, organizationId);
  await requireAiConsent(userId);
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
  input.accepts?.sort();
  input.hints?.equipment?.sort();
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
      // L'heure demandée à l'écran : posée par le serveur quand la demande n'en dit aucune, jamais par le modèle.
      if (input.startTime) bindings.startTime = input.startTime;
      if (input.accepts?.length) bindings.accepts = [...new Set(input.accepts)];
      // Durée, niveau, matériel précisés à l'écran : des indices, que la demande elle-même l'emporte toujours.
      if (input.hints && Object.keys(input.hints).length) bindings.hints = input.hints;
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

type BoundExercise = PlannerBindings["exercises"][number];
type ExerciseRow = {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  classification: Prisma.JsonValue;
  updatedAt: Date;
  strengthLoadKind: string | null;
  organizationId: string | null;
};
/**
 * Une fiche que la demande n'avait pas figée entre dans la proposition : le coach l'a choisie ou créée depuis.
 * Elle reçoit un jeton à la suite des autres. `said` : le terme du coach, gardé comme autre nom pour la suite.
 */
function bindExercise(bindings: PlannerBindings, exercise: ExerciseRow, organizationId: string, said?: string) {
  let bound = bindings.exercises.find((entry) => entry.id === exercise.id);
  if (bound) {
    if (said) bound.aliases = [...new Set([said, ...(bound.aliases ?? [])])].slice(0, 20);
    return bound;
  }
  bound = {
    token: `exercise_${Math.max(0, ...bindings.exercises.map((e) => Number(e.token.split("_")[1]) || 0)) + 1}`,
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    aliases: [...new Set([...(said ? [said] : []), ...exercise.aliases])].slice(0, 20),
    classification: exerciseClassification.nullable().parse(exercise.classification ?? null),
    updatedAt: exercise.updatedAt.toISOString(),
    strengthLoadKind: exercise.strengthLoadKind as BoundExercise["strengthLoadKind"],
    own: exercise.organizationId === organizationId,
  };
  bindings.exercises.push(bound);
  return bound;
}
const draftExerciseIds = (drafts: readonly PlannerReviewedDraft[]) => [
  ...new Set(
    drafts.flatMap((draft) =>
      draft.draft.blocks.flatMap((block) =>
        block.items.flatMap((item) => [item.exerciseId, ...(item.autonomous ? [item.autonomous.exerciseId] : [])]),
      ),
    ),
  ),
];

/**
 * La séance à l'écran devient la séance gardée : avant un ajustement, ou avant de retirer un emplacement. Chaque
 * fiche de l'écran est une fiche visible de l'espace, chaque destinataire un de ceux de la demande ; une fiche que
 * la demande n'avait pas figée (ajoutée, remplaçante, créée depuis) entre alors dans la proposition.
 */
async function rebaseOnScreen(
  tx: Prisma.TransactionClient,
  organizationId: string,
  proposalId: string,
  stored: PlannerRichInterpretation,
  selection: PlannerSelection,
  bindings: PlannerBindings,
  sessions: readonly PlannerReviewedDraft[],
) {
  for (const draft of sessions) await assertReviewedScope(tx, organizationId, draft, selection, bindings, true);
  const bound = new Set(bindings.exercises.map((exercise) => exercise.id));
  const added = draftExerciseIds(sessions).filter((id) => !bound.has(id) && id !== PLANNER_SLOT_EXERCISE_ID);
  if (added.length)
    for (const exercise of await tx.exercise.findMany({
      where: { id: { in: added }, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
      orderBy: { id: "asc" },
    }))
      bindExercise(bindings, exercise, organizationId);
  const rebased = plannerRebaseOnDrafts(stored, sessions, {
    refPrefix: `ai-${proposalId}`,
    exerciseTokens: new Map(bindings.exercises.map((exercise) => [exercise.id, exercise.token])),
    exerciseNames: new Map(bindings.exercises.map((exercise) => [exercise.token, exercise.name])),
    targetTokens: new Map(bindings.targets.map((target) => [`${target.type}:${target.id}`, target.token])),
    slotExerciseId: PLANNER_SLOT_EXERCISE_ID,
  });
  if (!rebased) throw conflict();
  return rebased;
}

export async function clarifyPlannerProposal(
  userId: string,
  organizationId: string,
  proposalId: string,
  raw: ClarifyPlannerProposalInput,
  execution: PlannerExecution = {},
) {
  const input = clarifyPlannerProposalInput.parse(raw),
    clock = execution.clock ?? (() => new Date());
  const now = clock();
  await accessFor(userId, organizationId);
  await requireAiConsent(userId);
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
      const state = await effectiveState(row, now, tx);
      // Une réponse suit une question ; un ajustement suit une proposition. Les brouillons créés la figent.
      // Chacun a son compteur : ajuster une séance ne consomme pas les précisions, et inversement.
      if (
        row.version !== input.expectedVersion ||
        (state !== "clarification" && state !== "proposal") ||
        (state === "proposal"
          ? row.adjustmentCount >= PLANNER_MAX_ADJUSTMENTS
          : row.clarificationCount >= PLANNER_MAX_CLARIFICATIONS)
      )
        throw conflict();
      const selection = plannerSelection.parse(row.selection),
        bindings = plannerBindings.parse(row.bindings);
      await recheckPlannerBindings(tx, access, selection, bindings);
      const previous = plannerRichInterpretation.parse(row.interpretation);
      const pendingMessage =
        state === "proposal"
          ? `${m.aiPlanner.adjustmentPrefix}${input.text}`
          : `${previous.questions.map((q) => q.question).join("\n")}\n${input.text}`;
      // Le contexte complet reste borné, y compris les questions conservées avec la réponse.
      if (pendingMessage.length > 12000) throw conflict();
      // « Ajuster » part de la séance à l'écran : ce que le coach a retouché à la main est ce que le modèle modifie.
      const screen =
        state === "proposal" && input.sessions
          ? await rebaseOnScreen(tx, organizationId, proposalId, previous, selection, bindings, input.sessions)
          : null;
      await tx.aiPlannerProposal.update({
        where: { id: proposalId },
        data: {
          state: "processing",
          activeOperationId: input.operationId,
          pendingMessage,
          ...(screen ? { interpretation: screen.value, bindings: bindings as Prisma.InputJsonValue } : {}),
        },
      });
    },
  );
  return executeProposal(userId, organizationId, proposalId, input.operationId, claim, execution);
}

const fullExercise = exerciseInput.omit({ id: true, media: true }).strict();

/**
 * Le coach tranche sur un mouvement cité : il choisit une fiche, en crée une, ou retire l'emplacement. Aucun appel
 * au modèle, aucun quota, aucune réponse écrite. Deux formes : l'emplacement à compléter d'une séance déjà écrite
 * (clients `slots`), que ce choix remplit sur place ; ou la question nommée de l'ancienne forme, dont le choix
 * vaudra à la reprise. Dans les deux cas, le terme dit et la fiche choisie deviennent un alias appris de l'espace.
 */
export async function resolvePlannerExercise(
  userId: string,
  organizationId: string,
  proposalId: string,
  raw: ResolvePlannerExerciseInput,
  now = new Date(),
) {
  const input = resolvePlannerExerciseInput.parse(raw);
  await accessFor(userId, organizationId);
  await requireAiConsent(userId);
  const fingerprint = plannerFingerprint({
    questionId: input.questionId,
    requestedName: input.requestedName,
    choice: input.choice,
  });
  await prisma.$transaction(
    async (tx) => {
      await lock(tx, organizationId);
      const access = await accessFor(userId, organizationId, tx);
      // Choisir une fiche existante ne modifie pas la bibliothèque ; seule la création l'exige.
      if (input.choice.kind === "create") await requireOrgMember(userId, organizationId, "editExercises", tx);
      const row = await owned(userId, organizationId, proposalId, now, tx);
      const bindings = plannerBindings.parse(row.bindings),
        selection = plannerSelection.parse(row.selection);
      await recheckPlannerBindings(tx, access, selection, bindings);
      let interpretation = plannerRichInterpretation.parse(row.interpretation);
      const previous = bindings.resolutions?.find(
        (r) =>
          r.operationId === input.operationId ||
          // Ancienne forme : la même question ne se tranche qu'une fois par tour de précisions.
          (row.state !== "proposal" && r.questionId === input.questionId && r.clarificationCount === row.clarificationCount),
      );
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw conflict();
        return;
      }
      if (row.version !== input.expectedVersion) throw conflict();
      // La séance à l'écran accompagne le choix : elle devient la base, et rien de ce que le coach a retouché à la
      // main n'est perdu quand la séance est préparée de nouveau.
      const screen =
        row.state === "proposal" && input.sessions
          ? await rebaseOnScreen(tx, organizationId, proposalId, interpretation, selection, bindings, input.sessions)
          : null;
      if (screen) interpretation = screen.value;
      const slot =
        row.state === "proposal" ? plannerOpenSlots(interpretation).find((entry) => entry.id === input.questionId) : undefined;
      // Une fiche « À vérifier », désignée par la référence de son exercice dans les brouillons préparés.
      const place =
        !slot && row.state === "proposal"
          ? plannerDraftItemPlace(screen?.refs.get(input.questionId) ?? input.questionId, `ai-${proposalId}`)
          : null;
      const probable = place ? plannerProbableItem(interpretation, place) : null;
      const question =
        row.state === "clarification"
          ? interpretation.questions.find((q) => q.id === input.questionId && q.field === "exercise")
          : undefined;
      if (
        !slot &&
        !probable &&
        (!question || (question.exerciseName && question.exerciseName !== input.requestedName))
      )
        throw conflict();
      const choice = input.choice;
      // Une fiche à vérifier se valide ou se change pour une fiche de la bibliothèque : ni création, ni retrait.
      if (probable && choice.kind !== "existing") throw conflict();
      // Retirer ne vaut que pour un emplacement : une question de l'ancienne forme attend une fiche.
      if (choice.kind === "remove") {
        if (!slot) throw conflict();
        const removed = plannerRemoveSlot(interpretation, slot.id);
        if (!removed) throw invalid(m.aiPlanner.slotLastExercise);
        bindings.resolutions = [
          ...(bindings.resolutions ?? []),
          {
            operationId: input.operationId,
            questionId: input.questionId,
            requestedName: input.requestedName,
            clarificationCount: row.clarificationCount,
            fingerprint,
            name: slot.said,
          },
        ];
        await tx.aiPlannerProposal.update({
          where: { id: proposalId },
          data: {
            interpretation: removed,
            bindings: bindings as Prisma.InputJsonValue,
            version: { increment: 1 },
          },
        });
        return;
      }
      // Ancienne forme, mode « Proposer » : seules les fiches communes relues, sans création, comme avant.
      const legacyPropose = !slot && !probable && selection.mode === "propose";
      if (legacyPropose && choice.kind === "create") throw invalid(m.aiPlanner.verifiedCatalogRequired);
      let created: z.infer<typeof fullExercise> | null = null;
      if (choice.kind === "create") {
        // Ce que le coach n'a pas rempli vient des valeurs proposées pour l'emplacement, et du terme qu'il a dit.
        const suggestion = slot?.suggestion;
        const parsed = fullExercise.safeParse({
          name: suggestion?.name ?? input.requestedName,
          ...(suggestion
            ? {
                category: suggestion.category,
                strengthLoadKind: suggestion.loadKind,
                classification: { movement: suggestion.movement, equipment: null },
              }
            : {}),
          ...choice.exercise,
        });
        if (!parsed.success) throw invalid();
        created = parsed.data;
      }
      const exercise =
        choice.kind === "existing"
          ? await tx.exercise.findFirst({
              where: { id: choice.exerciseId, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
            })
          : await tx.exercise.create({
              data: {
                organizationId,
                createdBy: userId,
                name: created!.name,
                category: created!.category,
                aliases: cleanExerciseAliases(created!.name, [
                  ...(created!.aliases ?? []),
                  // Le terme dit reste un autre nom de la fiche quand le coach lui en donne un différent.
                  input.requestedName,
                ]),
                tags: created!.tags,
                cues: created!.cues,
                defaultPrescription: created!.defaultPrescription,
                classification: created!.classification ?? undefined,
                strengthLoadKind: created!.strengthLoadKind,
                loadStepKg: created!.loadStepKg,
              },
            });
      if (!exercise) throw notFound();
      if (
        legacyPropose &&
        (!exercise.catalogKey ||
          !exercise.guide ||
          typeof exercise.guide !== "object" ||
          Array.isArray(exercise.guide) ||
          exercise.guide.technicalReview !== "approved")
      )
        throw invalid(m.aiPlanner.verifiedCatalogRequired);
      // Le terme dit par le coach : celui de l'emplacement ou de la fiche à vérifier, sinon celui de la question.
      const said = slot?.said ?? probable?.said ?? input.requestedName;
      const current = bindExercise(bindings, exercise, organizationId, said);
      bindings.resolutions = [
        ...(bindings.resolutions ?? []),
        {
          operationId: input.operationId,
          questionId: input.questionId,
          requestedName: input.requestedName,
          clarificationCount: row.clarificationCount,
          fingerprint,
          exerciseId: exercise.id,
          name: exercise.name,
        },
      ];
      // Le choix du coach est retenu pour la fois suivante, dans cet espace seulement.
      await learnExerciseTermAlias(userId, organizationId, { said, exerciseId: exercise.id }, tx);
      await tx.aiPlannerProposal.update({
        where: { id: proposalId },
        data: {
          // L'emplacement est rempli sur place, la fiche à vérifier validée ou changée sur place : la prescription
          // dite ne bouge pas, rien n'est réécrit.
          ...(slot
            ? { interpretation: plannerFillSlot(interpretation, slot.id, current.token) }
            : probable && place
              ? { interpretation: plannerSettleProbable(interpretation, place, current.token) }
              : screen
                ? { interpretation }
                : {}),
          bindings: bindings as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
    },
    { timeout: 30000, maxWait: 10000 },
  );
  return getPlannerProposal(userId, organizationId, proposalId, now);
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
      const output = plannerRichInterpretation.parse(row.interpretation);
      const accepts = acceptsOf(bindings);
      const sessions: PlannerReviewedDraft[] = [];
      const warnings: {
        code: PlannerWarning["code"];
        field: PlannerWarning["field"];
        itemRef: string | null;
        detail: string | null;
        alternatives?: { exerciseId: string; name: string }[];
        said?: string;
      }[][] = [];
      const refOf = (session: number, block: number, item: number) => `ai-${proposalId}-${session}-b${block}-i${item}`;
      for (const [index, session] of output.sessions.entries()) {
        const prefix = `ai-${proposalId}-${index}`;
        // Chaque point « À vérifier » vise l'exercice du brouillon : sa référence suit la même règle que la conversion.
        warnings.push(
          (session.warnings ?? [])
            // Un client d'avant ne connaît que les six premiers codes : les nouveaux ne lui sont pas envoyés.
            .filter((warning) => accepts.has("checks") || PLANNER_LEGACY_WARNING_CODES.includes(warning.code))
            .map((warning) => {
              const item =
                warning.block !== null && warning.item !== null
                  ? session.blocks[warning.block]?.items[warning.item]
                  : undefined;
              const alternatives =
                warning.code === "approximate_exercise"
                  ? (item?.alternatives ?? []).flatMap((token) => exerciseView(bindings, token) ?? [])
                  : [];
              return {
                code: warning.code,
                field: warning.field,
                itemRef:
                  warning.block !== null && warning.item !== null ? refOf(index, warning.block, warning.item) : null,
                detail: warning.detail === null ? null : plannerDisplayText(warning.detail, bindings),
                ...(alternatives.length ? { alternatives } : {}),
                // Le terme que le coach a dit, à côté de la fiche rapprochée pour lui.
                ...(warning.code === "approximate_exercise" && item?.said ? { said: item.said } : {}),
              };
            }),
        );
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
          startTime: session.startTime ?? bindings.startTime ?? null,
          location: null,
          publishAt: null,
          assignments,
          overrides: [],
          ...(phaseReview ? { phaseReview } : {}),
          draft: (() => {
            const draft = plannerSessionToDraft(
              session,
              new Map<string, { id: string }>([
                ...bindings.exercises.map((entry) => [entry.token, { id: entry.id }] as const),
                // Un emplacement à compléter n'a pas de fiche : son exercice porte l'identifiant réservé.
                ...plannerOpenSlots({ sessions: [session] }).map(
                  (slot) => [slot.id, { id: PLANNER_SLOT_EXERCISE_ID }] as const,
                ),
              ]),
              prefix,
            );
            return {
              ...draft,
              title: plannerDisplayText(draft.title, bindings),
              blocks: draft.blocks.map((block) => ({
                ...block,
                name: plannerDisplayText(block.name, bindings),
                items: block.items.map((item) => ({
                  ...item,
                  prescription: {
                    ...item.prescription,
                    ...(item.prescription.notes
                      ? { notes: plannerDisplayText(item.prescription.notes, bindings) }
                      : {}),
                  },
                })),
              })),
            };
          })(),
        });
      }
      const slots = slotViews(output, bindings).map(({ block, item, ...slot }) => ({
        ...slot,
        itemRef: refOf(slot.session, block, item),
      }));
      return { proposalId, version: row.version, sessions, warnings, ...(accepts.has("slots") ? { slots } : {}) };
    },
    { timeout: 30000 },
  );
}

/**
 * La séance relue reste dans le cadre de la proposition : sa période, ses destinataires, une structure valide.
 * Ses fiches sont celles de la demande, ou toute autre fiche visible de l'espace (commune ou de l'espace, non
 * supprimée) : le coach ajoute et remplace dans toute sa bibliothèque, pas seulement dans ce que la demande avait
 * figé. Jamais la fiche d'un autre espace. `slots` : un emplacement à compléter y garde sa place (séance à l'écran
 * envoyée comme base) ; il reste refusé pour un aperçu des charges et pour un brouillon.
 */
async function assertReviewedScope(
  tx: Prisma.TransactionClient,
  organizationId: string,
  draft: PlannerReviewedDraft,
  selection: ReturnType<typeof plannerSelection.parse>,
  bindings: PlannerBindings,
  slots = false,
) {
  const targets = new Set(bindings.targets.map((t) => `${t.type}:${t.id}`));
  const exercises = new Set(bindings.exercises.map((e) => e.id));
  if (slots) exercises.add(PLANNER_SLOT_EXERCISE_ID);
  const allItems = draft.draft.blocks.flatMap((b) => b.items);
  if (!validSessionStructure(draft.draft)) throw conflict();
  const outside = draftExerciseIds([draft]).filter((id) => !exercises.has(id));
  if (outside.length) {
    const visible = await tx.exercise.findMany({
      where: { id: { in: outside }, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
      select: { id: true },
    });
    if (visible.length !== outside.length) throw conflict();
    for (const exercise of visible) exercises.add(exercise.id);
  }
  const items = sessionExerciseReferences(draft.draft);
  if (
    draft.date < selection.period.from ||
    draft.date > selection.period.to ||
    !draft.assignments.length ||
    draft.assignments.some((a) => !targets.has(`${a.targetType}:${a.targetId}`)) ||
    allItems.some((i) => !i.ref) ||
    new Set(allItems.map((i) => i.ref)).size !== allItems.length ||
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
      await assertReviewedScope(tx, organizationId, input.session, selection, bindings);
      const athletes = await reviewedAudience(tx, organizationId, input.session);
      const start = input.afterAthleteId ? athletes.findIndex((a) => a.id === input.afterAthleteId) + 1 : 0;
      if (input.afterAthleteId && !start) throw invalid();
      const itemCount = sessionExerciseReferences(input.session.draft).size;
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
            b.items
              .filter((item) => item.kind !== "recovery")
              .map((item) => ({
                ref: item.ref,
                exerciseId: item.exerciseId,
                name: item.rounds?.length
                  ? `${item.name} · ${item.rounds.map((r) => m.builder.sequence.round(r.name, r.round, r.rounds)).join(" · ")}`
                  : item.name,
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
      const stored = plannerRichInterpretation.parse(row.interpretation);
      // Le brouillon ne se crée qu'une fois chaque emplacement tranché : fiche choisie, fiche créée, ou retiré.
      if (plannerOpenSlots(stored).length) throw new AppError(409, "planner_slots_open", m.aiPlanner.slotsOpen);
      const sessions: { id: string; version: number }[] = [];
      for (const draft of input.sessions) {
        await assertReviewedScope(tx, organizationId, draft, selection, bindings);
        await reviewedAudience(tx, organizationId, draft);
        sessions.push(await createReviewedPlannerDraft(tx, userId, organizationId, draft));
      }
      // Une fiche « probable » que le coach a remplacée avant de créer le brouillon : son choix est retenu.
      const reviewed = new Map(
        input.sessions.flatMap((draft) => draft.draft.blocks.flatMap((block) => block.items.map((i) => [i.ref, i]))),
      );
      const idOf = new Map(bindings.exercises.map((exercise) => [exercise.token, exercise.id]));
      for (const [s, session] of stored.sessions.entries())
        for (const [b, block] of session.blocks.entries())
          for (const [i, item] of block.items.entries()) {
            const kept = reviewed.get(`ai-${proposalId}-${s}-b${b}-i${i}`);
            if (item.confidence === "probable" && item.said && kept && kept.exerciseId !== idOf.get(item.exerciseToken))
              await learnExerciseTermAlias(userId, organizationId, { said: item.said, exerciseId: kept.exerciseId }, tx);
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

export type PlannerTermMatch = {
  said: string;
  confidence: PlannerMatchConfidence;
  exercise: { exerciseId: string; name: string } | null;
  alternatives: { exerciseId: string; name: string }[];
  suggestion?: PlannerMatch["suggestion"];
};
/**
 * L'étape « Retrouver » seule : des termes dits, les fiches de l'espace. Pour mesurer cette étape sans passer par
 * une consigne entière (`apps/web/evals/e2e`). Mêmes droits, même accord et mêmes alias appris que le planificateur ;
 * rien n'est écrit, rien n'est décompté.
 */
export async function matchPlannerTerms(
  userId: string,
  organizationId: string,
  terms: readonly string[],
  execution: Pick<PlannerExecution, "provider" | "clock"> = {},
): Promise<PlannerTermMatch[]> {
  const said = z.array(z.string().trim().min(1).max(120)).min(1).max(60).parse(terms);
  const access = await accessFor(userId, organizationId);
  await requireAiConsent(userId);
  const now = (execution.clock ?? (() => new Date()))();
  const today = todayIso(now);
  const selection = plannerSelection.parse({
    period: { from: today, to: today },
    groupIds: [],
    athleteIds: [],
    exerciseIds: [],
    phaseChoices: [],
  });
  const bindings = await buildPlannerBindings(prisma, access, selection, now);
  const context = providerContextFor(selection, bindings, [said.join("\n")], {
    learned: await learnedExerciseAliases(organizationId),
  });
  const provider = execution.provider ?? (fakePlannerEnabled() ? fakePlannerProvider() : openAiPlannerProvider());
  let matches: PlannerMatch[];
  try {
    matches = await matchMovements(
      context,
      said.map((term, index) => ({ id: `m${index + 1}`, said: term, prescription: null })),
      provider,
      AbortSignal.timeout(PLANNER_REQUEST_TIMEOUT_MS),
    );
  } catch (error) {
    const failure = failureOf(error);
    if (!failure) throw error;
    throw plannerFailureError(failure, error instanceof PlannerProviderError ? error.step : null);
  }
  return matches.map((match) => ({
    said: match.said,
    confidence: match.confidence,
    exercise: exerciseView(bindings, match.exerciseToken),
    alternatives: match.alternatives.flatMap((token) => exerciseView(bindings, token) ?? []),
    ...(match.suggestion ? { suggestion: match.suggestion } : {}),
  }));
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
