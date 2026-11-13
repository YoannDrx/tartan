import { expect, it } from "vitest";
import { cleanExerciseAliases, ambiguousExerciseTerms, unresolvedExerciseAlias } from "./exercise-aliases";

it("nettoie seulement la typographie, sans fabriquer de synonymes", () => {
  expect(cleanExerciseAliases("Épaulé", [" EPauLe ", " Clean ", "clean", "Power   clean", ""])).toEqual([
    "Clean",
    "Power clean",
  ]);
  expect(cleanExerciseAliases("Squat arrière", ["Squat avant", "back squat"])).toEqual(["Squat avant", "back squat"]);
});

it("demande une précision sur un alias partagé et accepte le nom de variante explicite", () => {
  const exercises = [
    { token: "exercise_1", name: "Squat arrière", aliases: ["Squat", "Back squat"] },
    { token: "exercise_2", name: "Squat avant", aliases: ["squat", "Front squat"] },
  ];
  expect(unresolvedExerciseAlias("Trois séries de SQUAT à 40 kg.", "exercise_1", exercises)).toEqual({
    term: "squat",
    exerciseTokens: ["exercise_1", "exercise_2"],
  });
  expect(unresolvedExerciseAlias("Front squat : 3 × 4 à 40 kg.", "exercise_2", exercises)).toBeNull();
  expect(unresolvedExerciseAlias("Squat : 3 × 4.\nJe précise : squat arrière.", "exercise_1", exercises)).toBeNull();
  expect(unresolvedExerciseAlias("Squat : 3 × 4.\nJe précise : squat arrière.", "exercise_2", exercises)).toMatchObject(
    { term: "squat" },
  );
  expect(unresolvedExerciseAlias("Squatteur", "exercise_1", exercises)).toBeNull();
});

it("conserve toutes les cibles d'un terme ambigu, y compris alias contre nom", () => {
  expect(
    ambiguousExerciseTerms([
      { token: "exercise_1", name: "Épaulé", aliases: ["Clean", "Power clean"] },
      { token: "exercise_2", name: "Power clean", aliases: ["CLEAN", "EPauLe"] },
      { token: "exercise_3", name: "Squat arrière", aliases: ["Back squat", "back squat"] },
    ]),
  ).toEqual([
    { term: "Épaulé", exerciseTokens: ["exercise_1", "exercise_2"] },
    { term: "Clean", exerciseTokens: ["exercise_1", "exercise_2"] },
    { term: "Power clean", exerciseTokens: ["exercise_1", "exercise_2"] },
  ]);
});

it("une résolution explicite lève uniquement le terme choisi et refuse une réponse qui le contredit", () => {
  const exercises = [
    { token: "exercise_1", name: "Squat arrière", aliases: ["squat"] },
    { token: "exercise_2", name: "Squat avant", aliases: ["squat"] },
  ];
  const choices = [{ term: "squat", token: "exercise_2" }];
  expect(unresolvedExerciseAlias("Squat 3 × 5", "exercise_2", exercises, choices)).toBeNull();
  expect(unresolvedExerciseAlias("Squat 3 × 5", "exercise_1", exercises, choices)).toMatchObject({
    term: "squat",
    exerciseTokens: ["exercise_2"],
  });
  expect(unresolvedExerciseAlias("Squat arrière 3 × 5", "exercise_1", exercises, choices)).toBeNull();
  expect(unresolvedExerciseAlias("Squat 3 × 5", "exercise_2", exercises)).not.toBeNull();
});
