import { expect, it } from "vitest";
import { plannerCorpus, corpusContext } from "../evals/planner-corpus";
import { scorePlannerCase } from "../evals/planner-score";
import { plannerProviderContext } from "@/server/ai/provider";

it("borne un corpus figé de soixante consignes, avec trente scripts audio non encore enregistrés", () => {
  expect(plannerCorpus).toHaveLength(60);
  expect(new Set(plannerCorpus.map((c) => c.id)).size).toBe(60);
  expect(new Set(plannerCorpus.map((c) => c.instructions.join("\n"))).size).toBe(60);
  expect(plannerCorpus.filter((c) => c.audioScript)).toHaveLength(30);
  expect(plannerCorpus.filter((c) => c.expected.status === "clarification")).toHaveLength(30);
  for (const test of plannerCorpus)
    expect(
      plannerProviderContext.safeParse({
        ...corpusContext,
        targets: test.targets ?? corpusContext.targets,
        instructions: test.instructions,
      }).success,
    ).toBe(true);
});
const testCase = plannerCorpus[0]!;
const valid = () => ({
  status: "proposal",
  questions: [],
  assumptions: [],
  suggestions: [],
  sessions: [
    {
      date: "2030-06-03",
      startTime: null,
      title: "Force",
      type: "strength",
      durationMin: 40,
      targetTokens: ["group_1"],
      blocks: [
        {
          name: "Force",
          items: [
            {
              exerciseToken: "exercise_1",
              instruction: "Squat arrière",
              prescription: {
                sets: 3,
                reps: 4,
                restS: 120,
                load: { type: "kg", value: 40 },
                intensityTarget: null,
                distanceM: null,
                durationS: null,
                contacts: null,
                tempo: null,
                notes: null,
              },
            },
          ],
        },
      ],
    },
  ],
});
it("ne confond pas JSON valide et prescription correcte", () => {
  expect(scorePlannerCase(testCase, valid())).toMatchObject({ passed: true, expectedExercises: 1, exerciseMatches: 1 });
  const wrong = valid();
  wrong.sessions[0]!.date = "2030-06-04";
  wrong.sessions[0]!.targetTokens = ["group_999"];
  wrong.sessions[0]!.blocks[0]!.items[0]!.prescription.load.value = 80;
  wrong.sessions[0]!.blocks[0]!.items[0]!.exerciseToken = "exercise_2";
  expect(scorePlannerCase(testCase, wrong)).toMatchObject({
    passed: false,
    minimumFieldCorrections: 4,
    exerciseMatches: 0,
  });
  expect(scorePlannerCase(testCase, { status: "proposal" })).toMatchObject({ passed: false, differences: ["schema"] });
});
it("une question ne vaut pas réussite sur une consigne non ambiguë, et aucune séance ne passe en clarification", () => {
  const clarification = {
    status: "clarification",
    sessions: [],
    assumptions: [],
    suggestions: [],
    questions: [{ id: "exercice", field: "exercise", question: "Quelle variante ?", options: [] }],
  };
  expect(scorePlannerCase(testCase, clarification).passed).toBe(false);
  const ambiguous = plannerCorpus.find((c) => c.id === "C01")!;
  expect(scorePlannerCase(ambiguous, clarification)).toMatchObject({ passed: true, askedClarification: true });
  expect(scorePlannerCase(ambiguous, valid()).passed).toBe(false);
  expect(scorePlannerCase(ambiguous, { ...clarification, sessions: valid().sessions }).passed).toBe(false);
});
