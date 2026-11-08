import { proposedSet } from "./performed-sets";
import { describe, expect, it } from "vitest";
import type { DetailedSetInput, ExerciseHistorySession, ResolvedItem, PreviousExerciseSets } from "@tartan/contracts";
import { historyChartGeometry, historyRange, historyVolumePoints } from "./history-chart";
import { actualSetVolumes } from "./progression";
import { lastComparableSets, strengthHistoryRecords, previousSetsForItem } from "./exercise-history";

const set = (extra: Partial<DetailedSetInput> = {}): DetailedSetInput => ({
  itemRef: "item",
  setIndex: 0,
  reps: 4,
  loadKg: 40,
  done: true,
  setKind: "work",
  loadKind: "external",
  repetitionScope: "total",
  sideCount: 1,
  ...extra,
});
const session = (
  day: string,
  sets = [set()],
  convention: "external_total" | "added_weight" | null = "external_total",
): ExerciseHistorySession => ({
  sessionId: `session-${day}`,
  logId: `log-${day}`,
  date: `2026-11-${day}`,
  title: "Force",
  version: 1,
  recordedBy: null,
  updatedAt: "2026-11-01T12:00:00Z",
  status: "done",
  items: [
    {
      itemRef: "item",
      name: "Squat",
      prescription: { sets: 3, reps: 4, load: { type: "kg", value: 100 } },
      resolvedLoadKg: 100,
      strengthLoadKind: convention,
      strengthReference: null,
      sets,
    },
  ],
  volumes: actualSetVolumes(sets),
});

describe("records de séries comparables", () => {
  it("première séance = référence, même avec plusieurs charges, puis amélioration sans égalité ni rejeu", () => {
    const first = session("01", [set(), set({ setIndex: 1, loadKg: 50 })]);
    expect(strengthHistoryRecords([first]).improvements).toEqual([]);
    const second = session("02", [set({ loadKg: 60 })]);
    const result = strengthHistoryRecords([second, first]);
    expect(result.improvements.map((record) => record.kind)).toEqual(["load_at_reps", "estimated_one_rm"]);
    expect(result.improvements.find((record) => record.kind === "load_at_reps")).toMatchObject({
      value: 60,
      previousValue: 50,
      baseline: false,
    });
    expect(strengthHistoryRecords([first, second, second]).improvements).toEqual(result.improvements);
    expect(strengthHistoryRecords([first, second, session("03", [set({ loadKg: 60 })])]).improvements).toEqual(
      result.improvements,
    );
  });

  it("ne compare pas les côtés, le lest, le poids du corps, les échauffements ou les cases non réalisées", () => {
    const baseline = session("01");
    const variants = [
      session("02", [set({ loadKg: 80, repetitionScope: "per_side", sideCount: 2 })]),
      session("03", [set({ loadKg: 80 })], "added_weight"),
      session("04", [set({ loadKg: 80, loadKind: "bodyweight" })]),
      session("05", [set({ loadKg: 80, loadKind: "assisted" })]),
      session("06", [set({ loadKg: 80, setKind: "warmup" })]),
      session("07", [set({ loadKg: 80, done: false })]),
      session("08", [set({ loadKg: 80 })], null),
    ];
    expect(strengthHistoryRecords([baseline, ...variants]).improvements).toEqual([]);
    expect(strengthHistoryRecords([variants[1]!]).current.some((record) => record.kind === "estimated_one_rm")).toBe(
      false,
    );
  });

  it("les records de répétitions ne changent pas la référence choisie, Epley s’arrête à dix", () => {
    const result = strengthHistoryRecords([session("01"), session("02", [set({ reps: 12 })])]);
    expect(result.improvements).toMatchObject([{ kind: "reps_at_load", value: 12, previousValue: 4 }]);
    expect(result.current.find((record) => record.kind === "estimated_one_rm")?.value).toBeCloseTo(40 * (1 + 4 / 30));
  });

  it("recalcule après correction et suppression sans modifier les tableaux reçus", () => {
    const first = session("01");
    const corrected = session("02", [set({ loadKg: 30 })]);
    const input = [corrected, first];
    expect(strengthHistoryRecords(input).improvements).toEqual([]);
    expect(strengthHistoryRecords([first]).current.find((record) => record.kind === "load_at_reps")?.value).toBe(40);
    expect(input[0]).toBe(corrected);
  });

  it("rappelle la dernière réalisation comparable et exclut la séance courante", () => {
    const rows = [
      session("01"),
      session("02", [set({ loadKg: 50 })], "added_weight"),
      session("03", [set({ loadKg: 60 })]),
    ];
    expect(lastComparableSets(rows, set(), "external_total", "session-03")).toMatchObject({
      date: "2026-11-01",
      sets: [{ loadKg: 40 }],
    });
    expect(lastComparableSets(rows, set({ loadKind: "assisted" }), "external_total")).toBeNull();
  });
});

