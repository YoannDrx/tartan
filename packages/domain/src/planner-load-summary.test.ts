import { expect, it } from "vitest";
import type { PlannerLoadsPreview } from "@tartan/contracts";
import { plannerLoadSummary } from "./planner-load-summary";
const athlete: PlannerLoadsPreview["athletes"][number] = {
  id: "athlete-a",
  name: "Fictif",
  items: [
    { ref: "body", exerciseId: "e1", name: "Gainage", prescription: {}, resolvedLoadKg: null, source: null },
    {
      ref: "pct",
      exerciseId: "e2",
      name: "Squat",
      prescription: { load: { type: "pct_1rm", value: 80, test: "e2" } },
      resolvedLoadKg: null,
      source: null,
    },
    {
      ref: "zero",
      exerciseId: "e3",
      name: "Tractions",
      prescription: { load: { type: "kg", value: 0 } },
      resolvedLoadKg: 0,
      source: null,
    },
  ],
};
it("ne confond pas une référence absente, le poids du corps et zéro kilogramme", () => {
  expect(plannerLoadSummary(athlete, [])).toEqual({ exercises: 3, unresolvedPercentages: 1, customized: 0 });
});
it("ne compte que les adaptations de charge de cet athlète et des items affichés", () => {
  expect(
    plannerLoadSummary(athlete, [
      { athleteId: athlete.id, itemRef: "zero", prescription: { load: { type: "kg", value: 0 } } },
      { athleteId: athlete.id, itemRef: "body", prescription: { reps: 5 } },
      { athleteId: "other", itemRef: "pct", prescription: { load: { type: "kg", value: 40 } } },
      { athleteId: athlete.id, itemRef: "absent", prescription: { load: { type: "kg", value: 40 } } },
    ]),
  ).toEqual({ exercises: 3, unresolvedPercentages: 1, customized: 1 });
});
it("retire le manque après résolution, sans sommer des charges hétérogènes", () => {
  const resolved = {
    ...athlete,
    items: athlete.items.map((item) => (item.ref === "pct" ? { ...item, resolvedLoadKg: 80 } : item)),
  };
  expect(plannerLoadSummary(resolved, [])).toEqual({ exercises: 3, unresolvedPercentages: 0, customized: 0 });
});
