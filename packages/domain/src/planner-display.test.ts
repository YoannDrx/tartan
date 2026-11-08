import { expect, it } from "vitest";
import { plannerDisplayText } from "./planner-display";
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
