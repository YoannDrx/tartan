import { describe, expect, it } from "vitest";
import { exerciseFamilyOf, matchesExerciseSearch, moveInOrder, sortExercises } from "./exercise-library";

describe("bibliothèque d'exercices", () => {
  it("range l'haltérophilie dans sa famille, et une fiche sans guide selon sa catégorie", () => {
    expect(exerciseFamilyOf("weightlifting", "strength")).toBe("weightlifting");
    expect(exerciseFamilyOf(null, "cones")).toBe("coordination");
    expect(exerciseFamilyOf(undefined, "jump")).toBe("plyometrics");
  });

  it("trouve une fiche par un autre nom, sans accents", () => {
    expect(matchesExerciseSearch({ name: "Épaulé", aliases: ["Clean"] }, "clean")).toBe(true);
    expect(matchesExerciseSearch({ name: "Épaulé" }, "epaule")).toBe(true);
    expect(matchesExerciseSearch({ name: "Épaulé" }, "squat")).toBe(false);
    expect(matchesExerciseSearch({ name: "Épaulé" }, "  ")).toBe(true);
  });

  it("met devant les noms qui commencent par la recherche, ou suit l'ordre de la liste", () => {
    const rows = [
      { id: "1", name: "Squat avant" },
      { id: "2", name: "Goblet squat" },
      { id: "3", name: "Arraché" },
    ];
    expect(sortExercises(rows, "squat").map((r) => r.id)).toEqual(["1", "3", "2"]);
    expect(sortExercises(rows, "").map((r) => r.id)).toEqual(["3", "2", "1"]);
    expect(sortExercises(rows, "", ["2", "1", "3"]).map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("déplace un élément d'un rang, sans sortir de la liste", () => {
    expect(moveInOrder(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
