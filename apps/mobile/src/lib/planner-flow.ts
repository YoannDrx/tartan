import {
  PLANNER_SLOT_EXERCISE_ID,
  clarifyPlannerProposalInput,
  createPlannerProposalInput,
  plannerReviewedDraft,
  trainingEquipment,
  type ExerciseCategory,
  type ExerciseLoadKind,
  type PlannerCapability,
  type PlannerDraftsResponse,
  type PlannerRequestHintsInput,
  type PlannerReviewedDraft,
  type PlannerSelection,
  type PlannerSlotSuggestion,
  type QuickExerciseInput,
} from "@tartan/contracts";
import {
  findExerciseByName,
  normalizeExerciseTerm,
  rankPlannerCandidates,
  replacedExercisePrescription,
  sessionExerciseReferences,
  suggestExerciseDefaults,
  withSessionSequences,
} from "@tartan/domain";

// Le planificateur de l'app native, sans React Native : la demande en un écran, l'état de chaque exercice de la
// séance, ce qui retient encore le brouillon, la recherche dans la bibliothèque et la création rapide d'une fiche.
// Mêmes règles que l'écran web (`apps/web/src/features/planner`).

export type PlannerLevel = "beginner" | "intermediate" | "advanced";
export type PlannerEquipment = (typeof trainingEquipment.options)[number];
export const PLANNER_DURATIONS = [20, 30, 45, 60, 75, 90, 120] as const;
export const PLANNER_LEVELS: readonly PlannerLevel[] = ["beginner", "intermediate", "advanced"];
export const PLANNER_TEXT_LIMIT = 12000;
/** Cet écran sait montrer les emplacements à compléter et les nouveaux points « À vérifier ». */
export const PLANNER_NATIVE_ACCEPTS: PlannerCapability[] = ["slots", "checks"];

export type PlannerRequestValue = {
  groupIds: string[];
  athleteIds: string[];
  date: string;
  text: string;
  // Précisions facultatives : rien n'est supposé tant que le coach ne les touche pas.
  startTime: string;
  durationMin: number | null;
  level: PlannerLevel | null;
  equipment: PlannerEquipment[];
};

export const plannerRequestFrom = (
  selection: Pick<PlannerSelection, "groupIds" | "athleteIds" | "period">,
  equipment: PlannerEquipment[],
  text = "",
): PlannerRequestValue => ({
  groupIds: selection.groupIds,
  athleteIds: selection.athleteIds,
  date: selection.period.from,
  text,
  startTime: "",
  durationMin: null,
  level: null,
  equipment,
});

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Durée, niveau, et matériel seulement s'il diffère du profil de l'espace : ce que le serveur ne sait pas déjà. */
export const plannerHints = (
  value: PlannerRequestValue,
  spaceEquipment: readonly PlannerEquipment[],
): PlannerRequestHintsInput => ({
  ...(value.durationMin ? { durationMin: value.durationMin } : {}),
  ...(value.level ? { level: value.level } : {}),
  ...(!sameSet(value.equipment, spaceEquipment) ? { equipment: value.equipment } : {}),
});

/** Les précisions choisies, dans l'ordre où l'écran les résume sur le repli fermé. */
export const plannerPrecisions = (value: PlannerRequestValue, spaceEquipment: readonly PlannerEquipment[]) => ({
  startTime: value.startTime || null,
  durationMin: value.durationMin,
  level: value.level,
  equipmentChanged: !sameSet(value.equipment, spaceEquipment),
});

/** La phase du jour n'est demandée que si l'espace suit des phases et qu'un destinataire est choisi. */
export const plannerAsksPhases = (value: PlannerRequestValue, phasesEnabled: boolean | undefined) =>
  Boolean(phasesEnabled) && value.groupIds.length + value.athleteIds.length > 0 && Boolean(value.date);

/**
 * La demande telle qu'elle part : ni mode ni brief, le serveur comprend seul. `reviewed` reste envoyé parce que le
 * contrat l'exige encore, comme le fait le web ; aucune case ne le demande au coach.
 */
export function plannerCreateInput(
  value: PlannerRequestValue,
  options: {
    id: string;
    requestedAt: string;
    spaceEquipment: readonly PlannerEquipment[];
    // Les choix de phase du jour, ou null quand la phase n'est pas demandée.
    phaseChoices: { athleteId: string; groupId: string }[] | null;
  },
) {
  const hints = plannerHints(value, options.spaceEquipment);
  return createPlannerProposalInput.safeParse({
    id: options.id,
    requestedAt: options.requestedAt,
    selection: {
      period: { from: value.date, to: value.date },
      groupIds: value.groupIds,
      athleteIds: value.athleteIds,
      exerciseIds: [],
      phaseChoices: [],
      phaseChoicesByDate: options.phaseChoices ? [{ date: value.date, choices: options.phaseChoices }] : [],
    } satisfies PlannerSelection,
    text: value.text.trim(),
    reviewed: true,
    accepts: PLANNER_NATIVE_ACCEPTS,
    ...(value.startTime ? { startTime: value.startTime } : {}),
    ...(Object.keys(hints).length ? { hints } : {}),
  });
}

