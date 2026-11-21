import { exerciseCategory, exerciseFamily } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "./exercise-catalog";
import {
  exerciseCategoryOfFamily,
  findExerciseByName,
  NEUTRAL_EXERCISE_DEFAULTS,
  significantExerciseWords,
  suggestExerciseDefaults,
} from "./exercise-defaults";
import { exerciseFamilyOf } from "./exercise-library";

const library = [
  { name: "Squat bulgare", aliases: ["Fente bulgare"], category: "strength", strengthLoadKind: "external_total" },
  { name: "Squat", aliases: ["Back squat"], category: "strength", strengthLoadKind: "external_total" },
  { name: "Tractions", category: "strength", strengthLoadKind: "bodyweight" },
  { name: "Gammes : montées de genoux", category: "running_drill", strengthLoadKind: null },
  { name: "Ouverture de hanche au sol", category: "mobility", strengthLoadKind: null },
];

describe("valeurs proposées pour une fiche créée par son nom", () => {
  it("ne garde que les mots qui portent le geste", () => {
    expect(significantExerciseWords("Montées de genoux sur 20 m")).toEqual(["montee", "genou"]);
    expect(significantExerciseWords("L'Épaulé-jeté")).toEqual(["epaule", "jete"]);
    expect(significantExerciseWords("  ")).toEqual([]);
  });

  it("reprend la famille et la charge de la fiche la plus proche", () => {
    expect(suggestExerciseDefaults("Squat bulgare pied surélevé", library)).toEqual({
      category: "strength",
      strengthLoadKind: "external_total",
      basis: { kind: "exercise", name: "Squat bulgare" },
    });
    expect(suggestExerciseDefaults("montée de genoux", library)).toMatchObject({
      category: "running_drill",
      strengthLoadKind: null,
      basis: { kind: "exercise", name: "Gammes : montées de genoux" },
    });
  });

  it("rapproche aussi par un autre nom de la fiche", () => {
    expect(suggestExerciseDefaults("Fente bulgare avant", library).basis).toEqual({
      kind: "exercise",
      name: "Squat bulgare",
    });
  });

  it("préfère, à égalité, la fiche qui partage le plus de mots", () => {
    // « Squat » et « Squat bulgare » ressemblent autant au nom : la seconde partage deux mots.
    expect(suggestExerciseDefaults("Squat bulgare sauté haltères", library).basis).toEqual({
      kind: "exercise",
      name: "Squat bulgare",
    });
  });

  it("suit la famille la plus représentée quand plusieurs fiches sont aussi proches", () => {
    const jumps = [
      { name: "Jumping jacks", aliases: ["Sauts écartés"], category: "warmup", strengthLoadKind: null },
      { name: "Saut sur boîte", category: "plyo", strengthLoadKind: null },
      { name: "Sauts en contrebas", category: "plyo", strengthLoadKind: null },
    ];
    // Un seul mot commun avec chacune : la fiche d'échauffement, première dans l'alphabet, ne décide pas seule.
    expect(suggestExerciseDefaults("Sauts de la liste", jumps)).toEqual({
      category: "plyo",
      strengthLoadKind: null,
      basis: { kind: "exercise", name: "Saut sur boîte" },
    });
    // À nombre égal, une fiche trouvée par son nom passe avant une fiche trouvée par un autre nom.
    expect(suggestExerciseDefaults("Sauts de la liste", jumps.slice(0, 2)).basis).toEqual({
      kind: "exercise",
      name: "Saut sur boîte",
    });
    expect(suggestExerciseDefaults("Sauts de la liste", EXERCISE_CATALOG)).toMatchObject({ category: "plyo" });
  });

  it("laisse un mot qui change le geste l'emporter sur la fiche proche", () => {
    expect(suggestExerciseDefaults("Squat sauté", library)).toEqual({
      category: "plyo",
      strengthLoadKind: null,
      basis: { kind: "exercise", name: "Squat" },
    });
    expect(suggestExerciseDefaults("Tractions lestées", library)).toMatchObject({
      category: "strength",
      strengthLoadKind: "added_weight",
    });
    expect(suggestExerciseDefaults("Tractions assistées", library)).toMatchObject({ strengthLoadKind: "assistance" });
  });

  it("n'hérite pas d'une fiche qui ne lui ressemble qu'un peu", () => {
    // Un seul mot commun sur cinq : le nom n'est pas une variante de cette fiche.
    expect(suggestExerciseDefaults("Rotation de hanche debout contre un mur", library).basis.kind).not.toBe("exercise");
  });

  it("se rabat sur les mots du métier quand aucune fiche n'est proche", () => {
    expect(suggestExerciseDefaults("Pompes diamant", [])).toEqual({
      category: "strength",
      strengthLoadKind: "bodyweight",
      basis: { kind: "keyword", word: "pompe" },
    });
    expect(suggestExerciseDefaults("Soulevé de terre roumain", [])).toMatchObject({
      category: "strength",
      strengthLoadKind: "external_total",
    });
    expect(suggestExerciseDefaults("Bondissements en côte", [])).toMatchObject({
      category: "plyo",
      strengthLoadKind: null,
    });
    expect(suggestExerciseDefaults("Saut en longueur, élan réduit", [])).toMatchObject({ category: "jump" });
    expect(suggestExerciseDefaults("Sprints lancés 30 m", [])).toMatchObject({ category: "running_drill" });
    expect(suggestExerciseDefaults("Montées d'escaliers", [])).toMatchObject({ category: "stairs" });
    expect(suggestExerciseDefaults("Appuis entre plots", [])).toMatchObject({ category: "cones" });
    expect(suggestExerciseDefaults("Étirement des ischios", [])).toMatchObject({ category: "mobility" });
    expect(suggestExerciseDefaults("Échauffement articulaire", [])).toMatchObject({ category: "warmup" });
  });

  it("classe un geste sauté en pliométrie, même sans fiche proche", () => {
    expect(suggestExerciseDefaults("Fentes sautées", [])).toMatchObject({ category: "plyo", strengthLoadKind: null });
  });

  it("garde un mot court entier : « dip » n'est pas « diplôme »", () => {
    expect(suggestExerciseDefaults("Dips", [])).toMatchObject({ strengthLoadKind: "bodyweight" });
    expect(suggestExerciseDefaults("Diplomate", [])).toEqual(NEUTRAL_EXERCISE_DEFAULTS);
  });

  it("propose un défaut neutre quand rien ne parle", () => {
    expect(suggestExerciseDefaults("Zorglub", library)).toEqual({
      category: "strength",
      strengthLoadKind: null,
      basis: { kind: "default" },
    });
    expect(suggestExerciseDefaults("", library)).toEqual(NEUTRAL_EXERCISE_DEFAULTS);
  });

  it("ignore une fiche dont la catégorie ou la charge n'est pas connue", () => {
    expect(suggestExerciseDefaults("Machin truc", [{ name: "Machin", category: "inconnue" }])).toEqual(
      NEUTRAL_EXERCISE_DEFAULTS,
    );
    expect(
      suggestExerciseDefaults("Machin truc", [{ name: "Machin", category: "strength", strengthLoadKind: "autre" }]),
    ).toMatchObject({ category: "strength", strengthLoadKind: null });
  });

  it("retrouve dans le catalogue la catégorie de ses propres fiches", () => {
    // Chaque fiche du catalogue, cherchée par son nom parmi les autres, garde une catégorie valide.
    for (const entry of EXERCISE_CATALOG) {
      const found = suggestExerciseDefaults(entry.name, EXERCISE_CATALOG);
      expect(exerciseCategory.options).toContain(found.category);
      expect(found).toMatchObject({ category: entry.category, basis: { kind: "exercise" } });
    }
  });

  it("reconnaît une fiche qui porte déjà ce nom, sans accents ni majuscules", () => {
    expect(findExerciseByName("  squat  BULGARE ", library)?.name).toBe("Squat bulgare");
    expect(findExerciseByName("Gammes : montees de genoux", library)?.name).toBe("Gammes : montées de genoux");
    expect(findExerciseByName("Squat bulgare lesté", library)).toBeNull();
    // Un autre nom d'une fiche n'est pas son nom.
    expect(findExerciseByName("Back squat", library)).toBeNull();
    expect(findExerciseByName("", library)).toBeNull();
  });

  it("donne à chaque famille une catégorie qui la retrouve", () => {
    for (const family of exerciseFamily.options) {
      const category = exerciseCategoryOfFamily(family);
      expect(exerciseCategory.options).toContain(category);
      // L'haltérophilie et le gainage se rangent en musculation : une fiche du coach n'a pas de guide.
      if (family !== "weightlifting" && family !== "core") expect(exerciseFamilyOf(null, category)).toBe(family);
    }
  });
});
