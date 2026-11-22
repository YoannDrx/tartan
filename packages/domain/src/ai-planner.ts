import {
  plannerRichInterpretation,
  plannerPeriod,
  prescriptionSchema,
  type PlannerRichInterpretation,
  type PlannerRichPrescription,
  type PlannerRichSession,
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
// Les ajustements d'une proposition ont leur propre compteur : ils ne consomment ni précision ni quota.
export const PLANNER_MAX_ADJUSTMENTS = 5;
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

const plannerLoad = (load: NonNullable<PlannerPrescription["load"]>, exerciseId: string) =>
  load.type === "pct_1rm" ? { ...load, test: `exercise:${exerciseId}` } : load;

export function plannerPrescriptionToSession(
  input: PlannerPrescription | PlannerRichPrescription,
  exerciseId: string,
): Prescription {
  const plan = "setPlan" in input ? input.setPlan : null;
  if (plan?.length) {
    // Le résumé suit toujours le détail : nombre de séries, répétitions et charge de la première série de travail.
    const work = plan.find((set) => !set.warmup) ?? plan[0]!;
    input = { ...input, sets: plan.length, reps: work.reps ?? input.reps, load: work.load ?? input.load };
  }
  return prescriptionSchema.parse({
    // Séries détaillées : chaque série garde ses répétitions et sa charge ; `sets`, `reps` et `load` restent alignés.
    ...(plan?.length
      ? {
          setPlan: plan.map((set) => ({
            ...(set.reps !== null ? { reps: set.reps } : {}),
            ...(set.load !== null ? { load: plannerLoad(set.load, exerciseId) } : {}),
            ...(set.warmup ? { warmup: true } : {}),
          })),
        }
      : {}),
    ...(input.sets !== null ? { sets: input.sets } : {}),
    ...(input.reps !== null ? { reps: input.reps } : {}),
    ...(input.distanceM !== null ? { distance_m: input.distanceM } : {}),
    ...(input.durationS !== null ? { duration_s: input.durationS } : {}),
    ...(input.restS !== null ? { rest_s: input.restS } : {}),
    ...(input.tempo !== null ? { tempo: input.tempo } : {}),
    ...(input.contacts !== null ? { ground_contacts: input.contacts } : {}),
    ...(input.notes !== null ? { notes: input.notes } : {}),
    ...(input.intensityTarget !== null ? { intensityTarget: input.intensityTarget } : {}),
    ...(input.load !== null ? { load: plannerLoad(input.load, exerciseId) } : {}),
  });
}

/** Toutes les charges d'un exercice proposé : la prescription, chaque série détaillée et le remplacement en autonomie. */
export const plannerItemLoads = (item: {
  prescription: PlannerRichPrescription | PlannerPrescription;
  autonomous?: { prescription: PlannerRichPrescription } | null;
}) =>
  [item.prescription, ...(item.autonomous ? [item.autonomous.prescription] : [])].flatMap(
    (p: PlannerRichPrescription | PlannerPrescription) => [
      ...(p.load ? [p.load] : []),
      ...((p as PlannerRichPrescription).setPlan ?? []).flatMap((set) => (set.load ? [set.load] : [])),
    ],
  );

export type PlannerValidationContext = {
  mode?: "format" | "propose";
  brief?: PlannerBrief;
  period: { from: string; to: string };
  exercises: ReadonlyMap<string, { id: string; classification?: ExerciseClassification | null }>;
  targetTokens: ReadonlySet<string>;
  // Seulement les consignes et réponses relues ; jamais de notes privées ou santé structurée.
  reviewedInstructions: readonly string[];
  // Faux depuis le planificateur en quatre étapes : un exercice n'est plus rattaché à la demande par une citation
  // exacte, mais par le mouvement cité qu'il exécute (`movementId`), contrôlé par `plannerCheckComposition`.
  citations?: boolean;
  // Mode « Proposer » : exercices dont tous les destinataires ont une référence de force. Seul un pourcentage
  // du maximum y est admis, résolu par Tartan pour chacun ; un kilo proposé reste toujours refusé.
  percentTokens?: ReadonlySet<string>;
};

/** Mode « Proposer » : aucune charge, sauf un pourcentage là où chaque destinataire a sa référence de force. */
export function plannerLoadsAllowed(
  item: {
    exerciseToken: string;
    prescription: PlannerRichPrescription | PlannerPrescription;
    autonomous?: { exerciseToken: string; prescription: PlannerRichPrescription } | null;
  },
  percentTokens: ReadonlySet<string> = new Set(),
) {
  const allowed = (token: string, prescription: PlannerRichPrescription | PlannerPrescription) =>
    plannerItemLoads({ prescription }).every((load) => load.type === "pct_1rm" && percentTokens.has(token));
  return (
    allowed(item.exerciseToken, item.prescription) &&
    (!item.autonomous || allowed(item.autonomous.exerciseToken, item.autonomous.prescription))
  );
}
export type PlannerValidationIssue =
  "shape" | "state" | "date" | "target" | "exercise" | "prescription" | "instruction";
export function validatePlannerInterpretation(
  raw: unknown,
  context: PlannerValidationContext,
): { ok: true; value: PlannerRichInterpretation } | { ok: false; issues: PlannerValidationIssue[] } {
  const parsed = plannerRichInterpretation.safeParse(raw);
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
    if (session.blocks.some((block) => !block.items.length && !block.sequence?.length)) issues.add("shape");
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
        const tokens = [item.exerciseToken, ...(item.autonomous ? [item.autonomous.exerciseToken] : [])];
        for (const token of tokens) {
          const exercise = context.exercises.get(token);
          if (
            !exercise ||
            (context.mode === "propose" &&
              !plannerEquipmentAvailable(exercise.classification, context.brief?.equipment ?? []))
          )
            issues.add("exercise");
        }
        if (context.mode === "propose" && !plannerLoadsAllowed(item, context.percentTokens)) issues.add("prescription");
        if (
          context.citations !== false &&
          context.mode !== "propose" &&
          !context.reviewedInstructions.some((text) => text.includes(item.instruction))
        )
          issues.add("instruction");
        try {
          // Validation du contrat métier existant : pas de valeur de force ni conversion RPE → kg.
          plannerPrescriptionToSession(item.prescription, context.exercises.get(item.exerciseToken)?.id ?? "unresolved");
          if (item.autonomous)
            plannerPrescriptionToSession(
              item.autonomous.prescription,
              context.exercises.get(item.autonomous.exerciseToken)?.id ?? "unresolved",
            );
        } catch {
          issues.add("prescription");
        }
      }
  }
  return issues.size ? { ok: false, issues: [...issues] } : { ok: true, value };
}

