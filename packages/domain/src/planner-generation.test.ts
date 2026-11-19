import { expect, it } from "vitest";
import { plannerGeneration, plannerProposeGeneration } from "@tartan/contracts";
import {
  plannerGenerationToInterpretation,
  plannerLegacyInterpretation,
  plannerProposeGenerationToInterpretation,
  plannerSessionToGeneration,
} from "./planner-generation";
import { plannerSessionToDraft, validatePlannerInterpretation } from "./ai-planner";
import { sequenceOccurrences, validSessionStructure } from "./session-sequence";

const exercise = (token: string, sets = 1, autonomous: unknown = null) => ({
  autonomous,
  kind: "exercise",
  exerciseToken: token,
  instruction: "Circuit demandé",
  prescription: {
    sets,
    reps: 8,
    distanceM: null,
    durationS: null,
    restS: null,
    load: null,
    intensityTarget: null,
    tempo: null,
    contacts: null,
    notes: null,
    setPlan: null,
  },
});
const response = (content: unknown[]) => ({
  status: "proposal",
  questions: [],
  assumptions: [],
  suggestions: [],
  sessions: [
    {
      date: "2026-11-18",
      startTime: null,
      title: "Circuit",
      type: "strength",
      durationMin: null,
      targetTokens: ["group_1"],
      blocks: [{ name: "Force", content }],
    },
  ],
});
const exercises = new Map([
  ["exercise_1", { id: "00000000-0000-4000-8000-000000000001" }],
  ["exercise_2", { id: "00000000-0000-4000-8000-000000000002" }],
]);
it("convertit un arbre A/B en occurrences stables sans exercice fictif ni repos final", () => {
  const generation = plannerGeneration.parse(
    response([
      {
        kind: "repeat",
        name: "Superset",
        rounds: 2,
        restBetweenRoundsS: 60,
        children: [exercise("exercise_1"), exercise("exercise_2")],
      },
    ]),
  );
  const result = plannerGenerationToInterpretation(generation);
  expect(plannerGenerationToInterpretation(generation)).toEqual(result);
  expect(result.sessions[0]!.blocks[0]!.items).toHaveLength(2);
  const draft = plannerSessionToDraft(result.sessions[0]!, exercises, "test");
  expect(validSessionStructure(draft)).toBe(true);
  const steps = sequenceOccurrences(draft.blocks[0]!.sequence!);
  expect(steps.map((step) => step.node.kind)).toEqual(["exercise", "exercise", "recovery", "exercise", "exercise"]);
  expect(steps[0]!.node).toEqual(steps[3]!.node);
  expect(steps[0]!.rounds).not.toEqual(steps[3]!.rounds);
});
it("garde les séries simples compactes et la récupération explicite distincte", () => {
  const simple = plannerGenerationToInterpretation(plannerGeneration.parse(response([exercise("exercise_1", 3)])));
  expect(simple.sessions[0]!.blocks[0]).toMatchObject({ sequence: null, items: [{ prescription: { sets: 3 } }] });
  const recovered = plannerGenerationToInterpretation(
    plannerGeneration.parse(
      response([exercise("exercise_1", 3), { kind: "recovery", durationS: 90 }, exercise("exercise_2", 3)]),
    ),
  );
  expect(recovered.sessions[0]!.blocks[0]!.items).toHaveLength(2);
  const draft = plannerSessionToDraft(recovered.sessions[0]!, exercises, "test");
  expect(validSessionStructure(draft)).toBe(true);
  expect(sequenceOccurrences(draft.blocks[0]!.sequence!)[1]!.node).toMatchObject({ kind: "recovery", durationS: 90 });
});
it("borne la profondeur dans le contrat et le volume développé dans le domaine", () => {
  const group = (children: unknown[]) => ({
    kind: "repeat",
    name: "Tours",
    rounds: 25,
    restBetweenRoundsS: 0,
    children,
  });
  expect(plannerGeneration.safeParse(response([group([group([group([exercise("exercise_1")])])])])).success).toBe(
    false,
  );
  const result = plannerGenerationToInterpretation(
    plannerGeneration.parse(response([group([group([exercise("exercise_1", 25)])])])),
  );
  expect(
    validatePlannerInterpretation(result, {
      period: { from: "2026-11-16", to: "2026-11-22" },
      exercises,
      targetTokens: new Set(["group_1"]),
      reviewedInstructions: ["Circuit demandé"],
    }),
  ).toEqual({ ok: false, issues: ["shape"] });
});

