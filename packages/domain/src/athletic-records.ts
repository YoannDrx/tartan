import type { PerformanceInput } from "@tartan/contracts";

export const performanceRule = (input: Pick<PerformanceInput, "unit" | "measurementType" | "recordDirection">) => {
  const measurementType = input.measurementType ?? (input.unit === "s" ? "time" : "distance");
  return {
    measurementType,
    recordDirection: input.recordDirection ?? (measurementType === "time" ? "lower" : "higher"),
  } as const;
};
export type AthleticMark = {
  id: string;
  discipline: string;
  mark: number;
  unit: string;
  date: string;
  createdAt: string;
  measurementType?: string | null;
  recordDirection?: string | null;
  comparisonContext?: string;
};

// Les unités anciennes connues sont rapprochées exactement, jamais une mesure inconnue.
export function athleticRecordStates(rows: readonly AthleticMark[]) {
  const groups = new Map<string, { first: AthleticMark; best: AthleticMark; value: number }>();
  for (const row of [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )) {
    if (!Number.isFinite(row.mark) || row.mark <= 0 || !["s", "m", "cm"].includes(row.unit)) continue;
    const type = row.measurementType ?? (row.unit === "s" ? "time" : "distance");
    const direction = row.recordDirection ?? (type === "time" ? "lower" : "higher");
    if (!(
      (type === "time" && direction === "lower" && row.unit === "s") ||
      (type === "distance" && direction === "higher" && row.unit !== "s")
    ))
      continue;
    const key = JSON.stringify([row.discipline, type, direction, row.comparisonContext ?? ""]);
    // Entiers à la précision stockée : les conversions cm/m ne fabriquent pas une amélioration flottante.
    const value = Math.round(row.mark * 1000) * (row.unit === "m" ? 100 : 1);
    const prior = groups.get(key);
    if (!prior) groups.set(key, { first: row, best: row, value });
    else if (direction === "lower" ? value < prior.value : value > prior.value) {
      prior.best = row;
      prior.value = value;
    }
  }
  return new Map(
    [...groups.values()].map(({ first, best }) => [
      best.id,
      { isBaseline: best.id === first.id, isPb: best.id !== first.id },
    ]),
  );
}
