import { expect, it } from "vitest";
import {
  PLANNER_CANDIDATES_MAX,
  PLANNER_CANDIDATES_MIN,
  rankPlannerCandidates,
  selectPlannerCandidates,
  type PlannerProposable,
} from "./planner-candidates";

const fiche = (i: number, patch = {}): PlannerProposable => ({
  token: `exercise_${i}`,
  family: "strength",
  level: "intermediate",
  equipment: [] as string[],
  approved: true,
  ...patch,
});
it("ne propose que des fiches relues ou du coach, dont tout le matériel est disponible", () => {
  const picked = selectPlannerCandidates(
    [
      fiche(1),
      fiche(2, { approved: false }),
      fiche(3, { approved: false, own: true }),
      fiche(4, { equipment: ["barbell"] }),
      fiche(5, { equipment: null }),
    ],
    { equipment: ["bodyweight"], families: [], level: null },
  );
  expect(picked.map((exercise) => exercise.token)).toEqual(["exercise_3", "exercise_1"]);
});
it("donne 20 à 40 fiches, favoris et listes du coach d'abord, familles visées puis échauffement", () => {
  const library = [
    ...Array.from({ length: 60 }, (_, i) => fiche(i + 1, { family: "core" })),
    ...Array.from({ length: 60 }, (_, i) => fiche(i + 101, { family: "plyometrics" })),
    ...Array.from({ length: 10 }, (_, i) => fiche(i + 201, { family: "warmup" })),
    ...Array.from({ length: 30 }, (_, i) => fiche(i + 301, { family: "running" })),
    fiche(400, { family: "core", preferred: 0 }),
  ];
  const picked = selectPlannerCandidates(library, {
    equipment: [],
    families: ["core", "plyometrics"],
    level: "intermediate",
  });
  expect(picked).toHaveLength(PLANNER_CANDIDATES_MAX);
  expect(picked[0]!.token).toBe("exercise_400");
  const families = picked.map((exercise) => exercise.family);
  // Aucune famille visée n'écrase l'autre ; quelques fiches d'échauffement accompagnent ; rien d'une famille non visée.
  expect(families.filter((family) => family === "core")).toHaveLength(17);
  expect(families.filter((family) => family === "plyometrics")).toHaveLength(17);
  expect(families.filter((family) => family === "warmup")).toHaveLength(6);
  expect(families).not.toContain("running");
});
it("reste au niveau demandé, et complète par les familles voisines sous 20 fiches", () => {
  const library = [
    ...Array.from({ length: 5 }, (_, i) => fiche(i + 1, { family: "mobility", level: "beginner" as const })),
    ...Array.from({ length: 5 }, (_, i) => fiche(i + 11, { family: "mobility", level: "advanced" as const })),
    ...Array.from({ length: 30 }, (_, i) => fiche(i + 21, { family: "core", level: "beginner" as const })),
  ];
  const picked = selectPlannerCandidates(library, { equipment: [], families: ["mobility"], level: "beginner" });
  expect(picked).toHaveLength(PLANNER_CANDIDATES_MIN);
  expect(picked.slice(0, 5).every((exercise) => exercise.family === "mobility")).toBe(true);
  expect(picked.every((exercise) => exercise.level === "beginner")).toBe(true);
});
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
