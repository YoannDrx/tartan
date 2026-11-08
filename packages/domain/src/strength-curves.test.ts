import { expect, it } from "vitest";
import type { DetailedSetInput, ExerciseHistory, ExerciseHistorySession } from "@tartan/contracts";
import { actualSetVolumes } from "./progression";
import { strengthHistoryCurves } from "./strength-curves";

const set = (extra: Partial<DetailedSetInput> = {}): DetailedSetInput => ({
  itemRef: "item",
  setIndex: 0,
  done: true,
  setKind: "work",
  loadKind: "external",
  repetitionScope: "total",
  sideCount: 1,
  reps: 4,
  loadKg: 40,
  ...extra,
});
const session = (
  day: string,
  sets = [set()],
  convention: "external_total" | "added_weight" | null = "external_total",
): ExerciseHistorySession => ({
  sessionId: `session-${day}`,
  logId: `log-${day}`,
  version: 1,
  date: `2026-11-${day}`,
  title: "Force",
  status: "done",
  recordedBy: null,
  updatedAt: "2026-11-01T12:00:00Z",
  items: [
    {
      itemRef: "item",
      name: "Squat",
      prescription: { sets: 3, reps: 4 },
      resolvedLoadKg: 100,
      strengthLoadKind: convention,
      strengthReference: null,
      sets,
    },
  ],
  volumes: actualSetVolumes(sets),
});
type Input = Parameters<typeof strengthHistoryCurves>[0];
const input = (sessions: ExerciseHistorySession[], tests: ExerciseHistory["tests"] = []): Input => ({
  sessions,
  tests,
  from: "2026-11-01",
  to: "2026-11-30",
});
const test = (id: string, date: string, kind: string, value: number, loadKind: string | null = "external_total") => ({
  id,
  date,
  kind,
  value,
  loadKind,
  exerciseKey: "exercise:squat",
});

it("courbes distinctes pour charge à répétitions égales et Epley 2–10, sans prescription supposée", () => {
  const curves = strengthHistoryCurves(
    input([
      session("01", [set(), set({ setIndex: 1 }), set({ setIndex: 2, setKind: "warmup", loadKg: 100 })]),
      session("02", [set({ reps: 1, loadKg: 50 })]),
      session("03", [set({ reps: 11, loadKg: 60 })]),
      session("04", [set({ reps: 10, loadKg: 45 })]),
    ]),
  );
  expect(
    curves.find((curve) => curve.source === "work_load" && curve.reps === 4)?.points.map((point) => point.value),
  ).toEqual([40, null, null, null]);
  expect(curves.find((curve) => curve.source === "work_load" && curve.reps === 1)?.points[1]?.value).toBe(50);
  expect(curves.find((curve) => curve.source === "work_load" && curve.reps === 11)?.points[2]?.value).toBe(60);
  const epley = curves.find((curve) => curve.source === "work_epley")!;
  expect(epley.points[0]?.value).toBeCloseTo(45.333333);
  expect(epley.points.slice(1).map((point) => point.value)).toEqual([null, null, 60]);
  expect(curves.some((curve) => curve.source.startsWith("test_"))).toBe(false);
  expect(curves.every((curve) => curve.points.every((point) => point.value !== 100))).toBe(true);
});

it("ne mélange ni côtés, ni lest, ni assistance, ni anciennes conventions inconnues", () => {
  const curves = strengthHistoryCurves(
    input([
      session("01"),
      session("02", [set({ repetitionScope: "per_side", sideCount: 2 })]),
      session("03", [set({ loadKg: 20 })], "added_weight"),
      session("04", [set({ loadKind: "assisted" })]),
      session("05", [set({ loadKind: "bodyweight", loadKg: null })]),
      session("06", [set({ done: false })]),
      session("07", [set()], null),
    ]),
  );
  expect(curves.filter((curve) => curve.source === "work_load")).toHaveLength(3);
  expect(curves.filter((curve) => curve.source === "work_epley")).toHaveLength(2);
  const added = curves.filter((curve) => curve.convention === "added_weight");
  expect(added).toHaveLength(1);
  expect(added[0]?.source).toBe("work_load");
  expect(curves.every((curve) => curve.points.slice(3).every((point) => point.value === null))).toBe(true);
});

it("sépare tests 1RM, 3RM et estimations, conserve leur valeur et filtre la période", () => {
  const tests = [
    test("one", "2026-11-01", "one_rm", 100),
    test("three", "2026-11-02", "three_rm", 90),
    test("estimate", "2026-11-03", "estimated", 110),
    test("old", "2026-10-31", "one_rm", 200),
    test("future", "2026-12-01", "one_rm", 250),
    test("unknown", "2026-11-04", "one_rm", 300, null),
  ];
  const curves = strengthHistoryCurves(input([session("01")], tests));
  expect(curves.filter((curve) => curve.source.startsWith("test_"))).toHaveLength(3);
  expect(curves.find((curve) => curve.source === "test_one_rm")?.points.map((point) => point.value)).toEqual([
    100,
    null,
    null,
    null,
  ]);
  expect(curves.find((curve) => curve.source === "test_three_rm")?.points[1]?.value).toBe(90);
  expect(curves.find((curve) => curve.source === "test_estimated")?.points[2]?.value).toBe(110);
  expect(
    curves.filter((curve) => curve.source.startsWith("test_")).every((curve) => curve.repetitionScope === null),
  ).toBe(true);
});

it("retient la meilleure valeur journalière, indique la couverture et applique les corrections sans doublons", () => {
  const first = session("01");
  const correction = { ...first, version: 2, items: [{ ...first.items[0]!, sets: [set({ loadKg: 30 })] }] };
  const other = { ...session("01", [set({ loadKg: 50 })]), logId: "other", sessionId: "other" };
  const missing = { ...session("01", [set({ done: false })]), logId: "missing", sessionId: "missing" };
  const before = JSON.stringify([first, correction, other, missing]);
  const curves = strengthHistoryCurves(input([first, correction, correction, other, missing]));
  expect(curves.find((curve) => curve.source === "work_load")?.points).toEqual([
    { date: "2026-11-01", value: 50, knownSessions: 2, sessions: 3 },
  ]);
  expect(
    strengthHistoryCurves(input([first, correction])).find((curve) => curve.source === "work_load")?.points[0]?.value,
  ).toBe(30);
  expect(JSON.stringify([first, correction, other, missing])).toBe(before);
  const removed = { ...correction, version: 3, items: [{ ...correction.items[0]!, sets: [] }] };
  expect(strengthHistoryCurves(input([first, correction, removed]))).toEqual([]);
  const t = test("same", "2026-11-01", "one_rm", 100);
  expect(strengthHistoryCurves(input([], [t, t, test("other", "2026-11-01", "one_rm", 105)]))[0]?.points).toEqual([
    { date: "2026-11-01", value: 105, knownSessions: 2, sessions: 2 },
  ]);
});
