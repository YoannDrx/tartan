import { describe, expect, it } from "vitest";
import type { DetailedSetInput, ExerciseHistorySession } from "@tartan/contracts";
import { actualSetVolumes } from "./progression";
import { lastComparableSets, strengthHistoryRecords } from "./exercise-history";

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
