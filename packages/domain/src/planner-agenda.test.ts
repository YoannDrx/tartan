import { expect, it } from "vitest";
import { plannerTimesOverlap } from "./planner-agenda";
it("signale les créneaux qui se chevauchent, y compris un début à durée inconnue", () => {
  expect(plannerTimesOverlap("09:00", 50, "09:30", 20)).toBe(true);
  expect(plannerTimesOverlap("09:30", 20, "09:00", 50)).toBe(true);
  expect(plannerTimesOverlap("09:30", null, "09:00", 50)).toBe(true);
  expect(plannerTimesOverlap("09:00", null, "09:00")).toBe(true);
  expect(plannerTimesOverlap("09:00", 30, "09:30", 50)).toBe(false);
  expect(plannerTimesOverlap(null, 30, "09:30", 50)).toBe(false);
});
