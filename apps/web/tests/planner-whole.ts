// Prestataire d'essai « d'une seule pièce » : il rend la séance entière pour un contexte, sans passer par les
// quatre étapes. Les essais du service (quotas, baux, droits, brouillons) portent sur ce que le service fait d'une
// séance, pas sur la façon dont elle est écrite : les étapes ont leurs propres essais (`ai-pipeline.test.ts`).
import { vi, type Mock } from "vitest";
import type { PlannerInterpretation, PlannerRichInterpretation } from "@tartan/contracts";
import type * as Pipeline from "@/server/ai/pipeline";
import type { PlannerProvider, PlannerProviderContext } from "@/server/ai/provider";

type Whole = (
  context: PlannerProviderContext,
  events: Pipeline.PlannerPipelineEvents,
) => Promise<PlannerInterpretation | PlannerRichInterpretation>;
export type WholeProvider = PlannerProvider & { interpret: Mock<Whole> };

const unused = async (): Promise<never> => {
  throw new Error("le prestataire d'une seule pièce ne passe pas par les étapes");
};
export const wholeProvider = (interpret: Whole): WholeProvider => ({
  interpret: vi.fn(interpret),
  understand: unused,
  match: unused,
  compose: unused,
  repair: unused,
});

/** À poser sur `@/server/ai/pipeline` : un prestataire qui a `interpret` court-circuite les étapes. */
export const wholePipeline = (actual: typeof Pipeline): typeof Pipeline => ({
  ...actual,
  runPlannerPipeline: async (context, provider, events = {}) => {
    const whole = (provider as Partial<WholeProvider>).interpret;
    if (!whole) return actual.runPlannerPipeline(context, provider, events);
    const interpretation = await whole(actual.plannerProviderContext.parse(context), events);
    return {
      interpretation: interpretation as PlannerRichInterpretation,
      request: { intent: "described", summary: "", corrections: [], sessions: [], blockers: [] },
      matches: [],
    };
  },
});
