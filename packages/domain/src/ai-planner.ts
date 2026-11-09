import {
  plannerInterpretation,
  plannerPeriod,
  prescriptionSchema,
  type PlannerInterpretation,
  type PlannerPrescription,
  type Prescription,
  type PlannerSelection,
} from "@tartan/contracts";
import type { PlanKey } from "./plans";

export const PLANNER_MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const PLANNER_MAX_AUDIO_SECONDS = 180;
export const PLANNER_MAX_CLARIFICATIONS = 5;
export const plannerPhaseChoicesForDate = (selection: PlannerSelection, date: string) =>
  selection.phaseChoicesByDate?.find((day) => day.date === date)?.choices ?? selection.phaseChoices;
export const plannerLimits = (plan: PlanKey) =>
  plan === "discovery"
    ? { proposals: 0, audioSeconds: 0 }
    : plan === "club"
      ? { proposals: 150, audioSeconds: 300 * 60 }
      : { proposals: 30, audioSeconds: 60 * 60 };

// Les compteurs sont à lire/réserver atomiquement dans le service ; cette fonction
// pure ne prétend pas verrouiller ni dédupliquer une consommation.
export function plannerQuotaFits(
  plan: PlanKey,
  used: { proposals: number; audioSeconds: number },
  requested: { proposals: number; audioSeconds: number },
) {
  if (
    ![used.proposals, used.audioSeconds, requested.proposals, requested.audioSeconds].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    )
  )
    return false;
  if (plan === "discovery") return false;
  const limit = plannerLimits(plan);
  return (
    used.proposals + requested.proposals <= limit.proposals &&
    used.audioSeconds + requested.audioSeconds <= limit.audioSeconds
  );
}

export const plannerProposalsExhausted = (usage: {
  limit: { proposals: number };
  used: { proposals: number };
  reserved: { proposals: number };
}) => usage.used.proposals + usage.reserved.proposals >= usage.limit.proposals;

// Le planificateur s'ouvre dès qu'une clé est configurée ; "false" reste le coupe-circuit.
// "true" sans clé conserve l'accès aux parcours avec un prestataire de remplacement.
export function plannerServerEnabled(settings: {
  AI_PLANNER_ENABLED?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  OPEN_AI_API_KEY?: string | undefined;
}) {
  if (settings.AI_PLANNER_ENABLED === "false") return false;
  return settings.AI_PLANNER_ENABLED === "true" || Boolean(settings.OPENAI_API_KEY ?? settings.OPEN_AI_API_KEY);
}

export function plannerAudioIsWithinLimits(bytes: number, seconds: number) {
  return (
    Number.isSafeInteger(bytes) &&
    bytes > 0 &&
    bytes <= PLANNER_MAX_AUDIO_BYTES &&
    Number.isFinite(seconds) &&
    seconds > 0 &&
    seconds <= PLANNER_MAX_AUDIO_SECONDS
  );
}

export function plannerRetentionDeadline(createdAt: Date, draftsCreatedAt: Date | null): Date {
  const abandoned = createdAt.getTime() + 7 * 86400000;
  // Une conversion ne rallonge jamais la conservation d’une proposition presque expirée.
  return new Date(draftsCreatedAt ? Math.min(abandoned, draftsCreatedAt.getTime() + 86400000) : abandoned);
}

export function plannerPrescriptionToSession(input: PlannerPrescription, exerciseId: string): Prescription {
  return prescriptionSchema.parse({
    ...(input.sets !== null ? { sets: input.sets } : {}),
    ...(input.reps !== null ? { reps: input.reps } : {}),
    ...(input.distanceM !== null ? { distance_m: input.distanceM } : {}),
    ...(input.durationS !== null ? { duration_s: input.durationS } : {}),
    ...(input.restS !== null ? { rest_s: input.restS } : {}),
    ...(input.tempo !== null ? { tempo: input.tempo } : {}),
    ...(input.contacts !== null ? { ground_contacts: input.contacts } : {}),
    ...(input.notes !== null ? { notes: input.notes } : {}),
    ...(input.intensityTarget !== null ? { intensityTarget: input.intensityTarget } : {}),
    ...(input.load !== null
      ? { load: input.load.type === "pct_1rm" ? { ...input.load, test: `exercise:${exerciseId}` } : input.load }
      : {}),
  });
}

export type PlannerValidationContext = {
  period: { from: string; to: string };
  exercises: ReadonlyMap<string, { id: string }>;
  targetTokens: ReadonlySet<string>;
  // Seulement les consignes et réponses relues ; jamais de notes privées ou santé structurée.
  reviewedInstructions: readonly string[];
};
export type PlannerValidationIssue =
  "shape" | "state" | "date" | "target" | "exercise" | "prescription" | "instruction";
export function validatePlannerInterpretation(
  raw: unknown,
  context: PlannerValidationContext,
): { ok: true; value: PlannerInterpretation } | { ok: false; issues: PlannerValidationIssue[] } {
  const parsed = plannerInterpretation.safeParse(raw);
  if (!parsed.success || !plannerPeriod.safeParse(context.period).success) return { ok: false, issues: ["shape"] };
  const value = parsed.data,
    issues = new Set<PlannerValidationIssue>();
  if (value.status === "clarification") {
    if (!value.questions.length || value.sessions.length) issues.add("state");
  } else if (value.questions.length || !value.sessions.length) issues.add("state");
  if (new Set(value.questions.map((q) => q.id)).size !== value.questions.length) issues.add("state");
  for (const session of value.sessions) {
    if (session.date < context.period.from || session.date > context.period.to) issues.add("date");
    if (
      new Set(session.targetTokens).size !== session.targetTokens.length ||
      session.targetTokens.some((token) => !context.targetTokens.has(token))
    )
      issues.add("target");
    for (const block of session.blocks)
      for (const item of block.items) {
        const exercise = context.exercises.get(item.exerciseToken);
        if (!exercise) issues.add("exercise");
        if (!context.reviewedInstructions.some((text) => text.includes(item.instruction))) issues.add("instruction");
        try {
          // Validation du contrat métier existant : pas de valeur de force ni conversion RPE → kg.
          plannerPrescriptionToSession(item.prescription, exercise?.id ?? "unresolved");
        } catch {
          issues.add("prescription");
        }
      }
  }
  return issues.size ? { ok: false, issues: [...issues] } : { ok: true, value };
}
