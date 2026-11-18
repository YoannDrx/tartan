import { describe, expect, it } from "vitest";
import { exerciseConciseGuide } from "@tartan/contracts";
import {
  CONCISE_BY_FAMILY,
  CONCISE_RULES,
  conciseGuideFor,
  conciseProblems,
  EXERCISE_CATALOG,
  guideMatchesCatalog,
} from "./exercise-catalog";

const keys = new Set(EXERCISE_CATALOG.map((entry) => entry.catalogKey));
const length = (text: string) => [...text].length;

describe("guides concis", () => {
  it("couvrent les 173 fiches, chacune rangée dans sa famille", () => {
    for (const entry of EXERCISE_CATALOG) {
      expect(CONCISE_BY_FAMILY[entry.guide.family][entry.catalogKey], entry.catalogKey).toBeDefined();
    }
    const written = Object.values(CONCISE_BY_FAMILY).flatMap((family) => Object.keys(family));
    expect(written).toHaveLength(EXERCISE_CATALOG.length);
    expect(written.filter((key) => !keys.has(key))).toEqual([]);
  });

  it("respectent les règles de longueur et gardent une ligne par position du geste", () => {
    const problems = EXERCISE_CATALOG.flatMap((entry) =>
      conciseProblems(entry.catalogKey, entry.guide, CONCISE_BY_FAMILY[entry.guide.family][entry.catalogKey]!, keys),
    );
    expect(problems).toEqual([]);
  });

  it("sont plus courts que le texte complet qu'ils résument", () => {
    for (const entry of EXERCISE_CATALOG) {
      const concise = conciseGuideFor(entry.catalogKey)!;
      const full = [entry.guide.objective, ...entry.guide.setup, ...entry.guide.steps, ...entry.guide.mistakes];
      const short = [concise.objective, concise.setup, ...concise.steps, ...concise.mistakes];
      const sum = (lines: string[]) => lines.reduce((total, line) => total + length(line), 0);
      expect(sum(short), entry.catalogKey).toBeLessThanOrEqual(Math.min(sum(full), CONCISE_RULES.total));
    }
  });

  it("se lisent dans le contrat, en relecture tant que la famille n'est pas validée", () => {
    for (const entry of EXERCISE_CATALOG) {
      const concise = conciseGuideFor(entry.catalogKey);
      expect(exerciseConciseGuide.safeParse(concise).success, entry.catalogKey).toBe(true);
      expect(concise!.review).toBe("review");
    }
    expect(conciseGuideFor("fiche-inconnue")).toBeNull();
  });

  it("refusent une étape trop longue, une fiche liée inconnue et un nombre d'étapes qui ne suit plus le geste", () => {
    const base = {
      objective: "Renforcer les jambes.",
      setup: "Pieds à largeur de hanches.",
      steps: ["Descends.", "Remonte."] as [string, string],
      mistakes: ["Talons décollés.", "Dos rond."] as [string, string],
      easier: "Squat sur banc.",
      easierKey: "squat-inexistant",
      harder: null,
    };
    const problems = conciseProblems(
      "back-squat",
      { steps: ["a", "b", "c"] },
      { ...base, setup: "x".repeat(81) },
      keys,
    );
    expect(problems.join("\n")).toMatch(/mise en place : 81 signes/);
    expect(problems.join("\n")).toMatch(/introuvable/);
    expect(problems.join("\n")).toMatch(/2 étapes pour 3 positions/);
  });

  it("ne s'appliquent qu'au texte du catalogue, pas à un guide réécrit par un coach", () => {
    const entry = EXERCISE_CATALOG[0]!;
    expect(guideMatchesCatalog(entry.guide)).toBe(true);
    expect(guideMatchesCatalog({ ...entry.guide, steps: [...entry.guide.steps, "Une étape du coach."] })).toBe(false);
  });
});
