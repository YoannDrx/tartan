import { expect, it } from "vitest";
import type { TrainingPhaseSummary } from "@tartan/contracts";
import { phasePeriodsOverlap, resolveTrainingPhase, trainingPhaseBand, trainingPhaseProgress } from "./training-phases";

const phase = (id: string, type: "group" | "athlete" = "group"): TrainingPhaseSummary => ({
  id,
  target: { type, id },
  targetName: id,
  name: "Charge",
  kind: "development",
  startDate: "2030-01-01",
  endDate: "2030-03-25",
  objective: "Force",
  description: "",
  shared: true,
  version: 1,
});
it("calcule les semaines calendaires inclusives, y compris un cycle de douze semaines", () => {
  const p = phase("g");
  expect(trainingPhaseProgress(p, "2030-01-15")).toEqual({ week: 3, weeks: 12 });
  expect(trainingPhaseProgress(p, "2030-03-25")).toEqual({ week: 12, weeks: 12 });
  expect(trainingPhaseProgress(p, "2030-03-26")).toBeNull();
  expect(trainingPhaseProgress({ startDate: "2030-03-01", endDate: "2030-03-01" }, "2030-03-01")).toEqual({
    week: 1,
    weeks: 1,
  });
});
it("ne fait pas chevaucher des phases consécutives et découpe les bandeaux dans la fenêtre", () => {
  const a = phase("g");
  expect(phasePeriodsOverlap(a, { startDate: "2030-03-25", endDate: "2030-03-26" })).toBe(true);
  expect(phasePeriodsOverlap(a, { startDate: "2030-03-26", endDate: "2030-04-01" })).toBe(false);
  expect(trainingPhaseBand(a, { startDate: "2030-03-24", endDate: "2030-03-27" })).toEqual({ offset: 0, width: 0.5 });
});
it("donne priorité à l'individuel et exige un choix entre plusieurs contextes de groupe", () => {
  const input = { date: "2030-02-01", athleteId: "a", groupIds: ["g1", "g2"] };
  const groups = [phase("g1"), phase("g2")];
  expect(resolveTrainingPhase(groups, input).kind).toBe("choose_group");
  expect(resolveTrainingPhase(groups, { ...input, selectedGroupId: "g2" })).toMatchObject({
    kind: "phase",
    phase: { id: "g2" },
  });
  expect(resolveTrainingPhase([...groups, phase("a", "athlete")], input)).toMatchObject({
    kind: "phase",
    phase: { id: "a" },
  });
  expect(resolveTrainingPhase(groups, { ...input, groupIds: [] })).toEqual({ kind: "none" });
});
