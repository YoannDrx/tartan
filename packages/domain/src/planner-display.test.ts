import { describe, expect, it } from "vitest";
import { plannerDisplayText, replacedExercisePrescription } from "./planner-display";
const context = {
  targets: [
    { token: "group_1", label: "Vitesse (A)" },
    { token: "group_10", label: "Espoirs" },
    { token: "athlete_1", label: "Léa Martin" },
  ],
  exercises: [{ token: "exercise_1", name: "Squat arrière" }],
};
it("présente les destinataires et les exercices connus sans toucher au reste de la consigne", () => {
  expect(plannerDisplayText("Pour group_10 et group_1, athlete_1 : exercise_1 à 42,5 kg ?", context)).toBe(
    "Pour Espoirs et Vitesse (A), Léa Martin : Squat arrière à 42,5 kg ?",
  );
});
it("ne résout ni une sous-chaîne ni un jeton absent du contexte autorisé", () => {
  const text = "group_100 prégroup_1 group_1_suffix athlete_2";
  expect(plannerDisplayText(text, context)).toBe(text);
  expect(plannerDisplayText("group_1", null)).toBe("group_1");
});
it("préserve les libellés entiers et ne réinterprète ni dollar ni jeton inclus", () => {
  const label = "A".repeat(300) + " $& athlete_1";
  expect(plannerDisplayText("group_1", { ...context, targets: [{ token: "group_1", label }] })).toBe(label);
});

describe("remplacement d'un exercice proposé", () => {
  it("garde la prescription et rattache le pourcentage au nouvel exercice", () => {
    const kept = replacedExercisePrescription({ sets: 4, reps: 5, restS: 120, load: { type: "kg", value: 60 } }, "b");
    expect(kept).toEqual({ sets: 4, reps: 5, restS: 120, load: { type: "kg", value: 60 } });
    expect(
      replacedExercisePrescription({ sets: 3, load: { type: "pct_1rm", value: 80, test: "exercise:a" } }, "b"),
    ).toEqual({ sets: 3, load: { type: "pct_1rm", value: 80, test: "exercise:b" } });
  });
});
