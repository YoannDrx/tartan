import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "./exercise-catalog";
import { normalizeExerciseTerm } from "./exercise-aliases";
import { exerciseGuide, exerciseInput } from "@tartan/contracts";

describe("édition stade avant diffusion", () => {
  it("ajoute soixante clés et noms distincts, avec une consigne, un alias et une relecture à faire", () => {
    const all = [...EXERCISE_CATALOG, ...STADIUM_EDITION];
    expect(STADIUM_EDITION).toHaveLength(60);
    expect(new Set(all.map((e) => e.catalogKey)).size).toBe(233);
    expect(new Set(all.map((e) => normalizeExerciseTerm(e.name))).size).toBe(233);
    for (const e of STADIUM_EDITION) {
      expect(e.catalogVersion).toBe(6);
      expect(e.guide.technicalReview).toBe("pending");
      expect((e.aliases?.length ?? 0)).toBeGreaterThan(0);
      expect(exerciseGuide.parse(e.guide).steps.length).toBeGreaterThanOrEqual(2);
      expect(exerciseInput.safeParse({ ...e, defaultPrescription: e.prescription }).success, e.name).toBe(true);
    }
  });
});
