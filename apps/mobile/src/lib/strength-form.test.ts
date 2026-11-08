import { expect, it } from "vitest";
import type { ExerciseSummary } from "@tartan/contracts";
import { buildStrengthTest, buildWorkingReference } from "./strength-form";

const id = "3f2c1d7e-0000-4000-8000-000000000000";
const exercise = { id, name: "Squat", strengthLoadKind: "external_total" } as ExerciseSummary;
it("relie le test à la fiche choisie et laisse la sélection de référence explicite", () => {
  const result = buildStrengthTest(id, exercise, {
    value: "102,5",
    kind: "three_rm",
    date: "2026-11-07",
    selectAsReference: false,
  });
  expect(result.success && result.data).toMatchObject({
    exerciseId: id,
    exerciseKey: `exercise:${id}`,
    value: 102.5,
    selectAsReference: false,
    kind: "three_rm",
  });
  expect(buildWorkingReference("92,50")).toMatchObject({ success: true, data: { source: "working", valueKg: 92.5 } });
});
it("refuse les valeurs tronquées, les charges hors bornes et une date impossible", () => {
  for (const value of ["", "100kg", "1e2", "0", "1001", "2.345"])
    expect(buildWorkingReference(value).success).toBe(false);
  expect(
    buildStrengthTest(id, exercise, { value: "100", kind: "one_rm", date: "2026-02-30", selectAsReference: true })
      .success,
  ).toBe(false);
});
