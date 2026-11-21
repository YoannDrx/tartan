import { describe, expect, it } from "vitest";
import {
  plannerMatchShortlist,
  plannerModelMatches,
  plannerRuleMatches,
  plannerSlotDefaults,
  plannerTermKey,
  PLANNER_MATCH_FULL_LIBRARY,
} from "./planner-match";

const library = [
  { token: "exercise_1", name: "Squat arrière", aliases: ["Back squat", "squat"], family: "strength" },
  { token: "exercise_2", name: "Squat avant", aliases: ["Front squat", "squat"], family: "strength" },
  { token: "exercise_3", name: "Fentes sautées", aliases: ["Split jumps"], family: "plyometrics" },
  { token: "exercise_4", name: "Gainage ventral", aliases: ["Planche"], family: "core" },
  { token: "exercise_5", name: "Planche", aliases: [], family: "core", own: true },
];

describe("clé d'un terme dit", () => {
  it("ignore la casse, les accents, le pluriel et le déterminant de tête", () => {
    expect(plannerTermKey("Les Fentes sautées")).toBe(plannerTermKey("fente sautée"));
    expect(plannerTermKey("du squat arrière")).toBe(plannerTermKey("Squat arriere"));
    expect(plannerTermKey("  ")).toBe("");
  });
});

describe("règles, avant tout modèle", () => {
  const movement = (id: string, said: string) => ({ id, said });
  it("retrouve un nom exact, puis un alias exact, sans appel", () => {
    const { matches, remaining } = plannerRuleMatches(
      [movement("m1", "squats arrière"), movement("m2", "split jumps"), movement("m3", "planche Copenhague")],
      library,
    );
    expect(matches).toMatchObject([
      { id: "m1", confidence: "exact", exerciseToken: "exercise_1", source: "name" },
      { id: "m2", confidence: "exact", exerciseToken: "exercise_3", source: "alias" },
    ]);
    // Un qualificatif qu'aucune fiche ne porte : ce terme part au modèle, il n'est pas rapproché par ressemblance.
    expect(remaining).toEqual([movement("m3", "planche Copenhague")]);
  });
  it("un alias appris de l'espace passe avant le nom et l'alias", () => {
    const { matches } = plannerRuleMatches([movement("m1", "squat")], library, [
      { term: "Squats", token: "exercise_2" },
      { term: "squat", token: "exercise_99" },
    ]);
    expect(matches).toMatchObject([{ confidence: "exact", exerciseToken: "exercise_2", source: "learned" }]);
  });
  it("un terme partagé par deux fiches est posé « probable », l'autre fiche proposée", () => {
    const { matches } = plannerRuleMatches([movement("m1", "squat")], library);
    expect(matches).toMatchObject([
      { confidence: "probable", exerciseToken: "exercise_1", alternatives: ["exercise_2"], source: "alias" },
    ]);
  });
  it("le nom d'une fiche l'emporte sur l'alias d'une autre, et la fiche de l'espace sur la fiche commune", () => {
    const { matches } = plannerRuleMatches([movement("m1", "planche")], library);
    expect(matches).toMatchObject([{ confidence: "exact", exerciseToken: "exercise_5", source: "name" }]);
  });
});

describe("préfiltre d'une grande bibliothèque", () => {
  const big = Array.from({ length: 700 }, (_, i) => ({
    token: `exercise_${i + 1}`,
    name: i % 70 === 0 ? `Réception caisson ${i}` : `Mouvement ${i}`,
    aliases: [] as string[],
    family: ["strength", "plyometrics", "core", "mobility"][i % 4]!,
  }));
  it("donne toute la bibliothèque jusqu'à 600 fiches", () => {
    expect(plannerMatchShortlist(["réception depuis un caisson"], big.slice(0, 600))).toHaveLength(600);
  });
  it("au-delà, n'écarte jamais une fiche qui partage un mot avec le terme", () => {
    const kept = plannerMatchShortlist(["réception depuis un caisson"], big);
    expect(kept).toHaveLength(PLANNER_MATCH_FULL_LIBRARY);
    const sharing = big.filter((exercise) => exercise.name.startsWith("Réception caisson"));
    expect(sharing).toHaveLength(10);
    expect(sharing.every((exercise) => kept.includes(exercise))).toBe(true);
  });
  it("garde toutes les fiches qui partagent un mot, même si elles dépassent la limite", () => {
    const sharing = Array.from({ length: 650 }, (_, i) => ({
      token: `exercise_${i + 1}`,
      name: `Squat variante ${i}`,
      aliases: [] as string[],
    }));
    const others = Array.from({ length: 50 }, (_, i) => ({ token: `exercise_${700 + i}`, name: `Course ${i}`, aliases: [] }));
    expect(plannerMatchShortlist(["squat"], [...sharing, ...others])).toHaveLength(650);
  });
});

describe("réponse du modèle, vérifiée", () => {
  const keys = new Map([
    ["f1", "exercise_1"],
    ["f2", "exercise_2"],
  ]);
  const movements = [
    { id: "m1", said: "squat barre sur le dos" },
    { id: "m2", said: "planche Copenhague" },
    { id: "m3", said: "saut du dragon" },
    { id: "m4", said: "oublié" },
  ];
  const matches = plannerModelMatches(
    movements,
    {
      matches: [
        { id: "m1", confidence: "sure", key: "f1", others: ["f1", "f2", "f9"], suggestion: null },
        {
          id: "m2",
          confidence: "absent",
          key: null,
          others: ["f2"],
          suggestion: { name: "planche copenhague", category: "strength", movement: "trunk", loadKind: "bodyweight" },
        },
        // Une clé inventée ne désigne aucune fiche : le terme reste absent.
        { id: "m3", confidence: "sure", key: "f404", others: [], suggestion: null },
      ],
    },
    keys,
  );
  it("garde la fiche choisie, sans la répéter ni inventer une autre fiche", () => {
    expect(matches[0]).toMatchObject({
      confidence: "sure",
      exerciseToken: "exercise_1",
      alternatives: ["exercise_2"],
      source: "model",
    });
  });
  it("un terme absent ne pose aucune fiche, garde les fiches voisines et de quoi créer la sienne", () => {
    expect(matches[1]).toMatchObject({
      confidence: "absent",
      exerciseToken: null,
      alternatives: ["exercise_2"],
      suggestion: { name: "Planche copenhague", category: "strength", movement: "trunk", loadKind: "bodyweight" },
    });
  });
  it("une clé inconnue ou un terme oublié valent absent, avec des valeurs prudentes", () => {
    expect(matches[2]).toMatchObject({ confidence: "absent", exerciseToken: null });
    expect(matches[3]).toMatchObject({
      confidence: "absent",
      suggestion: { name: "Oublié", category: "strength", movement: "other", loadKind: "bodyweight" },
    });
  });
  it("le nom proposé est le terme du coach nettoyé", () => {
    expect(plannerSlotDefaults(" , réception depuis un caisson. ", null).name).toBe("Réception depuis un caisson");
  });
});
