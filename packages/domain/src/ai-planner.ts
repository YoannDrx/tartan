import {
  plannerInterpretation,
  plannerPeriod,
  prescriptionSchema,
  type PlannerInterpretation,
  type PlannerPrescription,
  type Prescription,
  type PlannerSelection,
  type PlannerBrief,
  type ExerciseClassification,
  type SessionDraft,
  type SequenceNode,
} from "@tartan/contracts";
import { validSessionStructure } from "./session-sequence";
import { plannerEquipmentAvailable } from "./planner-equipment";
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
  mode?: "format" | "propose";
  brief?: PlannerBrief;
  period: { from: string; to: string };
  exercises: ReadonlyMap<string, { id: string; classification?: ExerciseClassification | null }>;
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
  if (context.mode === "propose" && (!context.brief || (value.status === "proposal" && value.sessions.length !== 1)))
    issues.add("state");
  for (const session of value.sessions) {
    if (
      context.mode === "propose" &&
      (session.date !== context.brief?.date ||
        session.durationMin === null ||
        session.durationMin > context.brief.durationMin)
    )
      issues.add("date");
    if (session.date < context.period.from || session.date > context.period.to) issues.add("date");
    if (
      new Set(session.targetTokens).size !== session.targetTokens.length ||
      session.targetTokens.some((token) => !context.targetTokens.has(token))
    )
      issues.add("target");
    if (session.blocks.some((block) => block.sequence))
      try {
        const shape = plannerSessionToDraft(
          session,
          new Map(
            [...context.exercises.keys()].map((token) => [token, { id: "00000000-0000-4000-8000-000000000001" }]),
          ),
          "validation",
        );
        if (!validSessionStructure(shape)) issues.add("shape");
      } catch {
        issues.add("shape");
      }
    for (const block of session.blocks)
      for (const item of block.items) {
        const exercise = context.exercises.get(item.exerciseToken);
        if (
          !exercise ||
          (context.mode === "propose" &&
            !plannerEquipmentAvailable(exercise.classification, context.brief?.equipment ?? []))
        )
          issues.add("exercise");
        if (context.mode === "propose" && item.prescription.load !== null) issues.add("prescription");
        if (context.mode !== "propose" && !context.reviewedInstructions.some((text) => text.includes(item.instruction)))
          issues.add("instruction");
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

/** One conversion shared by validation and draft creation, preserving the real circuit order. */
export function plannerSessionToDraft(
  session: PlannerInterpretation["sessions"][number],
  exercises: ReadonlyMap<string, { id: string }>,
  prefix: string,
): SessionDraft {
  const structured = session.blocks.some((block) => block.sequence != null);
  return {
    title: session.title,
    type: session.type,
    durationMin: session.durationMin,
    coachNote: null,
    ...(structured ? { structureVersion: 2 as const } : {}),
    blocks: session.blocks.map((block, b) => {
      const refs = new Map<string, string>();
      block.items.forEach((item, i) => {
        if (item.ref) refs.set(item.ref, `${prefix}-b${b}-i${i}`);
      });
      let nodeIndex = 0;
      const mapNodes = (nodes: SequenceNode[]): SequenceNode[] =>
        nodes.map((node) => {
          if (node.kind === "exercise") return { ...node, itemRef: refs.get(node.itemRef) ?? "missing" };
          const ref = `${prefix}-b${b}-n${nodeIndex++}`;
          return node.kind === "recovery"
            ? { ...node, ref }
            : ({ ...node, ref, children: mapNodes(node.children) } as SequenceNode);
        });
      const items = block.items.map((item, i) => {
        const exercise = exercises.get(item.exerciseToken);
        if (!exercise) throw new Error("planner_exercise_unresolved");
        return {
          ref: `${prefix}-b${b}-i${i}`,
          exerciseId: exercise.id,
          prescription: plannerPrescriptionToSession(item.prescription, exercise.id),
        };
      });
      return {
        ref: `${prefix}-b${b}`,
        name: block.name,
        variant: "club" as const,
        items,
        ...(structured
          ? {
              sequence: block.sequence
                ? mapNodes(block.sequence)
                : items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref })),
            }
          : {}),
      };
    }),
  };
}
