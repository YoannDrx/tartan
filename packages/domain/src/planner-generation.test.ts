import { expect, it } from "vitest";
import { plannerGeneration } from "@tartan/contracts";
import { plannerGenerationToInterpretation } from "./planner-generation";
import { plannerSessionToDraft, validatePlannerInterpretation } from "./ai-planner";
import { sequenceOccurrences, validSessionStructure } from "./session-sequence";

const exercise = (token: string, sets = 1) => ({
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
