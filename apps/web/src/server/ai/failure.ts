import "server-only";
import type { PlannerFailureCode, PlannerStepName } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";

// Statut HTTP de chaque cause : 503 quand il faut attendre ou prévenir, 504 pour un délai, 422 pour un refus.
const FAILURE_STATUS: Record<PlannerFailureCode, number> = {
  configuration: 503,
  saturated: 503,
  unavailable: 502,
  timeout: 504,
  refused: 422,
  incomplete: 502,
  invalid_output: 502,
};
/** Une panne du planificateur, lisible : sa cause, et l'étape où elle est survenue quand elle est connue. */
export class PlannerFailureError extends AppError {
  constructor(
    code: PlannerFailureCode,
    readonly step: PlannerStepName | null = null,
  ) {
    super(FAILURE_STATUS[code], `planner_${code}`, m.aiPlanner.failures[code]);
  }
}
export const plannerFailureError = (code: PlannerFailureCode, step: PlannerStepName | null = null) =>
  new PlannerFailureError(code, step);
