import { describe, expect, it } from "vitest";
import type { DetailedSetInput, SnapshotItem } from "@tartan/contracts";
import {
  analysisEntryTotals,
  analysisPerceivedLoadPoints,
  scopeAnalysisEntries,
  plannedItemVolumes,
  sumAnalysisTotals,
  type AnalysisEntry,
} from "./training-analysis";
import { historyChartGeometry } from "./history-chart";
const item: SnapshotItem = {
  ref: "force",
  exerciseId: null,
  name: "Squat",
  category: "strength",
  cues: [],
  media: null,
  strengthLoadKind: "external_total",
  resolvedLoadKg: 40,
  prescription: { sets: 3, reps: 4, load: { type: "kg", value: 40 } },
};
const set: DetailedSetInput = {
  itemRef: "force",
  setIndex: 0,
  done: true,
  reps: 4,
  loadKg: 40,
  setKind: "work",
  loadKind: "external",
  repetitionScope: "total",
  sideCount: 1,
};
const base: AnalysisEntry = {
  snapshot: {
    title: "Force",
    type: "strength",
    durationMin: 45,
    coachNote: null,
    blocks: [{ ref: "b", name: "Force", variant: "club", items: [item] }],
  },
  frozen: true,
  variant: "club",
  status: "partial",
  sets: [set, { ...set, setIndex: 1 }],
  health: false,
  rpe: 8,
  durationMin: 45,
};
describe("analyse avec provenance et couverture", () => {
  it("distingue 480 kg prescrits de 320 kg réellement saisis", () => {
    expect(analysisEntryTotals(base)).toMatchObject({
      planned: { tonnageKg: 480 },
      actual: { tonnageKg: 320 },
      plannedSets: 3,
      completedWorkSets: 2,
      plannedKnownItems: { tonnageKg: 1 },
      actualKnownSets: { tonnageKg: 2 },
      perceivedLoad: null,
    });
  });
  it("une prescription non figée reste absente des volumes prévus", () => {
    expect(analysisEntryTotals({ ...base, frozen: false })).toMatchObject({
      plannedItems: 0,
      planned: { tonnageKg: null },
      actual: { tonnageKg: 320 },
    });
  });
  it("une validation simple ne remplit jamais le réalisé", () => {
    expect(analysisEntryTotals({ ...base, status: "done", sets: [] })).toMatchObject({
      actual: { tonnageKg: null, distanceM: null },
      completedSessions: 1,
      detailedSessions: 0,
    });
  });
  it("ne compte pas un statut manqué automatique comme une réponse", () => {
    expect(analysisEntryTotals({ ...base, status: "missed", sets: [] }).loggedSessions).toBe(0);
    expect(analysisEntryTotals({ ...base, status: "skipped", sets: [] }).loggedSessions).toBe(1);
  });
  it("exclut échauffement, séries non faites et séance non réalisée", () => {
    expect(
      analysisEntryTotals({
        ...base,
        sets: [
          { ...set, setKind: "warmup" },
          { ...set, done: false },
        ],
      }).actual.tonnageKg,
    ).toBeNull();
    expect(analysisEntryTotals({ ...base, status: "missed" }).completedWorkSets).toBe(0);
  });
  it("respecte les répétitions par côté sans assimiler assistance ou poids du corps", () => {
    expect(
      analysisEntryTotals({ ...base, sets: [{ ...set, repetitionScope: "per_side", sideCount: 2 }] }).actual.tonnageKg,
    ).toBe(320);
    expect(
      analysisEntryTotals({
        ...base,
        sets: [
          { ...set, loadKind: "assisted" },
          { ...set, loadKind: "bodyweight" },
        ],
      }).actual.tonnageKg,
    ).toBeNull();
    for (const kind of ["assistance", "bodyweight", "added_weight"] as const)
      expect(plannedItemVolumes({ ...item, strengthLoadKind: kind }).tonnageKg).toBeNull();
  });
  it("ne devine ni séries ni maximum ni unités ambiguës", () => {
    expect(plannedItemVolumes({ ...item, prescription: { reps: 4 }, resolvedLoadKg: null }).tonnageKg).toBeNull();
    expect(
      plannedItemVolumes({
        ...item,
        prescription: { sets: 3, reps: 4, load: { type: "pct_1rm", value: 80, test: "squat" } },
        resolvedLoadKg: null,
      }).tonnageKg,
    ).toBeNull();
    expect(
      plannedItemVolumes({ ...item, prescription: { ...item.prescription, unit: "par côté" } }).tonnageKg,
    ).toBeNull();
  });
  it("garde les unités distinctes et les contacts totaux", () => {
    expect(
      plannedItemVolumes({ ...item, prescription: { sets: 3, distance_m: 100, duration_s: 15, ground_contacts: 30 } }),
    ).toEqual({ tonnageKg: null, distanceM: 300, durationS: 45, groundContacts: 30 });
  });
  it("ne compte que la variante sélectionnée", () => {
    expect(analysisEntryTotals({ ...base, variant: "autonomous" }).plannedItems).toBe(0);
  });
  it("affiche la couverture santé, sans remplacer une réponse manquante par zéro", () => {
    const a = analysisEntryTotals({ ...base, health: true });
    const b = analysisEntryTotals({ ...base, health: true, rpe: null });
    expect(sumAnalysisTotals([a, b])).toMatchObject({
      perceivedLoad: 360,
      loadResponses: 1,
      healthEligibleSessions: 2,
    });
    expect(sumAnalysisTotals([]).actual.tonnageKg).toBeNull();
  });
  it("coupe la courbe de charge ressentie aux semaines manquantes et cache tout sans consentement", () => {
    const weeks = [
      { weekStart: "2030-06-03", totals: analysisEntryTotals({ ...base, health: true }) },
      { weekStart: "2030-06-10", totals: analysisEntryTotals({ ...base, health: true, rpe: null }) },
      { weekStart: "2030-06-17", totals: analysisEntryTotals({ ...base, health: true, rpe: 0 }) },
    ];
    const points = analysisPerceivedLoadPoints({ healthVisible: true, weeks });
    expect(points.map((p) => [p.value, p.knownSessions, p.sessions])).toEqual([
      [360, 1, 1],
      [null, 0, 1],
      [0, 1, 1],
    ]);
    expect(historyChartGeometry(points).path.match(/M/g)).toHaveLength(2);
    expect(historyChartGeometry(points).path).not.toContain("L");
    expect(analysisPerceivedLoadPoints({ healthVisible: false, weeks })).toEqual([]);
  });
  it("filtre la phase conservée et compare les mêmes athlètes à leur période précédente", () => {
    const entries = [
      { date: "2030-06-12", athleteId: "a", phaseId: "cycle" },
      { date: "2030-06-12", athleteId: "b", phaseId: "autre" },
      { date: "2030-06-13", athleteId: "a", phaseId: null },
      { date: "2030-05-12", athleteId: "a", phaseId: "precedent" },
      { date: "2030-05-12", athleteId: "b", phaseId: "precedent" },
    ];
    const result = scopeAnalysisEntries(entries, {
      from: "2030-06-01",
      to: "2030-06-28",
      previousFrom: "2030-05-04",
      previousTo: "2030-05-31",
      phaseId: "cycle",
    });
    expect(result.current).toEqual([entries[0]]);
    expect(result.previous).toEqual([entries[3]]);
    expect(result.coverage).toEqual({ matched: 1, withoutReference: 1, otherPhase: 1 });
  });
});
