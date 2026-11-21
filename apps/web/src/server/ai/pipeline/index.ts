import "server-only";
import type { PlannerMatch, PlannerRichInterpretation } from "@tartan/contracts";
import { plannerDistinctQuestions, type PlannerBlocker, type PlannerRequest } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { checkSession } from "./check";
import { composeSession, planComposition } from "./compose";
import { matchMovements } from "./match";
import { PLANNER_REQUEST_TIMEOUT_MS } from "./step";
import {
  plannerProviderContext,
  PlannerProviderError,
  type PlannerProvider,
  type PlannerProviderContext,
} from "./types";
import { understandRequest } from "./understand";

export { checkSession, PLANNER_MAX_REPAIRS } from "./check";
export { composeSession, planComposition } from "./compose";
export { matchMovements } from "./match";
export { understandRequest } from "./understand";
export { PLANNER_REQUEST_TIMEOUT_MS, PLANNER_STEP_TIMEOUT_MS } from "./step";
export * from "./types";

/** Ce que les étapes donnent à voir pendant qu'elles travaillent. Aucun contenu privé : résumé, noms, avancée. */
export type PlannerPipelineEvents = {
  onUnderstanding?: (summary: string | null, done: boolean) => void;
  onMatching?: (matches: readonly PlannerMatch[], done: boolean) => void;
  // Le texte de la séance à mesure que le modèle l'écrit.
  onComposing?: (delta: string) => void;
  onChecking?: (repairs: number, done: boolean) => void;
};
export type PlannerPipelineResult = {
  interpretation: PlannerRichInterpretation;
  request: PlannerRequest;
  matches: PlannerMatch[];
};

const t = m.aiPlanner;
/**
 * Les seules questions qui arrêtent le coach : aucune date déductible, aucun destinataire, demande hors sujet (ou
 * vide, ou trop longue). Chacune nomme ce dont elle parle.
 */
export function plannerBlockerQuestions(
  blockers: readonly PlannerBlocker[],
  context: Pick<PlannerProviderContext, "period" | "targets">,
): PlannerRichInterpretation["questions"] {
  const from = historyDate(context.period.from),
    to = historyDate(context.period.to);
  return plannerDistinctQuestions(
    blockers.map((blocker) => {
      if (blocker.kind === "off_topic")
        return { id: "off-topic", field: "other" as const, question: t.askOffTopic, exerciseName: null, options: [] };
      if (blocker.kind === "empty")
        return { id: "empty-request", field: "other" as const, question: t.clarifyEmpty, exerciseName: null, options: [] };
      if (blocker.kind === "too_many_sessions")
        return {
          id: "session-count",
          field: "other" as const,
          question: t.clarifySessionCount,
          exerciseName: null,
          options: [],
        };
      if (blocker.kind === "no_date")
        return {
          id: `date-${blocker.session + 1}`,
          field: "date" as const,
          question: blocker.outOfPeriod
            ? t.askDateOutOfPeriod(blocker.said, from, to)
            : t.askDate(blocker.said, from, to),
          exerciseName: null,
          options: [],
        };
      return {
        id: `recipient-${blocker.session + 1}`,
        field: "target" as const,
        question: t.askRecipient,
        exerciseName: null,
        // Les jetons deviennent des noms à l'écran ; la réponse du coach redevient un jeton avant de repartir.
        options: context.targets.slice(0, 5).map((target) => target.token),
      };
    }),
  );
}

/**
 * Les quatre étapes pour un contexte déjà construit, sans base : ce que mesurent les anciens corpus de régression
 * (`evals/planner-*.ts`), écrits pour l'adaptateur à un seul appel.
 */
export const interpretPlannerContext = async (context: PlannerProviderContext, provider: PlannerProvider) =>
  (await runPlannerPipeline(context, provider)).interpretation;

/**
 * Les quatre étapes, dans l'ordre : comprendre, retrouver, composer, contrôler. Sans base ni droits : le service
 * construit le contexte, appelle cette fonction, puis enregistre. Tout prestataire passe par les mêmes contrôles.
 */
export async function runPlannerPipeline(
  raw: PlannerProviderContext,
  provider: PlannerProvider,
  events: PlannerPipelineEvents = {},
): Promise<PlannerPipelineResult> {
  const parsed = plannerProviderContext.safeParse(raw);
  if (!parsed.success) throw new PlannerProviderError("configuration");
  const context = parsed.data;
  if (
    new Set(context.targets.map((target) => target.token)).size !== context.targets.length ||
    new Set(context.exercises.map((exercise) => exercise.token)).size !== context.exercises.length
  )
    throw new PlannerProviderError("configuration");
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: context.timeZone });
  } catch {
    throw new PlannerProviderError("configuration");
  }
  const deadline = AbortSignal.timeout(PLANNER_REQUEST_TIMEOUT_MS);
  const adjusting = Boolean(context.previous);

  const request = await understandRequest(context, provider, deadline, events.onUnderstanding);
  const understanding = (matches: readonly PlannerMatch[]) => ({
    intent: request.intent,
    summary: request.summary,
    movements: request.sessions.flatMap((session) =>
      session.movements.map((movement) => {
        const match = matches.find((entry) => entry.id === movement.id);
        return {
          said: movement.said,
          prescription: movement.prescription,
          confidence: match?.confidence ?? ("absent" as const),
          exerciseToken: match?.exerciseToken ?? null,
        };
      }),
    ),
    corrections: request.corrections,
  });
  // Un ajustement modifie une séance qui a déjà sa date et ses destinataires : rien ne peut lui manquer.
  if (!adjusting && request.blockers.length)
    return {
      interpretation: {
        status: "clarification",
        questions: plannerBlockerQuestions(request.blockers, context),
        sessions: [],
        assumptions: [],
        suggestions: [],
        understanding: understanding([]),
      },
      request,
      matches: [],
    };

  const movements = request.sessions.flatMap((session) => session.movements);
  events.onMatching?.([], false);
  const matches = await matchMovements(context, movements, provider, deadline);
  events.onMatching?.(matches, true);

  const plan = planComposition(context, request, matches);
  const composition = await composeSession(plan.input, provider, deadline, events.onComposing);
  const interpretation = await checkSession(context, request, plan, composition, provider, deadline, events.onChecking);
  return { interpretation: { ...interpretation, understanding: understanding(matches) }, request, matches };
}
