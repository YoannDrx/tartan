import { expect, it } from "vitest";
import { strengthCalculator } from "./strength-calculator";

it("conserve les décimales françaises, les bornes d’Epley et la référence distincte", () => {
  const result = strengthCalculator({ load: " 60,5 ", reps: "3", reference: "87" }, 2.5);
  expect(result.estimate).toBeCloseTo(66.55);
  expect(result.reference).toBe(87);
  expect(result.rows[0]).toEqual({ percent: 40, exactKg: 34.8, roundedKg: 35 });
  expect(strengthCalculator({ load: "100", reps: "1", reference: "" })).toMatchObject({
    estimate: 100,
    measured: true,
    rows: [],
  });
  expect(strengthCalculator({ load: "60", reps: "11", reference: "80" })).toMatchObject({
    estimate: null,
    errors: { reps: true },
    reference: 80,
  });
});

it("ne tronque pas une saisie invalide et ne remplace pas le vide par zéro", () => {
  for (const text of ["1e2", "60kg", "1,2,3", "60.125", "-20", "0", "1001", "Infinity"]) {
    const result = strengthCalculator({ load: text, reps: "4", reference: text });
    expect(result).toMatchObject({ estimate: null, rows: [], errors: { load: true, reference: true } });
  }
  for (const reps of ["3.5", "3,5", "3r", "0", "11"])
    expect(strengthCalculator({ load: "60", reps, reference: "" }).estimate).toBeNull();
  expect(strengthCalculator({ load: "", reps: "", reference: "" })).toMatchObject({
    estimate: null,
    rows: [],
    errors: { load: false, reps: false, reference: false },
  });
});