/**
 * Une réponse à une question, ou un ajustement. « Ajuster » part de la séance à l'écran (`sessions`) : les
 * retouches faites à la main sont gardées. Une réponse à une question n'a pas encore de séance.
 */
export function plannerClarifyInput(options: {
  operationId: string;
  expectedVersion: number;
  text: string;
  sessions?: PlannerReviewedDraft[] | null;
}) {
  return clarifyPlannerProposalInput.safeParse({
    operationId: options.operationId,
    expectedVersion: options.expectedVersion,
    text: options.text,
    reviewed: true,
    ...(options.sessions?.length ? { sessions: options.sessions } : {}),
  });
}

/** La séance de l'écran, quand elle peut partir telle quelle : la base d'un ajustement ou d'un retrait. */
export const plannerScreenSessions = (drafts: PlannerReviewedDraft[] | null | undefined) =>
  drafts && plannerReviewedDraft.array().min(1).safeParse(drafts).success ? drafts : undefined;

// ─── La séance ─────────────────────────────────────────────────────────────────────────────────────────────────

/** L'app relit la séance dans l'éditeur de séquence du constructeur : chaque bloc reçoit sa séquence. */
export const plannerAsSequence = <S extends PlannerReviewedDraft>(session: S): S => ({
  ...session,
  draft: withSessionSequences(session.draft),
});

/** Un pourcentage du maximum à convertir pour chaque athlète : seul cas où l'aperçu des charges est exigé. */
export const plannerHasPercent = (session: PlannerReviewedDraft) =>
  session.draft.blocks.some((block) =>
    block.items.some((item) =>
      [item.prescription, item.autonomous?.prescription].some(
        (p) => p?.load?.type === "pct_1rm" || p?.setPlan?.some((set) => set.load?.type === "pct_1rm"),
      ),
    ),
  );

/** Une fiche prend la place d'un exercice de l'écran : sa prescription reste, ses charges adaptées par athlète partent. */
export const plannerWithExercise = (
  sessions: PlannerReviewedDraft[],
  ref: string,
  exerciseId: string,
): PlannerReviewedDraft[] =>
  sessions.map((session) =>
    session.draft.blocks.some((block) => block.items.some((item) => item.ref === ref))
      ? {
          ...session,
          overrides: session.overrides.filter(
            (o) => sessionExerciseReferences(session.draft).get(o.itemRef)?.ref !== ref,
          ),
          draft: {
            ...session.draft,
            blocks: session.draft.blocks.map((block) => ({
              ...block,
              items: block.items.map((item) =>
                item.ref === ref && item.exerciseId !== exerciseId
                  ? { ...item, exerciseId, prescription: replacedExercisePrescription(item.prescription, exerciseId) }
                  : item,
              ),
            })),
          },
        }
      : session,
  );

export type PlannerDraftWarning = NonNullable<PlannerDraftsResponse["warnings"]>[number][number];
export type PlannerDraftSlot = NonNullable<PlannerDraftsResponse["slots"]>[number];
type DraftItem = PlannerReviewedDraft["draft"]["blocks"][number]["items"][number];

/**
 * L'état d'un exercice de la séance, dit à sa place. Reconnu : rien de plus. Rapproché : « À vérifier », avec les
 * autres fiches possibles. À compléter : un emplacement, avec le terme dit, qui attend sa fiche.
 */
export type PlannerItemState =
  | { kind: "recognized" }
  | { kind: "probable"; warning: PlannerDraftWarning }
  | { kind: "slot"; slot: PlannerDraftSlot };

export function plannerItemState(
  item: Pick<DraftItem, "ref" | "exerciseId">,
  slots: readonly PlannerDraftSlot[],
  warnings: readonly PlannerDraftWarning[],
): PlannerItemState {
  const slot = item.exerciseId === PLANNER_SLOT_EXERCISE_ID ? slots.find((s) => s.itemRef === item.ref) : undefined;
  if (slot) return { kind: "slot", slot };
  const warning = warnings.find((w) => w.itemRef === item.ref && w.code === "approximate_exercise");
  return warning ? { kind: "probable", warning } : { kind: "recognized" };
}

/** Ce que l'action du bas fait : mener au premier exercice sans fiche, attendre, ou créer les brouillons. */
export type PlannerNextAction =
  | { kind: "complete"; count: number; said: string; slotId: string }
  | { kind: "create"; count: number; ready: boolean; reason: "invalid" | "loads" | "phases" | null };