/** One conversion shared by validation and draft creation, preserving the real circuit order. */
export function plannerSessionToDraft(
  session: PlannerInterpretation["sessions"][number] | PlannerRichSession,
  exercises: ReadonlyMap<string, { id: string }>,
  prefix: string,
  options: { structured?: boolean } = {},
): SessionDraft {
  // `structured` : le web relit toujours la séance dans l'éditeur de séquence du constructeur.
  const structured = options.structured || session.blocks.some((block) => block.sequence != null);
  // Un remplacement en autonomie rend toute la séance commune : chacun la fait, l'autonomie avec ses remplacements.
  const shared = session.blocks.some((block) => block.items.some((item) => "autonomous" in item && item.autonomous));
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
        const away = "autonomous" in item && item.autonomous ? item.autonomous : null;
        const replacement = away ? exercises.get(away.exerciseToken) : null;
        if (away && !replacement) throw new Error("planner_exercise_unresolved");
        return {
          ref: `${prefix}-b${b}-i${i}`,
          exerciseId: exercise.id,
          prescription: plannerPrescriptionToSession(item.prescription, exercise.id),
          ...(away && replacement
            ? {
                autonomous: {
                  exerciseId: replacement.id,
                  prescription: plannerPrescriptionToSession(away.prescription, replacement.id),
                },
              }
            : {}),
        };
      });
      return {
        ref: `${prefix}-b${b}`,
        name: block.name,
        variant: shared ? ("both" as const) : ("club" as const),
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
