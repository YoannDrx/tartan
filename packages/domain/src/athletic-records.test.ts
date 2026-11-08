import { expect, it } from "vitest";
import { performanceInput } from "@tartan/contracts";
import { athleticRecordStates, type AthleticMark } from "./athletic-records";

const row = (id: string, mark: number, unit = "m", extra: Partial<AthleticMark> = {}): AthleticMark => ({
  id,
  mark,
  unit,
  discipline: "Test",
  date: `2030-06-${id === "a" ? "01" : "02"}`,
  createdAt: "2030-06-01T00:00:00Z",
  ...extra,
});
it("sépare chronos et distances, avec référence initiale puis amélioration dans le bon sens", () => {
  expect([...athleticRecordStates([row("a", 12, "s"), row("b", 11.5, "s"), row("c", 2), row("d", 205, "cm")])]).toEqual(
    [
      ["b", { isPb: true, isBaseline: false }],
      ["d", { isPb: true, isBaseline: false }],
    ],
  );
  expect(athleticRecordStates([row("a", 2), row("b", 200, "cm")]).get("a")).toEqual({ isBaseline: true, isPb: false });
});
it("ne compare pas deux contextes, disciplines, règles invalides ou unités inconnues", () => {
  const states = athleticRecordStates([
    row("a", 12, "s"),
    row("b", 11, "s", { comparisonContext: "manuel" }),
    row("c", 10, "s", { discipline: "Autre" }),
    row("d", 9, "s", { recordDirection: "higher" }),
    row("e", 500, "points"),
    row("f", Infinity),
    row("g", -2),
  ]);
  expect([...states.keys()]).toEqual(["a", "b", "c"]);
  expect([...states.values()].every((v) => v.isBaseline)).toBe(true);
});
it("recalcule après correction, suppression ou saisie antidatée sans dépendre de l'ordre reçu", () => {
  const first = row("a", 12, "s"),
    best = row("b", 11, "s");
  expect(athleticRecordStates([best, first]).get("b")?.isPb).toBe(true);
  expect(athleticRecordStates([first, { ...best, mark: 13 }]).get("a")?.isBaseline).toBe(true);
  expect(athleticRecordStates([best]).get("b")?.isBaseline).toBe(true);
  expect(athleticRecordStates([first, { ...best, date: "2020-01-01" }]).get("b")?.isBaseline).toBe(true);
});
it("refuse les règles et précisions incohérentes à l'écriture, accepte les anciens champs connus", () => {
  const base = {
    athleteId: "d794c10d-c58a-4e2f-b15c-d65914b8436d",
    discipline: "100 m",
    mark: 11.23,
    unit: "s",
    date: "2030-06-01",
  };
  expect(performanceInput.safeParse(base).success).toBe(true);
  for (const extra of [
    { measurementType: "distance" },
    { recordDirection: "higher" },
    { mark: 11.2345 },
    { date: "2030-02-30" },
    { wind: 2.25 },
  ]) {
    expect(performanceInput.safeParse({ ...base, ...extra }).success).toBe(false);
  }
});