export function plannerNextAction(options: {
  drafts: PlannerReviewedDraft[] | null;
  slots: readonly PlannerDraftSlot[];
  valid: boolean;
  phasesReady: boolean;
  loads: Record<number, { key: string; ready: boolean } | undefined>;
}): PlannerNextAction {
  const first = options.slots[0];
  if (first) return { kind: "complete", count: options.slots.length, said: first.said, slotId: first.id };
  const drafts = options.drafts ?? [];
  const loadsReady = drafts.every(
    (draft, index) =>
      !plannerHasPercent(draft) ||
      Boolean(options.loads[index]?.ready && options.loads[index]?.key === JSON.stringify(draft)),
  );
  const reason = !options.drafts
    ? null
    : !options.valid
      ? "invalid"
      : !loadsReady
        ? "loads"
        : !options.phasesReady
          ? "phases"
          : null;
  return { kind: "create", count: drafts.length, ready: Boolean(options.drafts) && reason === null, reason };
}

// ─── Chercher et créer une fiche ───────────────────────────────────────────────────────────────────────────────

type Searchable = { id: string; name: string; aliases?: readonly string[] };

/**
 * Chercher dans toute la bibliothèque de l'espace, par le nom et les autres noms, sans accent ni majuscule. Les
 * fiches dont le nom est exactement la recherche viennent d'abord, puis celles qui commencent par elle.
 */
export function plannerSearchLibrary<T extends Searchable>(exercises: readonly T[], query: string, limit = 40): T[] {
  const term = normalizeExerciseTerm(query);
  if (!term) return [];
  const rank = (exercise: T) => {
    const labels = [exercise.name, ...(exercise.aliases ?? [])].map(normalizeExerciseTerm);
    if (labels.some((label) => label === term)) return 0;
    if (labels.some((label) => label.startsWith(term))) return 1;
    return labels.some((label) => label.includes(term)) ? 2 : null;
  };
  return exercises
    .map((exercise) => ({ exercise, rank: rank(exercise) }))
    .filter((entry): entry is { exercise: T; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.exercise.name.localeCompare(b.exercise.name, "fr"))
    .slice(0, limit)
    .map(({ exercise }) => exercise);
}

/** Sans recherche saisie : les fiches proches du terme dit. */
export const plannerNearExercises = <T extends Searchable>(exercises: readonly T[], said: string, limit = 5): T[] => {
  const words = normalizeExerciseTerm(said)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
  if (!words.length) return [];
  // Une fiche proche partage au moins un mot avec le terme dit : sans mot commun, rien n'est proposé.
  const shares = (exercise: T) =>
    [exercise.name, ...(exercise.aliases ?? [])].some((label) =>
      normalizeExerciseTerm(label)
        .split(/[^\p{L}\p{N}]+/u)
        .some((word) => words.includes(word)),
    );
  return rankPlannerCandidates(exercises.filter(shares), said, limit);
};

export type PlannerLoadChoice = ExerciseLoadKind | "none";
type LibraryEntry = Searchable & { category: string; strengthLoadKind?: string | null };

/**
 * Ce que la création rapide préremplit pour un nom : la suggestion du serveur quand elle porte sur ce nom, sinon la
 * famille et la charge de la fiche la plus proche, ou ce que disent les mots du métier. Une fiche qui porte déjà ce
 * nom est rendue : elle sera proposée à la place.
 */
export function plannerQuickDefaults<T extends LibraryEntry>(
  name: string,
  library: readonly T[],
  suggestion?: Pick<PlannerSlotSuggestion, "name" | "category" | "loadKind"> | null,
): { category: ExerciseCategory; load: PlannerLoadChoice; basis: string | null; existing: T | null } {
  const existing = findExerciseByName(name, library);
  if (suggestion && normalizeExerciseTerm(suggestion.name) === normalizeExerciseTerm(name))
    return { category: suggestion.category, load: suggestion.loadKind, basis: null, existing };
  const defaults = suggestExerciseDefaults(name, library);
  return {
    category: defaults.category,
    load: defaults.strengthLoadKind ?? "none",
    basis: defaults.basis.kind === "exercise" ? defaults.basis.name : null,
    existing,
  };
}

/** La création rapide telle qu'elle part : le nom choisi, le terme dit s'il diffère, la famille et la charge. */
export const plannerQuickInput = (options: {
  name: string;
  term?: string | null;
  category: ExerciseCategory;
  load: PlannerLoadChoice;
}): QuickExerciseInput => ({
  name: options.name.trim(),
  ...(options.term?.trim() && normalizeExerciseTerm(options.term) !== normalizeExerciseTerm(options.name)
    ? { searchTerm: options.term.trim() }
    : {}),
  category: options.category,
  strengthLoadKind: options.load === "none" ? null : options.load,
});
