import { describe, expect, it } from "vitest";
import {
  celebrationFromResponse,
  confirmedRecordsFromResponse,
  confirmedStrengthImprovements,
  createStrengthRecordAccumulator,
  strengthCandidates,
  type StrengthObservation,
} from "./strength-records";

const observation = (day: string, kg: number, extra: Partial<StrengthObservation> = {}): StrengthObservation => ({
  exerciseId: "squat",
  exerciseName: "Squat",
  convention: "external_total",
  sessionId: day,
  logId: day,
  date: `2026-11-${day}`,
  order: day,
  set: {
    itemRef: "item",
    setIndex: 0,
    reps: 4,
    loadKg: kg,
    done: true,
    setKind: "work",
    loadKind: "external",
    repetitionScope: "total",
    sideCount: 1,
  },
  ...extra,
});
const records = (...observations: StrengthObservation[]) => {
  const state = createStrengthRecordAccumulator();
  observations.forEach((value) => state.add(value));
  return state.values();
};

describe("records toutes périodes", () => {
  it("retient la meilleure série de la première séance comme référence initiale, quel que soit l’ordre des pages", () => {
    const first = observation("01", 40);
    const stronger = observation("01", 50, { set: { ...first.set, loadKg: 50, setIndex: 1 } });
    const later = observation("02", 45);
    const expected = records(first, stronger, later);
    expect(records(later, stronger, first, first)).toEqual(expected);
    expect(expected.find((r) => r.kind === "load_at_reps")).toMatchObject({ value: 50, baseline: true, logId: "01" });
    expect(records(first, observation("02", 60)).find((r) => r.kind === "load_at_reps")).toMatchObject({
      value: 60,
      baseline: false,
    });
  });
  it("ne compare ni exercices, ni conventions, ni répétitions par côté, et réserve Epley à 2–10", () => {
    const first = observation("01", 40);
    const rows = [
      first,
      observation("02", 100, { exerciseId: "press" }),
      observation("03", 80, { convention: "added_weight" }),
      observation("04", 70, { set: { ...first.set, loadKg: 70, repetitionScope: "per_side", sideCount: 2 } }),
    ];
    expect(records(...rows).every((r) => r.baseline)).toBe(true);
    for (const reps of [1, 11])
      expect(strengthCandidates({ ...first, set: { ...first.set, reps } }).map((r) => r.kind)).not.toContain(
        "estimated_one_rm",
      );
    for (const set of [
      { ...first.set, done: false },
      { ...first.set, setKind: "warmup" as const },
      { ...first.set, loadKind: "assisted" as const },
      { ...first.set, loadKg: null },
    ]) {
      expect(strengthCandidates({ ...first, set })).toEqual([]);
    }
  });
  it("confirme seulement une nouvelle amélioration de la mutation, pas une première référence, une égalité ou une ancienne performance", () => {
    const first = observation("01", 40);
    const second = observation("02", 60);
    const before = records(first);
    const after = records(first, second);
    const input = { logId: "02", version: 1, clientId: "mutation" };
    const events = confirmedStrengthImprovements(before, after, input);
    expect(events.map((r) => r.kind)).toEqual(["load_at_reps", "estimated_one_rm"]);
    expect(events.every((r) => r.previousValue < r.value && r.logVersion === 1)).toBe(true);
    expect(confirmedStrengthImprovements(before, after, input)).toEqual(events);
    expect(confirmedStrengthImprovements([], after, input)).toEqual([]);
    expect(confirmedStrengthImprovements(after, after, input)).toEqual([]);
    expect(confirmedStrengthImprovements(before, after, { ...input, logId: "other" })).toEqual([]);
    expect(confirmedStrengthImprovements(before, records(observation("01", 80)), { ...input, logId: "01" })).toEqual(
      [],
    );
  });
  it("une correction ou suppression retire le maximum, sans événement d’amélioration ni changement de la source reçue", () => {
    const first = observation("01", 40);
    const original = observation("02", 60);
    const before = records(first, original);
    const corrected = records(first, observation("02", 30));
    expect(corrected.find((r) => r.kind === "load_at_reps")).toMatchObject({ value: 40, logId: "01", baseline: true });
    expect(confirmedStrengthImprovements(before, corrected, { logId: "02", version: 2, clientId: "correct" })).toEqual(
      [],
    );
    expect(records(first).find((r) => r.kind === "load_at_reps")?.value).toBe(40);
    expect(original.set.loadKg).toBe(60);
  });
});

it("ne présente aucun badge à partir d’une réponse rejouée, invalide ou d’une autre version", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const value = {
    ...records(observation("01", 40))[0]!,
    exerciseId: id,
    sessionId: id,
    logId: id,
    baseline: false,
    eventId: "event",
    logVersion: 2,
    previousValue: 20,
  };
  const response = { id, version: 2, replayed: false, records: [value] };
  expect(confirmedRecordsFromResponse(response)).toEqual([value]);
  expect(confirmedRecordsFromResponse({ ...response, replayed: true })).toEqual([]);
  expect(confirmedRecordsFromResponse({ ...response, version: 3 })).toEqual([]);
  expect(confirmedRecordsFromResponse({ ...response, id: "other" })).toEqual([]);
  expect(confirmedRecordsFromResponse({ ...response, records: [{ ...value, baseline: true }] })).toEqual([]);
  expect(confirmedRecordsFromResponse(null)).toEqual([]);
});

it("une célébration exige une réponse directe, une version cohérente et un identifiant lié à la validation", () => {
  const reply = { id: "log", version: 1, replayed: false, celebration: { id: "log:1", logVersion: 1, records: [] } };
  expect(celebrationFromResponse(reply)).toEqual(reply.celebration);
  expect(celebrationFromResponse({ ...reply, replayed: true })).toBeNull();
  expect(celebrationFromResponse({ ...reply, version: 2 })).toBeNull();
  expect(celebrationFromResponse({ ...reply, id: "another" })).toBeNull();
  expect(celebrationFromResponse({ ...reply, celebration: null })).toBeNull();
  expect(celebrationFromResponse({ id: "old-server", replayed: false })).toBeNull();
});
