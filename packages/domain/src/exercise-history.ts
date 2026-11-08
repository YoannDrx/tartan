import type { DetailedSetInput, ExerciseHistorySession } from "@tartan/contracts";
import { estimateOneRm } from "./progression";

export type StrengthRecord = {
  comparisonKey: string;
  kind: "load_at_reps" | "reps_at_load" | "estimated_one_rm";
  value: number;
  reps: number | null;
  loadKg: number | null;
  sessionId: string;
  logId: string;
  itemRef: string;
  setIndex: number;
  date: string;
  previousValue: number | null;
  baseline: boolean;
};

// Le même exercice ne rend pas deux conventions interchangeables.
export const setComparisonKey = (set: DetailedSetInput, convention: string | null | undefined): string =>
  JSON.stringify([set.loadKind, convention ?? null, set.repetitionScope, set.sideCount]);

const candidates = (session: ExerciseHistorySession): StrengthRecord[] =>
  session.items.flatMap((item) =>
    item.sets.flatMap((set) => {
      if (
        !set.done ||
        set.setKind !== "work" ||
        set.loadKind !== "external" ||
        set.loadKg == null ||
        set.reps == null ||
        set.reps < 1 ||
        (item.strengthLoadKind !== "external_total" && item.strengthLoadKind !== "added_weight")
      )
        return [];
      const base = {
        sessionId: session.sessionId,
        logId: session.logId,
        itemRef: item.itemRef,
        setIndex: set.setIndex,
        date: session.date,
        previousValue: null,
        baseline: true,
      };
      const key = setComparisonKey(set, item.strengthLoadKind);
      const records: StrengthRecord[] = [
        {
          ...base,
          comparisonKey: `${key}/reps/${set.reps}`,
          kind: "load_at_reps",
          value: set.loadKg,
          reps: set.reps,
          loadKg: set.loadKg,
        },
        {
          ...base,
          comparisonKey: `${key}/kg/${set.loadKg}`,
          kind: "reps_at_load",
          value: set.reps,
          reps: set.reps,
          loadKg: set.loadKg,
        },
      ];
      // Epley sur charge externe totale uniquement : pas de faux maximum à partir du seul lest ajouté.
      const estimated = item.strengthLoadKind === "external_total" ? estimateOneRm(set.loadKg, set.reps) : null;
      if (estimated !== null)
        records.push({
          ...base,
          comparisonKey: `${key}/one-rm`,
          kind: "estimated_one_rm",
          value: estimated,
          reps: set.reps,
          loadKg: set.loadKg,
        });
      return records;
    }),
  );

// Recalcul pur à partir des saisies courantes : correction et suppression retirent les anciens records.
// Le premier résultat de chaque comparaison est une référence initiale, pas un record battu.
// Au plus un événement par comparaison et par séance, même si plusieurs séries progressent.
export const strengthHistoryRecords = (sessions: readonly ExerciseHistorySession[]) => {
  const current = new Map<string, StrengthRecord>();
  const improvements: StrengthRecord[] = [];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.logId.localeCompare(b.logId));
  for (const session of ordered) {
    const sessionBest = new Map<string, StrengthRecord>();
    for (const record of candidates(session)) {
      const best = sessionBest.get(record.comparisonKey);
      if (!best || record.value > best.value) sessionBest.set(record.comparisonKey, record);
    }
    for (const record of sessionBest.values()) {
      const best = current.get(record.comparisonKey);
      if (best && record.value <= best.value + 1e-9) continue;
      const next = { ...record, baseline: !best, previousValue: best?.value ?? null };
      current.set(record.comparisonKey, next);
      if (best) improvements.push(next);
    }
  }
  return { current: [...current.values()], improvements };
};

export const lastComparableSets = (
  sessions: readonly ExerciseHistorySession[],
  set: DetailedSetInput,
  convention: string | null | undefined,
  excludeSessionId?: string,
) => {
  const key = setComparisonKey(set, convention);
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.logId.localeCompare(a.logId));
  for (const session of ordered) {
    if (session.sessionId === excludeSessionId) continue;
    const matching = session.items.flatMap((item) =>
      item.sets.filter(
        (previous) =>
          previous.done && previous.setKind === "work" && setComparisonKey(previous, item.strengthLoadKind) === key,
      ),
    );
    if (matching.length) return { sessionId: session.sessionId, date: session.date, sets: matching };
  }
  return null;
};
