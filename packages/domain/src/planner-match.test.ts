import { describe, expect, it } from "vitest";
import {
  plannerMatchShortlist,
  plannerMatchVerdict,
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
  it("ignore la ponctuation, les traits d'union, les barres obliques, et lit les petits nombres en lettres", () => {
    expect(plannerTermKey("talons fesses")).toBe(plannerTermKey("Talons-fesses"));
    expect(plannerTermKey("transitions 90 90")).toBe(plannerTermKey("Transitions 90/90"));
    expect(plannerTermKey("impulsions sur trois appuis")).toBe(plannerTermKey("Impulsions sur 3 appuis"));
    expect(plannerTermKey("sauts à la barre élan complet")).toBe(plannerTermKey("Sauts à la barre, élan complet"));
    expect(plannerTermKey("lancer de medecine ball vers l avant")).toBe(
      plannerTermKey("Lancer de médecine-ball vers l’avant"),
    );
  });
  it("retire un possessif ou une quantité de tête, mais garde un nom qui commence par deux nombres", () => {
    expect(plannerTermKey("ma routine épaules")).toBe(plannerTermKey("routine épaules"));
    expect(plannerTermKey("un peu de gainage")).toBe(plannerTermKey("gainage"));
    expect(plannerTermKey("10 pompes")).toBe(plannerTermKey("pompes"));
    expect(plannerTermKey("90/90 hip switches")).toBe("90 90 hip switche");
  });
});

describe("règles : noms composés et possessifs", () => {
  const fiches = [
    { token: "exercise_1", name: "Gammes : talons-fesses", aliases: [], family: "running" },
    { token: "exercise_2", name: "Mobilité des hanches", aliases: ["Transitions 90/90"], family: "mobility" },
    {
      token: "exercise_3",
      name: "Routine épaules du lundi",
      aliases: ["routine épaules"],
      family: "mobility",
      own: true,
    },
    { token: "exercise_4", name: "Bascule de hanches 90/90 à la kettlebell", aliases: [], family: "mobility" },
  ];
  it("retrouve le nom après les deux-points, l'alias sans barre oblique, l'alias cité avec un possessif", () => {
    const { matches, remaining } = plannerRuleMatches(
      [
        { id: "m1", said: "talons fesses" },
        { id: "m2", said: "transitions 90 90" },
        { id: "m3", said: "ma routine épaules" },
      ],
      fiches,
    );
    expect(remaining).toEqual([]);
    expect(matches).toMatchObject([
      { id: "m1", confidence: "exact", exerciseToken: "exercise_1" },
      { id: "m2", confidence: "exact", exerciseToken: "exercise_2" },
      { id: "m3", confidence: "exact", exerciseToken: "exercise_3" },
    ]);
  });
  it("le préfiltre garde une fiche qui ne partage qu'un nombre avec le terme", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      token: `exercise_${index + 10}`,
      name: `Fiche ${index}`,
      aliases: [],
      family: "strength",
    }));
    const kept = plannerMatchShortlist(["90/90"], [...many, ...fiches], 5);
    expect(kept.map((exercise) => exercise.token)).toEqual(expect.arrayContaining(["exercise_2", "exercise_4"]));
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
    const others = Array.from({ length: 50 }, (_, i) => ({
      token: `exercise_${700 + i}`,
      name: `Course ${i}`,
      aliases: [],
    }));
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

describe("confiance décidée par règle, à partir de la relation dite par le modèle", () => {
  const verdict = (candidates: { key: string; relation: "same_name" | "same_known" | "variant" | "neighbor" }[]) =>
    plannerMatchVerdict({ matches: [{ id: "m1", candidates, suggestion: null }] }).matches[0]!;
  const suggestion = { name: "Superman", category: "strength" as const, movement: "trunk" as const, loadKind: "bodyweight" as const };
  it("le nom, un alias ou leur traduction directe portent l'équivalence : sure", () => {
    expect(verdict([{ key: "f1", relation: "same_name" }, { key: "f2", relation: "neighbor" }])).toEqual({
      id: "m1",
      confidence: "sure",
      key: "f1",
      others: ["f2"],
      suggestion: null,
    });
  });
  it("seule la connaissance du modèle porte l'équivalence : jamais sure, toujours à vérifier", () => {
    expect(verdict([{ key: "f3", relation: "same_known" }])).toMatchObject({ confidence: "probable", key: "f3" });
  });
  it("le même geste à une précision de matériel, d'agrès ou de position près : probable, pas absent", () => {
    expect(verdict([{ key: "f4", relation: "variant" }, { key: "f5", relation: "neighbor" }])).toMatchObject({
      confidence: "probable",
      key: "f4",
      others: ["f5"],
      suggestion: null,
    });
  });
  it("deux fiches données pour le même mouvement : probable, l'autre proposée", () => {
    expect(verdict([{ key: "f1", relation: "same_name" }, { key: "f2", relation: "same_name" }])).toMatchObject({
      confidence: "probable",
      key: "f1",
      others: ["f2"],
    });
    expect(verdict([{ key: "f1", relation: "same_name" }, { key: "f6", relation: "same_known" }])).toMatchObject({
      confidence: "probable",
      key: "f1",
      others: ["f6"],
    });
  });
  it("la meilleure relation tranche, quel que soit l'ordre ; à relation égale, l'ordre du modèle vaut", () => {
    expect(
      verdict([
        { key: "f5", relation: "neighbor" },
        { key: "f4", relation: "variant" },
        { key: "f7", relation: "variant" },
        { key: "f4", relation: "neighbor" },
      ]),
    ).toMatchObject({ confidence: "probable", key: "f4", others: ["f7", "f5"] });
  });
  it("rien que des voisines, ou rien : absent, les voisines proposées et la fiche à créer gardée", () => {
    const answer = plannerMatchVerdict({
      matches: [
        { id: "m1", candidates: [{ key: "f5", relation: "neighbor" }], suggestion },
        { id: "m2", candidates: [], suggestion },
      ],
    }).matches;
    expect(answer[0]).toEqual({ id: "m1", confidence: "absent", key: null, others: ["f5"], suggestion });
    expect(answer[1]).toEqual({ id: "m2", confidence: "absent", key: null, others: [], suggestion });
  });
  it("une fiche choisie ne garde pas de fiche à créer", () => {
    const answer = plannerMatchVerdict({
      matches: [{ id: "m1", candidates: [{ key: "f4", relation: "variant" }], suggestion }],
    }).matches[0]!;
    expect(answer.suggestion).toBeNull();
  });
  it("les règles sans modèle passent avant : un nom exact n'atteint jamais le verdict", () => {
    const rules = plannerRuleMatches([{ id: "m1", said: "squat arrière" }], library);
    expect(rules.remaining).toEqual([]);
    expect(rules.matches[0]).toMatchObject({ confidence: "exact", source: "name" });
  });
});
