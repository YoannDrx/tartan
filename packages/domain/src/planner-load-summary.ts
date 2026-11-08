import type { PlannerLoadsPreview, PlannerReviewedDraft } from "@tartan/contracts";

// Counts describe the current page's actual items; bodyweight or an omitted
// prescription is not a failed percentage conversion, and zero kg is resolved.
export function plannerLoadSummary(
  athlete: PlannerLoadsPreview["athletes"][number],
  overrides: PlannerReviewedDraft["overrides"],
) {
  const customized = new Set(
    overrides.filter((o) => o.athleteId === athlete.id && o.prescription.load).map((o) => o.itemRef),
  );
  return {
    exercises: athlete.items.length,
    unresolvedPercentages: athlete.items.filter(
      (item) => item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg === null,
    ).length,
    customized: athlete.items.filter((item) => customized.has(item.ref)).length,
  };
}