it("conserve un bloc de récupération seul après le travail sans inventer de mouvement", () => {
  const input = response([exercise("exercise_1")]);
  input.sessions[0]!.blocks.push({ name: "Retour au calme", content: [{ kind: "recovery", durationS: 75 }] });
  const result = plannerGenerationToInterpretation(plannerGeneration.parse(input));
  const context = {
    period: { from: "2026-11-16", to: "2026-11-22" },
    exercises,
    targetTokens: new Set(["group_1"]),
    reviewedInstructions: ["Circuit demandé"],
  };
  expect(validatePlannerInterpretation(result, context).ok).toBe(true);
  const draft = plannerSessionToDraft(result.sessions[0]!, exercises, "recovery");
  expect(validSessionStructure(draft)).toBe(true);
  expect(draft.blocks[1]!.items).toEqual([]);
  expect(sequenceOccurrences(draft.blocks[1]!.sequence!).map((step) => step.node)).toEqual([
    { kind: "recovery", ref: "recovery-b1-n0", durationS: 75 },
  ]);
  const empty = structuredClone(result);
  empty.sessions[0]!.blocks[1]!.sequence = null;
  expect(validatePlannerInterpretation(empty, context)).toEqual({ ok: false, issues: ["shape"] });
});

const set = (reps: number, load: { type: "kg" | "pct_1rm"; value: number } | null, warmup = false) => ({
  reps,
  load,
  warmup,
});
it("convertit des séries détaillées en gardant séries, répétitions et charge de travail alignées", () => {
  const node = exercise("exercise_1", 1);
  node.prescription.setPlan = [
    set(8, { type: "kg", value: 40 }, true),
    set(5, { type: "kg", value: 60 }),
    set(3, { type: "kg", value: 70 }),
  ] as never;
  const result = plannerGenerationToInterpretation(plannerGeneration.parse(response([node])));
  const prescription = result.sessions[0]!.blocks[0]!.items[0]!.prescription;
  expect(prescription).toMatchObject({ sets: 3, reps: 5, load: { type: "kg", value: 60 } });
  const draft = plannerSessionToDraft(result.sessions[0]!, exercises, "plan");
  expect(draft.blocks[0]!.items[0]!.prescription).toMatchObject({
    sets: 3,
    reps: 5,
    load: { type: "kg", value: 60 },
    setPlan: [{ reps: 8, load: { type: "kg", value: 40 }, warmup: true }, { reps: 5 }, { reps: 3 }],
  });
  // Les applications installées lisent le même résumé, sans le détail.
  expect(plannerLegacyInterpretation(result).sessions[0]!.blocks[0]!.items[0]!.prescription).not.toHaveProperty(
    "setPlan",
  );
});
it("un pourcentage détaillé se rapporte au maximum de l'exercice ; des séries identiques ne sont pas un détail", () => {
  const percent = exercise("exercise_1", 1);
  percent.prescription.setPlan = [
    set(5, { type: "pct_1rm", value: 70 }),
    set(3, { type: "pct_1rm", value: 80 }),
  ] as never;
  const draft = plannerSessionToDraft(
    plannerGenerationToInterpretation(plannerGeneration.parse(response([percent]))).sessions[0]!,
    exercises,
    "pct",
  );
  expect(draft.blocks[0]!.items[0]!.prescription.setPlan![1]!.load).toEqual({
    type: "pct_1rm",
    value: 80,
    test: "exercise:00000000-0000-4000-8000-000000000001",
  });
  const uniform = exercise("exercise_1", 1);
  uniform.prescription.setPlan = [set(6, null), set(6, null), set(6, null)] as never;
  const flat = plannerGenerationToInterpretation(plannerGeneration.parse(response([uniform])));
  expect(flat.sessions[0]!.blocks[0]!.items[0]!.prescription).toMatchObject({ sets: 3, reps: 6, setPlan: null });
});
it("porte le remplacement en autonomie sur l'exercice et rend la séance commune", () => {
  const away = {
    exerciseToken: "exercise_2",
    instruction: "Circuit demandé",
    prescription: exercise("x", 3).prescription,
  };
  const result = plannerGenerationToInterpretation(
    plannerGeneration.parse(response([exercise("exercise_1", 3, away)])),
  );
  expect(result.sessions[0]!.blocks[0]!.items[0]!.autonomous).toMatchObject({ exerciseToken: "exercise_2" });
  const draft = plannerSessionToDraft(result.sessions[0]!, exercises, "away");
  expect(draft.blocks[0]).toMatchObject({
    variant: "both",
    items: [{ autonomous: { exerciseId: "00000000-0000-4000-8000-000000000002", prescription: { sets: 3 } } }],
  });
  expect(plannerLegacyInterpretation(result).sessions[0]!.blocks[0]!.items[0]).not.toHaveProperty("autonomous");
  expect(
    validatePlannerInterpretation(result, {
      period: { from: "2026-11-16", to: "2026-11-22" },
      exercises: new Map([["exercise_1", exercises.get("exercise_1")!]]),
      targetTokens: new Set(["group_1"]),
      reviewedInstructions: ["Circuit demandé"],
    }),
  ).toEqual({ ok: false, issues: ["exercise"] });
});
it("en mode « Proposer », la date, l'heure et les destinataires viennent de la demande", () => {
  const { date: _d, startTime: _s, targetTokens: _t, ...session } = response([exercise("exercise_1", 3)]).sessions[0]!;
  const generation = plannerProposeGeneration.parse({ ...response([]), sessions: [session] });
  const result = plannerProposeGenerationToInterpretation(generation, {
    date: "2026-11-20",
    startTime: "18:30",
    targetTokens: ["group_1", "athlete_1"],
  });
  expect(result.sessions[0]).toMatchObject({
    date: "2026-11-20",
    startTime: "18:30",
    targetTokens: ["group_1", "athlete_1"],
  });
  expect(
    plannerProposeGeneration.safeParse({ ...response([]), sessions: [{ ...session, date: "2026-11-21" }] }).success,
  ).toBe(false);
});
it("renvoie la séance précédente au modèle dans la forme qu'il écrit, pour l'ajuster", () => {
  const generation = plannerGeneration.parse(
    response([
      {
        kind: "repeat",
        name: "Superset",
        rounds: 2,
        restBetweenRoundsS: 60,
        children: [exercise("exercise_1"), exercise("exercise_2")],
      },
      { kind: "recovery", durationS: 90 },
    ]),
  );
  const back = plannerSessionToGeneration(plannerGenerationToInterpretation(generation).sessions[0]!);
  expect(back).toEqual(generation.sessions[0]);
});
it("deux lignes successives du même exercice deviennent un seul exercice aux séries détaillées", () => {
  const first = exercise("exercise_1", 3);
  first.prescription.load = { type: "pct_1rm", value: 70 } as never;
  first.prescription.reps = 5;
  const second = exercise("exercise_1", 1);
  second.prescription.load = { type: "pct_1rm", value: 80 } as never;
  second.prescription.reps = 3;
  const result = plannerGenerationToInterpretation(plannerGeneration.parse(response([first, second])));
  const items = result.sessions[0]!.blocks[0]!.items;
  expect(items).toHaveLength(1);
  expect(items[0]!.prescription).toMatchObject({
    sets: 4,
    reps: 5,
    setPlan: [
      { reps: 5, load: { type: "pct_1rm", value: 70 } },
      { reps: 5 },
      { reps: 5 },
      { reps: 3, load: { type: "pct_1rm", value: 80 } },
    ],
  });
  // Séparées par un autre geste, elles restent deux lignes.
  const apart = plannerGenerationToInterpretation(
    plannerGeneration.parse(response([first, exercise("exercise_2", 3), second])),
  );
  expect(apart.sessions[0]!.blocks[0]!.items).toHaveLength(3);
});
