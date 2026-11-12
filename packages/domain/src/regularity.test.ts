import { describe, expect, it } from "vitest";
import { regularity, type RegularityEntry } from "./regularity";

// Le jeudi 12 novembre 2026 ; les lundis des semaines : 9, 2 novembre, 26 et 19 octobre.
const TODAY = "2026-11-12";
const e = (date: string, status: RegularityEntry["status"], excused = false): RegularityEntry => ({
  date,
  status,
  excused,
});

describe("série de régularité", () => {
  it("compte les semaines de suite où chaque séance est rendue, la semaine en cours comprise", () => {
    expect(
      regularity(
        [e("2026-10-20", "done"), e("2026-10-27", "done"), e("2026-11-03", "partial"), e("2026-11-10", "done")],
        TODAY,
      ),
    ).toEqual({ weeks: 4, planned: 1, validated: 1 });
  });

  it("une séance manquée casse la série, celle d'avant ne compte plus", () => {
    expect(regularity([e("2026-10-20", "done"), e("2026-10-28", "missed"), e("2026-11-03", "done")], TODAY).weeks).toBe(
      1,
    );
  });

  it("une absence signalée excuse la séance, une semaine sans séance ne casse rien", () => {
    const entries = [
      e("2026-10-20", "done"),
      // Semaine du 26 octobre : aucune séance.
      e("2026-11-03", "missed", true),
      e("2026-11-05", "done"),
      e("2026-11-10", "done"),
    ];
    expect(regularity(entries, TODAY)).toEqual({ weeks: 3, planned: 1, validated: 1 });
  });

  it("la séance du jour reste à faire : la semaine en cours ne casse pas, et ne compte pas encore", () => {
    expect(regularity([e("2026-11-03", "done"), e("2026-11-12", "upcoming")], TODAY)).toEqual({
      weeks: 1,
      planned: 1,
      validated: 0,
    });
  });

  it("une séance manquée cette semaine remet la série à zéro", () => {
    expect(regularity([e("2026-11-03", "done"), e("2026-11-10", "missed"), e("2026-11-11", "done")], TODAY)).toEqual({
      weeks: 0,
      planned: 2,
      validated: 1,
    });
  });

  it("sans aucune séance, rien", () => {
    expect(regularity([], TODAY)).toEqual({ weeks: 0, planned: 0, validated: 0 });
  });
});
