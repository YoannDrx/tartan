import { strengthTestKind } from "@tartan/contracts";
import { estimatedOneRm } from "./charges";
import type {
  IntensityAnalysis,
  IntensityMetric,
  IntensitySummary,
  SnapshotItem,
  DetailedSetInput,
} from "@tartan/contracts";
import type { AnalysisEntry } from "./training-analysis";
import { blocksForVariant } from "./variants";

export const intensityMetrics = ["kg", "pct_reference", "target_rpe", "target_rir"] as const;
export const emptyIntensitySummary = (): IntensitySummary => ({
  count: 0,
  eligible: 0,
  mean: null,
  min: null,
  max: null,
});
function add(summary: IntensitySummary, value: number | null) {
  summary.eligible++;
  if (value === null || !Number.isFinite(value) || value < 0) return;
  const total = (summary.mean ?? 0) * summary.count + value;
  summary.count++;
  summary.mean = total / summary.count;
  summary.min = Math.min(summary.min ?? value, value);
  summary.max = Math.max(summary.max ?? value, value);
}
function compatibleLoad(item: SnapshotItem, set: DetailedSetInput): number | null {
  const compatible =
    item.strengthLoadKind === "assistance"
      ? set.loadKind === "assisted"
      : ["external_total", "added_weight"].includes(item.strengthLoadKind ?? "") && set.loadKind === "external";
  return compatible ? (set.loadKg ?? null) : null;
}
function frozenReference(item: SnapshotItem): number | null {
  const r = item.strengthReference;
  if (
    !r ||
    !Number.isFinite(r.value) ||
    r.value <= 0 ||
    r.loadKind !== item.strengthLoadKind ||
    !["external_total", "added_weight"].includes(item.strengthLoadKind ?? "")
  )
    return null;
  const matches =
    r.exerciseKey === `exercise:${item.exerciseId}` ||
    (item.prescription.load?.type === "pct_1rm" && item.prescription.load.test === r.exerciseKey);
  const kind = strengthTestKind.safeParse(r.kind);
  return matches && kind.success ? estimatedOneRm({ value: r.value, kind: kind.data }) : null;
}
/** Descriptive observations only. No RPE/RIR conversion, current max lookup or cross-exercise mean. */
export function analyzeTrainingIntensity(entries: readonly AnalysisEntry[]): IntensityAnalysis {
  const rows = new Map<string, IntensityAnalysis["rows"][number]>();
  let unlinkedItems = 0,
    unmatchedWorkSets = 0;
  for (const entry of entries) {
    const work = ["done", "partial"].includes(entry.status ?? "")
      ? entry.sets.filter((s) => s.done && s.setKind === "work")
      : [];
    const items =
      entry.frozen && entry.snapshot
        ? blocksForVariant(entry.snapshot.blocks, entry.variant).flatMap((b) => b.items)
        : [];
    const refs = new Set(items.filter((item) => item.exerciseId).map((item) => item.ref));
    unmatchedWorkSets += work.filter((s) => !refs.has(s.itemRef)).length;
    for (const item of items) {
      if (!item.exerciseId) {
        unlinkedItems++;
        continue;
      }
      const loadKind = item.strengthLoadKind ?? null;
      const sets = work.filter((s) => s.itemRef === item.ref);
      const reference = frozenReference(item);
      const p = item.prescription;
      const knownLoad = ["external_total", "added_weight", "assistance"].includes(loadKind ?? "");
      const planned: Record<IntensityMetric, number | null> = {
        kg: knownLoad ? (item.resolvedLoadKg ?? (p.load?.type === "kg" ? p.load.value : null)) : null,
        pct_reference:
          p.load?.type === "pct_1rm" && ["external_total", "added_weight"].includes(loadKind ?? "")
            ? p.load.value
            : null,
        target_rpe: p.intensityTarget?.type === "rpe" ? p.intensityTarget.value : null,
        target_rir: p.intensityTarget?.type === "rir" ? p.intensityTarget.value : null,
      };
      for (const metric of intensityMetrics) {
        const key = JSON.stringify([item.exerciseId, loadKind, metric]);
        const row = rows.get(key) ?? {
          key,
          exerciseId: item.exerciseId,
          name: item.name,
          metric,
          loadKind,
          planned: emptyIntensitySummary(),
          actual: metric === "kg" || metric === "pct_reference" ? emptyIntensitySummary() : null,
        };
        add(row.planned, planned[metric]);
        if (row.actual)
          for (const set of sets) {
            const kg = compatibleLoad(item, set);
            add(row.actual, metric === "kg" ? kg : kg !== null && reference !== null ? (kg / reference) * 100 : null);
          }
        rows.set(key, row);
      }
    }
  }
  return {
    rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "fr") || a.key.localeCompare(b.key)),
    unlinkedItems,
    unmatchedWorkSets,
  };
}

export function intensityComparisonRows(
  data: { current: IntensityAnalysis; previous: IntensityAnalysis },
  metric: IntensityMetric,
) {
  const prior = new Map(data.previous.rows.filter((r) => r.metric === metric).map((r) => [r.key, r]));
  const current = new Map(data.current.rows.filter((r) => r.metric === metric).map((r) => [r.key, r]));
  return [...new Set([...current.keys(), ...prior.keys()])]
    .map((key) => {
      const now = current.get(key),
        before = prior.get(key);
      return { row: now ?? before!, current: now, previous: before };
    })
    .filter(
      ({ current, previous }) =>
        current?.planned.count || current?.actual?.count || previous?.planned.count || previous?.actual?.count,
    );
}
