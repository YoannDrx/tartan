import "server-only";
import type { z } from "zod";
import type { PlannerStepName } from "@tartan/contracts";
import { PlannerProviderError } from "./types";

// Chaque étape a son délai, sous le délai de la demande entière. Les quatre tiennent dans la durée d'une requête
// (120 s) : comprendre et retrouver sont des appels courts au modèle rapide, composer est l'appel long.
export const PLANNER_STEP_TIMEOUT_MS: Record<PlannerStepName, number> = {
  understand: 25_000,
  match: 25_000,
  compose: 70_000,
  repair: 45_000,
};
export const PLANNER_REQUEST_TIMEOUT_MS = 100_000;

/**
 * Un appel d'étape : son délai, sa sortie vérifiée, et une panne qui dit toujours à quelle étape elle est
 * survenue. Le délai vaut même pour un prestataire qui n'écoute pas le signal.
 */
export async function plannerStep<T>(
  step: PlannerStepName,
  deadline: AbortSignal,
  schema: z.ZodType<T>,
  call: (signal: AbortSignal) => Promise<unknown>,
): Promise<T> {
  const signal = AbortSignal.any([deadline, AbortSignal.timeout(PLANNER_STEP_TIMEOUT_MS[step])]);
  let output: unknown;
  try {
    output = await Promise.race([
      call(signal),
      new Promise<never>((_, reject) => {
        const expire = () => reject(new PlannerProviderError("timeout", step));
        if (signal.aborted) expire();
        else signal.addEventListener("abort", expire, { once: true });
      }),
    ]);
  } catch (cause) {
    if (cause instanceof PlannerProviderError) throw cause.step ? cause : new PlannerProviderError(cause.code, step);
    if (signal.aborted) throw new PlannerProviderError("timeout", step);
    // Une erreur inattendue du prestataire reste une réponse inexploitable : jamais un détail technique.
    throw new PlannerProviderError("invalid_output", step);
  }
  const parsed = schema.safeParse(output);
  if (!parsed.success) throw new PlannerProviderError("invalid_output", step);
  return parsed.data;
}
