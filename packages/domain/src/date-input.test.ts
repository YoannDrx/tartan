import { describe, expect, it } from "vitest";
import { formatDateInput, isDateInRange, maskDateInput, monthGrid, parseDateInput, shiftMonth } from "./date-input";

describe("saisie de date JJ/MM/AAAA", () => {
  it("affiche en français et relit vers l'ISO", () => {
    expect(formatDateInput("2026-11-08")).toBe("08/11/2026");
    expect(parseDateInput("08/11/2026")).toBe("2026-11-08");
    expect(parseDateInput("2026-11-08")).toBe("2026-11-08");
  });

  it("refuse une date impossible ou incomplète", () => {
    for (const text of ["31/02/2026", "00/01/2026", "12/13/2026", "08/11", "", "08/11/1850"])
      expect(parseDateInput(text)).toBeNull();
    expect(parseDateInput("29/02/2028")).toBe("2028-02-29");
  });

  it("place les barres pendant la frappe", () => {
    expect(maskDateInput("0811")).toBe("08/11");
    expect(maskDateInput("08112026999")).toBe("08/11/2026");
    expect(maskDateInput("0")).toBe("0");
    expect(maskDateInput("")).toBe("");
  });

  it("construit six semaines depuis le lundi", () => {
    const grid = monthGrid(2026, 11);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid[41]).toBe("2026-12-06");
  });

  it("traverse les années et respecte les bornes", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(isDateInRange("2026-11-08", "2026-11-09")).toBe(false);
    expect(isDateInRange("2026-11-08", undefined, "2026-11-08")).toBe(true);
  });
});
