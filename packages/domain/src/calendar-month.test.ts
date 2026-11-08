import { describe, expect, it } from "vitest";
import { calendarCompletion, monthRange, shiftMonthKey, visibleDayItems } from "./calendar-month";

describe("mois du calendrier", () => {
  it("couvre six semaines complètes commençant un lundi", () => {
    const range = monthRange("2026-11");
    expect(range.cells).toHaveLength(42);
    expect(range.from).toBe("2026-10-26");
    expect(range.to).toBe("2026-12-06");
    expect(new Date(`${range.from}T12:00:00Z`).getUTCDay()).toBe(1);
  });

  it("passe d'une année à l'autre", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2027-01", -1)).toBe("2026-12");
  });

  it("compte une séance sautée comme manquée, sans toucher à l'effectif", () => {
    expect(calendarCompletion(["done", "partial", "missed", "skipped"], 12)).toEqual({
      done: 1,
      partial: 1,
      missed: 2,
      total: 12,
    });
  });

  it("résume les séances au-delà de la limite", () => {
    expect(visibleDayItems([1, 2, 3, 4, 5])).toEqual({ visible: [1, 2, 3], hidden: 2 });
    expect(visibleDayItems([1])).toEqual({ visible: [1], hidden: 0 });
  });
});
