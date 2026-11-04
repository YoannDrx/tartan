import { describe, expect, it } from "vitest";
import { isSessionAssigned } from "./session-audience";

describe("audience d'une séance", () => {
  const input = {
    date: "2026-11-04",
    athleteId: "a",
    assignments: [{ targetType: "group" as const, targetId: "g" }],
    groups: [{ groupId: "g", joinedOn: "2026-11-04" }],
  };
  it("inclut le jour d'arrivée, jamais les jours précédents du groupe", () => {
    expect(isSessionAssigned(input)).toBe(true);
    expect(isSessionAssigned({ ...input, date: "2026-11-03" })).toBe(false);
  });
  it("conserve une validation après le départ du groupe", () => {
    expect(isSessionAssigned({ ...input, groups: [], hasLog: true })).toBe(true);
    expect(isSessionAssigned({ ...input, groups: [] })).toBe(false);
  });
  it("permet une attribution individuelle explicite, pas celle d'un autre athlète", () => {
    expect(isSessionAssigned({ ...input, groups: [], assignments: [{ targetType: "athlete", targetId: "a" }] })).toBe(
      true,
    );
    expect(isSessionAssigned({ ...input, groups: [], assignments: [{ targetType: "athlete", targetId: "b" }] })).toBe(
      false,
    );
  });
});
