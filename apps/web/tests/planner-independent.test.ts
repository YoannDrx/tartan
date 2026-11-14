import { expect, it } from "vitest";
import {
  independentCatalog,
  independentContext,
  independentCorpus,
  scoreIndependentCase,
} from "../evals/planner-independent";
import { plannerProviderContext } from "@/server/ai/provider";

it("charge les 80 cas figés et ne transmet aucun attendu au prestataire", () => {
  expect(independentCorpus.cases).toHaveLength(80);
  for (const test of independentCorpus.cases) {
    const context = plannerProviderContext.parse(independentContext(test));
    expect(context.instructions).toEqual([test.text]);
    expect(context).not.toHaveProperty("expected");
    expect(independentContext({ ...test, expected: { status: "clarification", field: "other" } })).toEqual(context);
  }
});
it("détecte les dates, charges et substitutions erronées au lieu de compter seulement un JSON valide", () => {
  const test = independentCorpus.cases[0]!;
  const exercise = independentCatalog.find((e) => e.catalogKey === "back-squat")!;
  const value = {
    status: "proposal",
    questions: [],
    assumptions: [],
    suggestions: [],
    sessions: [
      {
        date: "2026-11-16",
        startTime: null,
        title: "Force",
        type: "strength",
        durationMin: null,
        targetTokens: ["group_1"],
        blocks: [
          {
            name: "Force",
            items: [
              {
                exerciseToken: exercise.token,
                instruction: test.text,
                prescription: {
                  sets: 4,
                  reps: 5,
                  restS: 120,
                  distanceM: null,
                  durationS: null,
                  load: { type: "kg", value: 60 },
                  intensityTarget: null,
                  tempo: null,
                  contacts: null,
                  notes: null,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  expect(scoreIndependentCase(test, value).passed).toBe(true);
  const targetClarification = {
    ...test,
    text: "Mercredi pour un destinataire qui ne fait pas partie de la sélection.",
    expected: { status: "clarification" as const, field: "target" },
  };
  expect(scoreIndependentCase(targetClarification, value).critical).toContain("false_date");
  const correctlyDated = structuredClone(value);
  correctlyDated.sessions[0]!.date = "2026-11-18";
  expect(scoreIndependentCase(targetClarification, correctlyDated).critical).not.toContain("false_date");
  expect(scoreIndependentCase(targetClarification, correctlyDated).passed).toBe(false);
  expect(
    scoreIndependentCase({ ...targetClarification, text: "Lundi ou mercredi, pour ce destinataire." }, value).critical,
  ).not.toContain("false_date");
  const duplicated = structuredClone(value);
  duplicated.sessions[0]!.blocks[0]!.items.push(structuredClone(duplicated.sessions[0]!.blocks[0]!.items[0]!));
  expect(scoreIndependentCase(test, duplicated).differences).toContain("exercise");
  expect(scoreIndependentCase(test, duplicated).critical).not.toContain("silent_substitution");

  const wrong = structuredClone(value);
  wrong.sessions[0]!.date = "2026-11-17";
  wrong.sessions[0]!.blocks[0]!.items[0]!.prescription.load.value = 80;
  wrong.sessions[0]!.blocks[0]!.items[0]!.exerciseToken = independentCatalog.find(
    (e) => e.catalogKey === "front-plank",
  )!.token;
  expect(scoreIndependentCase(test, wrong).critical).toEqual(
    expect.arrayContaining(["false_date", "invented_load", "silent_substitution"]),
  );
});
it("un exercice inconnu doit conserver son nom pour ouvrir la création contrôlée", () => {
  const test = independentCorpus.cases.find((c) => c.id === "F5-21")!;
  const value = {
    status: "clarification",
    sessions: [],
    assumptions: [],
    suggestions: [],
    questions: [
      { id: "movement", field: "exercise", question: "Quel exercice ?", options: [], exerciseName: "Squat du dragon" },
    ],
  };
  expect(scoreIndependentCase(test, value).passed).toBe(true);
  expect(
    scoreIndependentCase(test, { ...value, questions: [{ ...value.questions[0], exerciseName: null }] }).differences,
  ).toContain("unknown_exercise_name");
});
it("la proposition reste soumise à une relecture humaine même après les contrôles automatiques", () => {
  const test = independentCorpus.cases.find((c) => c.mode === "propose")!;
  expect(scoreIndependentCase(test, {}).humanReviewRequired).toBe(true);
});
