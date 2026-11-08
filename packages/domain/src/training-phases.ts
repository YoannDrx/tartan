import type { SessionPhaseReview, TrainingPhaseSummary } from "@tartan/contracts";

type Period = { startDate: string; endDate: string };
export const phasePlanningKey = (date: string, groupIds: readonly string[], athleteIds: readonly string[]) =>
  JSON.stringify({ date, groupIds: [...new Set(groupIds)].sort(), athleteIds: [...new Set(athleteIds)].sort() });
export type PhasePlanningReadiness = { key: string; ready: boolean; review?: SessionPhaseReview };
export const phasePeriodsOverlap = (a: Period, b: Period) => a.startDate <= b.endDate && b.startDate <= a.endDate;
const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
export function trainingPhaseProgress(phase: Period, date: string) {
  const start = day(phase.startDate),
    end = day(phase.endDate),
    current = day(date);
  if (![start, end, current].every(Number.isFinite) || start > end || current < start || current > end) return null;
  return { week: Math.floor((current - start) / 7) + 1, weeks: Math.ceil((end - start + 1) / 7) };
}
export function trainingPhaseBand(phase: Period, viewport: Period) {
  if (!phasePeriodsOverlap(phase, viewport)) return null;
  const start = day(viewport.startDate),
    end = day(viewport.endDate),
    size = end - start + 1;
  if (!Number.isFinite(size) || size <= 0) return null;
  return {
    offset: (Math.max(day(phase.startDate), start) - start) / size,
    width: (Math.min(day(phase.endDate), end) - Math.max(day(phase.startDate), start) + 1) / size,
  };
}

// Le service filtre les phases privées AVANT cette résolution pour une vue athlète.
// Une phase privée ne doit jamais masquer une phase publique et révéler ainsi son existence.
export function resolveTrainingPhase(
  phases: readonly TrainingPhaseSummary[],
  input: {
    date: string;
    athleteId: string;
    groupIds: readonly string[];
    selectedGroupId?: string;
  },
):
  | { kind: "none" }
  | { kind: "phase"; phase: TrainingPhaseSummary }
  | { kind: "choose_group"; phases: TrainingPhaseSummary[] } {
  const current = phases.filter((p) => p.startDate <= input.date && p.endDate >= input.date);
  const personal = current.find((p) => p.target.type === "athlete" && p.target.id === input.athleteId);
  if (personal) return { kind: "phase", phase: personal };
  const groups = current.filter(
    (p) =>
      p.target.type === "group" &&
      input.groupIds.includes(p.target.id) &&
      (!input.selectedGroupId || p.target.id === input.selectedGroupId),
  );
  return groups.length === 0
    ? { kind: "none" }
    : groups.length === 1
      ? { kind: "phase", phase: groups[0]! }
      : { kind: "choose_group", phases: groups };
}