describe("courbes du réalisé", () => {
  it("additionne les mesures connues, garde les manques et ne compte pas deux fois une saisie", () => {
    const first = session("01");
    const corrected = { ...first, version: 2, volumes: actualSetVolumes([set({ loadKg: 30 })]) };
    const missing = session("02", [set({ done: false })]);
    const points = historyVolumePoints([first, corrected, missing, corrected], "tonnageKg");
    expect(points).toEqual([
      { date: "2026-11-01", value: 120, knownSessions: 1, sessions: 1 },
      { date: "2026-11-02", value: null, knownSessions: 0, sessions: 1 },
    ]);
    expect(historyVolumePoints([first], "distanceM")[0]?.value).toBeNull();
    const sameDayMissing = { ...first, logId: "different", volumes: missing.volumes };
    expect(historyVolumePoints([first, sameDayMissing], "tonnageKg")[0]).toMatchObject({
      value: 160,
      knownSessions: 1,
      sessions: 2,
    });
  });
  it("respecte les écarts de dates et coupe la ligne sur une mesure absente", () => {
    const points = historyVolumePoints(
      [session("01"), session("02", [set({ done: false })]), session("05"), session("09"), session("13")],
      "tonnageKg",
    );
    const chart = historyChartGeometry(points);
    expect(chart.showChart).toBe(true);
    expect(chart.path.match(/M/g)).toHaveLength(2);
    expect(chart.dots[0]?.x).toBe(20);
    expect(chart.dots.at(-1)?.x).toBe(580);
    expect(chart.dots[2]!.x - 20).toBeCloseTo(560 / 3);
    expect(historyChartGeometry(points.slice(0, 3)).showChart).toBe(false);
    expect(historyChartGeometry([]).path).toBe("");
  });
  it("emploie des jours calendaires inclusifs indépendants du fuseau et du changement d'heure", () => {
    expect(historyRange("2026-11-08", 28)).toEqual({ from: "2026-10-12", to: "2026-11-08" });
    expect(historyRange("2028-03-01", 365)).toEqual({ from: "2027-03-03", to: "2028-03-01" });
  });
});

it("le rappel suit les conventions du brouillon sans modifier ses valeurs ni mélanger les exercices", () => {
  const item: ResolvedItem = {
    ref: "item",
    exerciseId: "exercise",
    name: "Squat",
    category: "strength",
    cues: [],
    media: null,
    prescription: { sets: 3, reps: 4 },
    strengthLoadKind: "external_total",
    resolvedLoadKg: 100,
    summary: "",
  };
  const rows = [proposedSet(item, 0), proposedSet(item, 1)];
  const before = JSON.stringify(rows);
  const total: PreviousExerciseSets = {
    exerciseId: "exercise",
    convention: "external_total",
    date: "2026-01-01",
    startTime: null,
    sessionId: "old",
    totalSets: 1,
    sets: [set()],
  };
  const side: PreviousExerciseSets = {
    ...total,
    sessionId: "side",
    sets: [set({ repetitionScope: "per_side", sideCount: 2 })],
  };
  const wrongExercise = { ...total, exerciseId: "other" };
  const addedWeight = { ...total, convention: "added_weight" as const };
  expect(previousSetsForItem(item, rows, [side, total, wrongExercise, addedWeight])).toEqual([total]);
  expect(JSON.stringify(rows)).toBe(before);
  expect(
    previousSetsForItem(item, [{ ...rows[0]!, repetitionScope: "per_side", sideCount: 2 }], [total, side]),
  ).toEqual([side]);
  expect(previousSetsForItem(item, [{ ...rows[0]!, loadKind: "" }], [total])).toEqual([]);
  expect(previousSetsForItem(item, [{ ...rows[0]!, setKind: "warmup" }], [total])).toEqual([]);
});
