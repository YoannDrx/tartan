import { describe, expect, it } from "vitest";
import { defaultDateForWeek } from "./status";

describe("defaultDateForWeek", () => {
  it("part d'aujourd'hui dans la semaine en cours", () => {
    expect(defaultDateForWeek("2026-11-02", "2026-11-08")).toBe("2026-11-08");
  });

  it("garde le premier jour pour une autre semaine", () => {
    expect(defaultDateForWeek("2026-11-09", "2026-11-08")).toBe("2026-11-09");
  });
});
