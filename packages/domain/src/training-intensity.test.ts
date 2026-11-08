import { expect, it } from "vitest";
import type { SnapshotItem, DetailedSetInput } from "@tartan/contracts";
import type { AnalysisEntry } from "./training-analysis";
import { analyzeTrainingIntensity, intensityComparisonRows } from "./training-intensity";
const id = "00000000-0000-4000-8000-000000000001";
const item: SnapshotItem = {
  ref: "i",
  exerciseId: id,
  name: "Squat",
  category: "strength",
  cues: [],
  media: null,
  strengthLoadKind: "external_total",
  resolvedLoadKg: 40,
  prescription: { sets: 3, reps: 4, load: { type: "kg", value: 40 }, intensityTarget: { type: "rir", value: 0 } },
};
const set: DetailedSetInput = {
  itemRef: "i",
  setIndex: 0,
  done: true,
  setKind: "work",
  loadKind: "external",
  loadKg: 40,
  reps: 4,
  repetitionScope: "total",
  sideCount: 1,
};
function entry(i: SnapshotItem = item, sets: DetailedSetInput[] = [set]): AnalysisEntry {
  return {
    snapshot: {
      title: "Force",
      type: "strength",
      durationMin: 40,
      coachNote: null,
      blocks: [{ ref: "b", name: "Force", variant: "club", items: [i] }],
    },
    frozen: true,
    variant: "club",
    status: "partial",
    sets,
    health: false,
    rpe: 10,
    durationMin: 40,
  };
}
it("sépare kilogrammes, RIR zéro et effort réalisé, avec pondérations explicites", () => {
  const result = analyzeTrainingIntensity([
    entry(item, [
      set,
      { ...set, setIndex: 1, loadKg: 0 },
      { ...set, setIndex: 2, loadKg: null },
      { ...set, setIndex: 3, setKind: "warmup", loadKg: 100 },
    ]),
  ]);
  expect(result.rows.find((r) => r.metric === "kg")).toMatchObject({
    planned: { count: 1, eligible: 1, mean: 40 },
    actual: { count: 2, eligible: 3, mean: 20, min: 0, max: 40 },
  });
  expect(result.rows.find((r) => r.metric === "target_rir")).toMatchObject({
    planned: { mean: 0, count: 1 },
    actual: null,
  });
  expect(result.rows.find((r) => r.metric === "target_rpe")).toMatchObject({
    planned: { mean: null, count: 0 },
    actual: null,
  });
});
it("utilise uniquement la référence figée compatible pour les pourcentages réalisés", () => {
  const i: SnapshotItem = {
    ...item,
    prescription: { load: { type: "pct_1rm", value: 80, test: `exercise:${id}` } },
    strengthReference: {
      id,
      exerciseKey: `exercise:${id}`,
      value: 50,
      kind: "one_rm",
      originKind: "working",
      date: "2030-01-01",
      loadKind: "external_total",
    },
  };
  expect(analyzeTrainingIntensity([entry(i)]).rows.find((r) => r.metric === "pct_reference")).toMatchObject({
    planned: { mean: 80 },
    actual: { mean: 80, count: 1 },
  });
  for (const strengthReference of [
    null,
    { ...i.strengthReference!, value: 0 },
    { ...i.strengthReference!, loadKind: "added_weight" },
    { ...i.strengthReference!, exerciseKey: "other" },
  ]) {
    expect(
      analyzeTrainingIntensity([entry({ ...i, strengthReference })]).rows.find((r) => r.metric === "pct_reference"),
    ).toMatchObject({ planned: { mean: 80 }, actual: { mean: null, eligible: 1 } });
  }
});
it("ne mélange pas exercices, assistance et charge additionnelle", () => {
  const rows = analyzeTrainingIntensity([
    entry(),
    entry({ ...item, exerciseId: "00000000-0000-4000-8000-000000000002" }),
    entry({ ...item, strengthLoadKind: "assistance" }, [{ ...set, loadKind: "assisted", loadKg: 15 }]),
    entry({ ...item, strengthLoadKind: "added_weight" }, [{ ...set, loadKg: 10 }]),
  ]).rows.filter((r) => r.metric === "kg");
  expect(rows).toHaveLength(4);
  expect(rows.find((r) => r.loadKind === "assistance")?.actual?.mean).toBe(15);
  expect(rows.find((r) => r.loadKind === "added_weight")?.actual?.mean).toBe(10);
  expect(
    analyzeTrainingIntensity([entry({ ...item, strengthLoadKind: "bodyweight" })]).rows.find((r) => r.metric === "kg")
      ?.actual?.count,
  ).toBe(0);
});
it("ne remplace pas le réalisé absent et compte les séries sans référence comparable", () => {
  const absent = analyzeTrainingIntensity([entry(item, [])]);
  expect(absent.rows.find((r) => r.metric === "kg")?.actual).toMatchObject({ count: 0, mean: null });
  const unlinked = analyzeTrainingIntensity([entry({ ...item, exerciseId: null }), { ...entry(), frozen: false }]);
  expect(unlinked).toEqual({ rows: [], unlinkedItems: 1, unmatchedWorkSets: 2 });
  expect(
    analyzeTrainingIntensity([{ ...entry(), status: "skipped" }]).rows.find((r) => r.metric === "kg")?.actual?.count,
  ).toBe(0);
});
it("conserve les dénominateurs manquants lors d’une comparaison avec une période renseignée", () => {
  const current = analyzeTrainingIntensity([
    entry({ ...item, resolvedLoadKg: null, prescription: {} }, [{ ...set, loadKg: null }]),
  ]);
  const previous = analyzeTrainingIntensity([entry()]);
  const compared = intensityComparisonRows({ current, previous }, "kg");
  expect(compared).toHaveLength(1);
  expect(compared[0]?.current).toMatchObject({ planned: { count: 0, eligible: 1 }, actual: { count: 0, eligible: 1 } });
  expect(intensityComparisonRows({ current, previous: current }, "kg")).toHaveLength(0);
});

it("respecte la conversion historique 3RM et refuse une origine inconnue", () => {
  const i: SnapshotItem = {
    ...item,
    prescription: { load: { type: "pct_1rm", value: 80, test: "back_squat" } },
    strengthReference: {
      id,
      exerciseKey: "back_squat",
      value: 50,
      kind: "three_rm",
      date: "2030-01-01",
      loadKind: "external_total",
    },
  };
  const result = analyzeTrainingIntensity([entry(i, [{ ...set, loadKg: 44 }])]);
  expect(result.rows.find((r) => r.metric === "pct_reference")?.actual?.mean).toBeCloseTo(80);
  expect(
    analyzeTrainingIntensity([
      entry({ ...i, strengthReference: { ...i.strengthReference!, kind: "unknown" } }),
    ]).rows.find((r) => r.metric === "pct_reference")?.actual?.mean,
  ).toBeNull();
});
