import { expect, it } from "vitest";
import { rankPlannerCandidates } from "./planner-candidates";
it("retrouve un alias accentué au-delà de 500 fiches sans confondre les variantes", () => {
  const entries = Array.from({ length: 700 }, (_, i) => ({
    id: String(i).padStart(4, "0"),
    name: `Exercice privé ${i}`,
    aliases: [] as string[],
  }));
  entries.push(
    { id: "9001", name: "Épaulé en puissance", aliases: ["Power clean"] },
    { id: "9002", name: "Épaulé complet", aliases: ["Clean"] },
  );
  const result = rankPlannerCandidates(entries, "Lundi power clean, 3 fois 4", 2);
  expect(result.map((entry) => entry.id)).toEqual(["9001", "9002"]);
  expect(rankPlannerCandidates(entries, "EPAULE COMPLET", 1)[0]!.id).toBe("9002");
});
it("conserve toutes les fiches candidates partageant un nom pour permettre la clarification", () => {
  const entries = [
    { id: "a", name: "Squat arrière", aliases: ["squat"] },
    { id: "b", name: "Squat avant", aliases: ["squat"] },
  ];
  expect(rankPlannerCandidates(entries, "squat", 150)).toEqual(entries);
});
