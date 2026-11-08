import { sessionLogResult, type DetailedSetInput, type StrengthRecordValue } from "@tartan/contracts";
import { estimateOneRm } from "./progression";

export type StrengthObservation = {
  exerciseId: string;
  exerciseName: string;
  convention: string | null;
  sessionId: string;
  logId: string;
  date: string;
  // Ordre stable des séances, indépendant de l'ordre des pages SQL et des corrections.
  order: string;
  set: DetailedSetInput;
};
type Candidate = Omit<StrengthRecordValue, "baseline">;
export function strengthCandidates(observation: StrengthObservation): Candidate[] {
  const { set, convention } = observation;
  if (
    !set.done ||
    set.setKind !== "work" ||
    set.loadKind !== "external" ||
    set.loadKg == null ||
    !Number.isFinite(set.loadKg) ||
    set.loadKg < 0 ||
    !set.reps ||
    (convention !== "external_total" && convention !== "added_weight")
  )
    return [];
  const base: Omit<Candidate, "kind" | "comparisonKey" | "value"> = {
    exerciseId: observation.exerciseId,
    exerciseName: observation.exerciseName,
    convention,
    sessionId: observation.sessionId,
    logId: observation.logId,
    date: observation.date,
    itemRef: set.itemRef,
    setIndex: set.setIndex,
    reps: set.reps,
    loadKg: set.loadKg,
    repetitionScope: set.repetitionScope,
    sideCount: set.sideCount,
  };
  const key = JSON.stringify([observation.exerciseId, convention, set.repetitionScope, set.sideCount]);
  const values: Candidate[] = [
    { ...base, kind: "load_at_reps", comparisonKey: `${key}/reps/${set.reps}`, value: set.loadKg },
    { ...base, kind: "reps_at_load", comparisonKey: `${key}/kg/${set.loadKg}`, value: set.reps },
  ];
  if (convention === "external_total" && set.reps >= 2 && set.reps <= 10) {
    const value = estimateOneRm(set.loadKg, set.reps);
    if (value !== null) values.push({ ...base, kind: "estimated_one_rm", comparisonKey: `${key}/epley`, value });
  }
  return values;
}

// Accumulation par pages : mémoire proportionnelle aux comparaisons, pas au nombre de séries.
// La première séance comparable établit une référence (meilleure série de cette séance).
export function createStrengthRecordAccumulator() {
  const entries = new Map<string, { best: Candidate; bestOrder: string; firstValue: number; firstOrder: string }>();
  return {
    add(observation: StrengthObservation) {
      for (const candidate of strengthCandidates(observation)) {
        const entry = entries.get(candidate.comparisonKey);
        if (!entry) {
          entries.set(candidate.comparisonKey, {
            best: candidate,
            bestOrder: observation.order,
            firstValue: candidate.value,
            firstOrder: observation.order,
          });
          continue;
        }
        if (observation.order < entry.firstOrder) {
          entry.firstOrder = observation.order;
          entry.firstValue = candidate.value;
        } else if (observation.order === entry.firstOrder) {
          entry.firstValue = Math.max(entry.firstValue, candidate.value);
        }
        if (
          candidate.value > entry.best.value + 1e-9 ||
          (Math.abs(candidate.value - entry.best.value) <= 1e-9 &&
            (observation.order < entry.bestOrder ||
              (observation.order === entry.bestOrder &&
                `${candidate.itemRef}/${candidate.setIndex}` < `${entry.best.itemRef}/${entry.best.setIndex}`)))
        ) {
          entry.best = candidate;
          entry.bestOrder = observation.order;
        }
      }
    },
    values(): StrengthRecordValue[] {
      return [...entries.values()]
        .map(({ best, firstValue }) => ({ ...best, baseline: best.value <= firstValue + 1e-9 }))
        .sort(
          (a, b) =>
            a.exerciseId.localeCompare(b.exerciseId) ||
            ["load_at_reps", "reps_at_load", "estimated_one_rm"].indexOf(a.kind) -
              ["load_at_reps", "reps_at_load", "estimated_one_rm"].indexOf(b.kind) ||
            a.convention.localeCompare(b.convention) ||
            a.repetitionScope.localeCompare(b.repetitionScope) ||
            a.sideCount - b.sideCount ||
            (a.kind === "reps_at_load" ? a.loadKg - b.loadKg : a.reps - b.reps) ||
            a.comparisonKey.localeCompare(b.comparisonKey),
        );
    },
  };
}

export function confirmedStrengthImprovements(
  before: readonly StrengthRecordValue[],
  after: readonly StrengthRecordValue[],
  input: { logId: string; version: number; clientId: string },
) {
  const previous = new Map(before.map((record) => [record.comparisonKey, record.value]));
  return after.flatMap((record) => {
    const value = previous.get(record.comparisonKey);
    if (record.baseline || record.logId !== input.logId || value === undefined || record.value <= value + 1e-9)
      return [];
    return [
      {
        ...record,
        baseline: false,
        eventId: JSON.stringify([input.logId, input.version, input.clientId, record.comparisonKey]),
        logVersion: input.version,
        previousValue: value,
      },
    ];
  });
}

// Le badge est réservé à la réponse directe et courante, jamais à un rejeu différé.
export function confirmedRecordsFromResponse(raw: unknown) {
  const result = sessionLogResult.safeParse(raw);
  if (!result.success || result.data.replayed) return [];
  return (result.data.records ?? []).filter(
    (record) => !record.baseline && record.logId === result.data.id && record.logVersion === result.data.version,
  );
}
