import "server-only";
import { plannerComposition, type PlannerComposition, type PlannerRichInterpretation } from "@tartan/contracts";
import {
  plannerCheckComposition,
  plannerCompositionToInterpretation,
  plannerSettleComposition,
  type PlannerCheckContext,
  type PlannerRequest,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import type { PlannerComposePlan } from "./compose";
import { plannerStep } from "./step";
import { PlannerProviderError, type PlannerProvider, type PlannerProviderContext } from "./types";

export const PLANNER_MAX_REPAIRS = 2;

/**
 * Étape 4, « Contrôler » : les règles de `packages/domain` confrontent la séance à ce que le coach a dit. Un
 * défaut qui exige de réécrire part en réparation ciblée, deux fois au plus : le modèle reçoit sa réponse
 * précédente et la liste précise de ses défauts. Une réparation qui échoue ou n'améliore rien n'est pas une
 * panne : la meilleure réponse est gardée, et ce qui reste douteux devient un point « À vérifier ».
 */
export async function checkSession(
  context: PlannerProviderContext,
  request: PlannerRequest,
  plan: PlannerComposePlan,
  composition: PlannerComposition,
  provider: PlannerProvider,
  deadline: AbortSignal,
  onChecking?: (repairs: number, done: boolean) => void,
): Promise<PlannerRichInterpretation> {
  const adjusting = Boolean(context.previous);
  const rules: PlannerCheckContext = {
    instructions: context.instructions,
    // « Ajuster » : les séances sont celles d'avant ; la fidélité à la demande d'origine ne se rejoue pas.
    request: adjusting
      ? {
          sessions: plan.frame.sessions.map((session) => ({
            date: session.date,
            dateSaid: null,
            startTime: session.startTime,
            targetTokens: [...session.targetTokens],
            movements: [],
            structure: null,
            proposal: null,
          })),
        }
      : request,
    movements: plan.frame.movements,
    percentTokens: new Set(plan.input.percentAllowed),
    units: new Map(context.exercises.flatMap((exercise) => (exercise.unit ? [[exercise.token, exercise.unit]] : []))),
    knownLoads: plan.knownLoads,
    adjusting,
    fallbackTitle: m.aiPlanner.fallbackSessionTitle,
  };
  const judge = (answer: PlannerComposition, final = false) => {
    const converted = plannerCompositionToInterpretation(answer, plan.frame);
    return plannerCheckComposition(converted.value, converted.indexes, rules, final);
  };
  let answer = composition;
  let checked = judge(answer);
  let repairs = 0;
  onChecking?.(0, false);
  while (checked.defects.length && repairs < PLANNER_MAX_REPAIRS && !deadline.aborted) {
    repairs++;
    onChecking?.(repairs, false);
    let repaired: PlannerComposition;
    try {
      const defects = checked.defects.slice(0, 20);
      repaired = await plannerStep("repair", deadline, plannerComposition, (signal) =>
        provider.repair({ ...plan.input, previousAnswer: answer, defects }, { signal }),
      );
    } catch (cause) {
      if (cause instanceof PlannerProviderError) break;
      throw cause;
    }
    const next = judge(repaired);
    if (next.defects.length >= checked.defects.length) break;
    answer = repaired;
    checked = next;
  }
  // Une charge que le coach n'a pas dite ne survit jamais : après la dernière réparation, elle est retirée.
  if (checked.defects.some((defect) => defect.code === "invented_load")) checked = judge(answer, true);
  const settled = plannerSettleComposition(checked, rules);
  if (!settled) throw new PlannerProviderError("invalid_output", "compose");
  onChecking?.(repairs, true);
  return settled.value;
}
