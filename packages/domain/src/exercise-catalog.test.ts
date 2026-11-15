import { describe, expect, it } from "vitest";
import { exerciseGuide, exerciseInput } from "@tartan/contracts";
import { EXERCISE_CATALOG } from "./exercise-catalog";
import { VARIANTS_CATALOG } from "./exercise-catalog/variants";
import { STARTER_LIBRARY } from "./starter-library";
import { normalizeExerciseTerm } from "./exercise-aliases";

describe("catalogue éditorial", () => {
  it("répartit 173 mouvements distincts dans les neuf familles, dont 23 variantes de la version 5", () => {
    expect(EXERCISE_CATALOG).toHaveLength(173);
    expect(new Set(EXERCISE_CATALOG.map((e) => e.catalogKey)).size).toBe(173);
    expect(new Set(EXERCISE_CATALOG.map((e) => normalizeExerciseTerm(e.name))).size).toBe(173);
    const counts: Record<string, number> = {};
    for (const e of EXERCISE_CATALOG) counts[e.guide.family] = (counts[e.guide.family] ?? 0) + 1;
    expect(counts).toEqual({
      strength: 47,
      weightlifting: 20,
      mobility: 20,
      plyometrics: 23,
      running: 21,
      core: 12,
      coordination: 10,
      stairs: 10,
      warmup: 10,
    });
  });
  it("reprend les 55 références sans changer les charges ni prescriptions initiales", () => {
    for (const old of STARTER_LIBRARY) {
      const current = EXERCISE_CATALOG.find((e) => e.name === old.name)!;
      expect(current).toBeDefined();
      expect(current.prescription).toEqual(old.prescription);
      expect(current.strengthLoadKind).toBe(old.strengthLoadKind);
      expect(current.category).toBe(old.category);
    }
  });
  it("publie les textes approuvés sans prétendre à une validation des illustrations", () => {
    const pending = new Set(VARIANTS_CATALOG.map((entry) => entry.key));
    for (const entry of EXERCISE_CATALOG) {
      expect(exerciseGuide.safeParse(entry.guide).success, entry.name).toBe(true);
      expect(exerciseInput.safeParse({ ...entry, defaultPrescription: entry.prescription }).success, entry.name).toBe(
        true,
      );
      // Les variantes de la version 5 attendent la relecture du fondateur.
      expect(entry.guide.technicalReview).toBe(pending.has(entry.catalogKey) ? "pending" : "approved");
      expect(entry.guide.illustration.status).toBe("draft");
      expect(entry.guide.counting.explanation).toBeTruthy();
      expect(entry.guide.loadExplanation).toBeTruthy();
    }
  });
});
