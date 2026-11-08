import type {
  TrainingAnalysis,
  AnalysisTotals,
  DetailedSetInput,
  SessionSnapshot,
  SessionVariant,
  SnapshotItem,
} from "@tartan/contracts";
import { blocksForVariant } from "./variants";
import { actualSetVolumes } from "./progression";
import { sessionLoad } from "./training-load";

export const analysisVolumeKeys = ["tonnageKg", "distanceM", "durationS", "groundContacts"] as const;
export const emptyAnalysisTotals = (): AnalysisTotals => ({
  assignedSessions: 0,
  loggedSessions: 0,
  completedSessions: 0,
  detailedSessions: 0,
  frozenSessions: 0,
  plannedItems: 0,
  plannedSets: 0,
  plannedSetsKnownItems: 0,
  completedWorkSets: 0,
  planned: { tonnageKg: null, distanceM: null, durationS: null, groundContacts: null },
  actual: { tonnageKg: null, distanceM: null, durationS: null, groundContacts: null },
  plannedKnownItems: { tonnageKg: 0, distanceM: 0, durationS: 0, groundContacts: 0 },
  actualKnownSets: { tonnageKg: 0, distanceM: 0, durationS: 0, groundContacts: 0 },
  perceivedLoad: null,
  loadResponses: 0,
  healthEligibleSessions: 0,
});
export type AnalysisEntry = {
  snapshot: SessionSnapshot | null;
  frozen: boolean;
  variant: SessionVariant;
  status: string | null;
  sets: DetailedSetInput[];
  health: boolean;
  rpe: number | null;
  durationMin: number | null;
};
export function plannedItemVolumes(item: SnapshotItem) {
  const p = item.prescription;
  const load = item.resolvedLoadKg ?? (p.load?.type === "kg" ? p.load.value : null);
  // Sans convention explicite ou quantité, aucune conversion en tonnage.
  // Les contacts sont déjà le total de la prescription, les distances/durées sont par série.
  return {
    tonnageKg:
      item.strengthLoadKind === "external_total" &&
      p.sets !== undefined &&
      p.reps !== undefined &&
      load !== null &&
      !p.unit
        ? p.sets * p.reps * load
        : null,
    distanceM: p.sets !== undefined && p.distance_m !== undefined ? p.sets * p.distance_m : null,
    durationS: p.sets !== undefined && p.duration_s !== undefined ? p.sets * p.duration_s : null,
    groundContacts: p.ground_contacts ?? null,
  };
}
export function analysisEntryTotals(entry: AnalysisEntry): AnalysisTotals {
  const result = emptyAnalysisTotals();
  result.assignedSessions = 1;
  result.loggedSessions = entry.status && ["done", "partial", "skipped"].includes(entry.status) ? 1 : 0;
  result.frozenSessions = entry.frozen ? 1 : 0;
  const items =
    entry.frozen && entry.snapshot
      ? blocksForVariant(entry.snapshot.blocks, entry.variant).flatMap((b) => b.items)
      : [];
  for (const item of items) {
    result.plannedItems++;
    if (item.prescription.sets !== undefined) {
      result.plannedSets += item.prescription.sets;
      result.plannedSetsKnownItems++;
    }
    const volumes = plannedItemVolumes(item);
    for (const key of analysisVolumeKeys)
      if (volumes[key] !== null) {
        result.planned[key] = (result.planned[key] ?? 0) + volumes[key];
        result.plannedKnownItems[key]++;
      }
  }
  if (entry.status !== "done" && entry.status !== "partial") return result;
  result.completedSessions = 1;
  result.detailedSessions = entry.sets.length > 0 ? 1 : 0;
  const work = entry.sets.filter((set) => set.done && set.setKind === "work");
  const actual = actualSetVolumes(work);
  result.completedWorkSets = work.length;
  for (const key of analysisVolumeKeys) result.actual[key] = actual[key];
  result.actualKnownSets.tonnageKg = actual.tonnageKnownSets;
  result.actualKnownSets.distanceM = work.filter((s) => s.distanceM != null).length;
  result.actualKnownSets.durationS = work.filter((s) => s.timeS != null).length;
  result.actualKnownSets.groundContacts = work.filter((s) => s.groundContacts != null).length;
  if (entry.health) {
    result.healthEligibleSessions = 1;
    result.perceivedLoad = sessionLoad(entry.rpe, entry.durationMin);
    result.loadResponses = result.perceivedLoad === null ? 0 : 1;
  }
  return result;
}
export function sumAnalysisTotals(rows: readonly AnalysisTotals[]): AnalysisTotals {
  const result = emptyAnalysisTotals();
  const counters = [
    "assignedSessions",
    "loggedSessions",
    "completedSessions",
    "detailedSessions",
    "frozenSessions",
    "plannedItems",
    "plannedSets",
    "plannedSetsKnownItems",
    "completedWorkSets",
    "loadResponses",
    "healthEligibleSessions",
  ] as const;
  for (const row of rows) {
    for (const key of counters) result[key] += row[key];
    for (const key of analysisVolumeKeys) {
      for (const source of ["planned", "actual"] as const)
        if (row[source][key] !== null) result[source][key] = (result[source][key] ?? 0) + row[source][key];
      result.plannedKnownItems[key] += row.plannedKnownItems[key];
      result.actualKnownSets[key] += row.actualKnownSets[key];
    }
    if (row.perceivedLoad !== null) result.perceivedLoad = (result.perceivedLoad ?? 0) + row.perceivedLoad;
  }
  return result;
}

export function analysisChartPoints(
  data: TrainingAnalysis,
  metric: (typeof analysisVolumeKeys)[number],
  source: "planned" | "actual",
) {
  return data.weeks.map((w) => ({
    date: w.weekStart,
    value: w.totals[source][metric],
    knownSessions: source === "planned" ? w.totals.frozenSessions : w.totals.detailedSessions,
    sessions: w.totals.assignedSessions,
  }));
}

export function analysisPerceivedLoadPoints(data: Pick<TrainingAnalysis, "healthVisible" | "weeks">) {
  if (!data.healthVisible) return [];
  return data.weeks.map((w) => ({
    date: w.weekStart,
    value: w.totals.loadResponses > 0 ? w.totals.perceivedLoad : null,
    knownSessions: w.totals.loadResponses,
    sessions: w.totals.healthEligibleSessions,
  }));
}
