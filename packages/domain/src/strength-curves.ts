import type { ExerciseHistory } from "@tartan/contracts";
import { estimateOneRm } from "./progression";
import type { HistoryPoint } from "./history-chart";

export type StrengthCurveSource = "test_one_rm" | "test_three_rm" | "work_load" | "work_epley" | "test_estimated";
export type StrengthCurve = {
  key: string;
  source: StrengthCurveSource;
  convention: "external_total" | "added_weight";
  repetitionScope: "total" | "per_side" | null;
  sideCount: 1 | 2 | null;
  reps: number | null;
  points: HistoryPoint[];
};
const sources: StrengthCurveSource[] = ["test_one_rm", "test_three_rm", "work_load", "work_epley", "test_estimated"];

// Les courbes restent séparées par provenance et convention. Une série à une répétition n'est
// pas un test de maximum ; un 3RM enregistré reste un 3RM, pas une estimation silencieuse de 1RM.
export function strengthHistoryCurves(
  history: Pick<ExerciseHistory, "sessions" | "tests" | "from" | "to">,
): StrengthCurve[] {
  const sessions = new Map<string, ExerciseHistory["sessions"][number]>();
  for (const session of history.sessions) {
    if (session.date < history.from || session.date > history.to) continue;
    const previous = sessions.get(session.logId);
    if (!previous || session.version > previous.version) sessions.set(session.logId, session);
  }
  const tests = new Map(
    history.tests.filter((test) => test.date >= history.from && test.date <= history.to).map((test) => [test.id, test]),
  );
  const sessionDays = new Map<string, number>();
  for (const session of sessions.values()) sessionDays.set(session.date, (sessionDays.get(session.date) ?? 0) + 1);
  const testDays = new Map<string, number>();
  for (const test of tests.values()) testDays.set(test.date, (testDays.get(test.date) ?? 0) + 1);
  const curves = new Map<string, { curve: Omit<StrengthCurve, "points">; days: Map<string, Map<string, number>> }>();
  const add = (metadata: Omit<StrengthCurve, "points" | "key">, date: string, observation: string, value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    const key = JSON.stringify([
      metadata.source,
      metadata.convention,
      metadata.repetitionScope,
      metadata.sideCount,
      metadata.reps,
    ]);
    const entry = curves.get(key) ?? { curve: { ...metadata, key }, days: new Map<string, Map<string, number>>() };
    const values = entry.days.get(date) ?? new Map<string, number>();
    values.set(observation, Math.max(values.get(observation) ?? -Infinity, value));
    entry.days.set(date, values);
    curves.set(key, entry);
  };
  for (const session of sessions.values()) {
    for (const item of session.items) {
      if (item.strengthLoadKind !== "external_total" && item.strengthLoadKind !== "added_weight") continue;
      for (const set of item.sets) {
        if (!set.done || set.setKind !== "work" || set.loadKind !== "external" || set.loadKg == null || !set.reps)
          continue;
        const metadata = {
          convention: item.strengthLoadKind,
          repetitionScope: set.repetitionScope,
          sideCount: set.sideCount,
        };
        add({ ...metadata, source: "work_load", reps: set.reps }, session.date, session.logId, set.loadKg);
        if (item.strengthLoadKind !== "external_total" || set.reps < 2 || set.reps > 10) continue;
        const estimate = estimateOneRm(set.loadKg, set.reps);
        if (estimate !== null)
          add({ ...metadata, source: "work_epley", reps: null }, session.date, session.logId, estimate);
      }
    }
  }
  for (const test of tests.values()) {
    if (test.loadKind !== "external_total" && test.loadKind !== "added_weight") continue;
    const source =
      test.kind === "one_rm"
        ? "test_one_rm"
        : test.kind === "three_rm"
          ? "test_three_rm"
          : test.kind === "estimated"
            ? "test_estimated"
            : null;
    if (!source) continue;
    add(
      { source, convention: test.loadKind, repetitionScope: null, sideCount: null, reps: null },
      test.date,
      test.id,
      test.value,
    );
  }
  return [...curves.values()]
    .map(({ curve, days }) => {
      const dates = curve.source.startsWith("test_") ? testDays : sessionDays;
      return {
        ...curve,
        points: [...dates]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, total]) => {
            const values = [...(days.get(date)?.values() ?? [])];
            return {
              date,
              value: values.length ? Math.max(...values) : null,
              knownSessions: values.length,
              sessions: total,
            };
          }),
      };
    })
    .sort(
      (a, b) =>
        sources.indexOf(a.source) - sources.indexOf(b.source) ||
        (a.reps ?? 0) - (b.reps ?? 0) ||
        a.key.localeCompare(b.key),
    );
}
