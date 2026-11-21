import { describe, expect, it } from "vitest";
import { POST } from "../app/api/v1/orgs/[orgId]/exercises/quick/route";
import { prisma } from "@/lib/prisma";
import { ensureExerciseCatalog } from "@/server/exercise-catalog.service";
import { createExerciseList, listExerciseLists, setFavorite, setListMembership } from "@/server/exercise-list.service";
import {
  exerciseDefaultsFor,
  getExercise,
  personalizeExercise,
  quickCreateExercise,
  saveExercise,
  searchExercises,
} from "@/server/exercise.service";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: { status?: number }) => error.status ?? 500,
  );

const prepare = async () => {
  const main = await makeOrg("Rapide");
  const coach = await addStaff(main.organizationId, "Inès", "coach", [main.groupId]);
  const assistant = await addStaff(main.organizationId, "Awa", "assistant", [main.groupId]);
  const athlete = await addAthlete(main.organizationId, main.groupId, "Malo");
  const other = await makeOrg("Ailleurs");
  await ensureExerciseCatalog(main.owner.userId, main.organizationId);
  return {
    main,
    owner: main.owner.userId,
    org: main.organizationId,
    coach: coach.userId,
    assistant: assistant.userId,
    athlete,
    other,
  };
};

const rowsNamed = (organizationId: string, name: string) =>
  prisma.exercise.findMany({ where: { organizationId, name, deletedAt: null } });

describe("création rapide d'un exercice", () => {
  it("crée une fiche privée à l'espace par son seul nom, prête à entrer dans une séance", async () => {
    const w = await prepare();
    const result = await quickCreateExercise(w.owner, w.org, { name: "  Squat bulgare pied surélevé  " });
    expect(result).toMatchObject({
      created: true,
      exercise: {
        id: result.id,
        name: "Squat bulgare pied surélevé",
        shared: false,
        aliases: [],
        tags: [],
        cues: [],
        defaultPrescription: {},
        guide: null,
      },
    });
    const row = await prisma.exercise.findUniqueOrThrow({ where: { id: result.id } });
    expect(row).toMatchObject({ organizationId: w.org, createdBy: w.owner, catalogKey: null, sourceCatalogKey: null });
    // La fiche se retrouve aussitôt dans la bibliothèque, et pas dans celle d'un autre espace.
    expect((await searchExercises(w.owner, w.org, { q: "pied sureleve" })).items.map((e) => e.id)).toEqual([result.id]);
    expect((await searchExercises(w.other.owner.userId, w.other.organizationId, { q: "pied sureleve" })).total).toBe(0);
  });

  it("propose la famille et la charge de la fiche la plus proche, et les applique si rien n'est précisé", async () => {
    const w = await prepare();
    // Le catalogue porte « Fentes sautées » en pliométrie, sans charge.
    expect(await exerciseDefaultsFor(w.owner, w.org, "Fentes sautées lestées")).toMatchObject({
      category: "plyo",
      strengthLoadKind: "added_weight",
      basis: { kind: "exercise", name: "Fentes sautées" },
      existing: null,
    });
    const created = await quickCreateExercise(w.owner, w.org, { name: "Fentes sautées lestées" });
    expect(created.exercise).toMatchObject({
      category: "plyo",
      strengthLoadKind: "added_weight",
      family: "plyometrics",
    });
    // Une fiche de l'espace sert de modèle comme une fiche du catalogue.
    await saveExercise(w.owner, w.org, { name: "Zigzag maison", category: "cones" });
    expect(await exerciseDefaultsFor(w.owner, w.org, "Zigzag maison rapide")).toMatchObject({
      category: "cones",
      strengthLoadKind: null,
      basis: { kind: "exercise", name: "Zigzag maison" },
    });
    // Sans fiche proche : les mots du métier, puis le défaut neutre.
    expect(await exerciseDefaultsFor(w.owner, w.org, "Burpees")).toMatchObject({
      category: "strength",
      strengthLoadKind: "bodyweight",
      basis: { kind: "keyword" },
    });
    expect(await exerciseDefaultsFor(w.owner, w.org, "Zorglub")).toMatchObject({
      category: "strength",
      strengthLoadKind: null,
      basis: { kind: "default" },
    });
  });

  it("garde ce que le coach a choisi, charge retirée comprise", async () => {
    const w = await prepare();
    const chosen = await quickCreateExercise(w.owner, w.org, {
      name: "Fentes sautées lestées",
      category: "strength",
      strengthLoadKind: null,
    });
    expect(chosen.exercise).toMatchObject({ category: "strength", strengthLoadKind: null, family: "strength" });
    const loaded = await quickCreateExercise(w.owner, w.org, {
      name: "Zorglub",
      category: "mobility",
      strengthLoadKind: "assistance",
    });
    expect(loaded.exercise).toMatchObject({ category: "mobility", strengthLoadKind: "assistance" });
  });

  it("garde le terme cherché comme autre nom quand le nom retenu en diffère", async () => {
    const w = await prepare();
    const result = await quickCreateExercise(w.owner, w.org, {
      name: "Squat bulgare lesté",
      searchTerm: "  split squat  du samedi ",
    });
    expect(result.exercise.aliases).toEqual(["split squat du samedi"]);
    // La fiche se retrouve par ce qu'il cherchait.
    expect((await searchExercises(w.owner, w.org, { q: "Squat du SAMEDI" })).items.map((e) => e.id)).toEqual([
      result.id,
    ]);
  });

  it("n'ajoute pas d'autre nom inutile ou ambigu", async () => {
    const w = await prepare();
    // Le même terme, à la casse et aux accents près : rien à garder.
    const same = await quickCreateExercise(w.owner, w.org, { name: "Pompes diamant", searchTerm: "pompes DIAMANT" });
    expect(same.exercise.aliases).toEqual([]);
    // Un début de saisie que le nom contient déjà : la recherche le trouve sans autre nom.
    const partial = await quickCreateExercise(w.owner, w.org, {
      name: "Tirage menton câble",
      searchTerm: "tirage men",
    });
    expect(partial.exercise.aliases).toEqual([]);
    // Un terme qui est le nom ou un autre nom d'une fiche existante resterait ambigu.
    const common = await prisma.exercise.findFirstOrThrow({
      where: { organizationId: null, catalogKey: "goblet-squat" },
    });
    const taken = await quickCreateExercise(w.owner, w.org, {
      name: "Squat coupe tempo lent",
      searchTerm: common.name,
    });
    expect(taken.exercise.aliases).toEqual([]);
    const aliased = await quickCreateExercise(w.owner, w.org, {
      name: "Squat arrière surélevé lourd",
      searchTerm: "bulgarian split squat",
    });
    expect(aliased.exercise.aliases).toEqual([]);
    // Un début de saisie qui trouvait d'autres fiches n'est pas un nom : « gob » menait déjà au goblet squat.
    const fragment = await quickCreateExercise(w.owner, w.org, { name: "Fentes glissées", searchTerm: "gob" });
    expect(fragment.exercise.aliases).toEqual([]);
  });

  it("ne recrée pas une fiche qui porte déjà ce nom dans l'espace", async () => {
    const w = await prepare();
    const first = await quickCreateExercise(w.owner, w.org, { name: "Montée de corde" });
    const again = await quickCreateExercise(w.coach, w.org, {
      name: "  montee DE corde ",
      category: "mobility",
      searchTerm: "corde lisse",
    });
    expect(again).toMatchObject({ id: first.id, created: false, exercise: { name: "Montée de corde" } });
    expect(await rowsNamed(w.org, "Montée de corde")).toHaveLength(1);
    // La fiche existante n'est pas retouchée par la seconde demande.
    expect(again.exercise).toMatchObject({ category: first.exercise.category, aliases: [] });
    expect((await exerciseDefaultsFor(w.coach, w.org, "MONTÉE de corde")).existing).toMatchObject({ id: first.id });
  });

  it("propose la fiche du catalogue, ou sa copie dans l'espace, plutôt qu'un doublon", async () => {
    const w = await prepare();
    const common = await prisma.exercise.findFirstOrThrow({
      where: { organizationId: null, catalogKey: "goblet-squat" },
    });
    const reused = await quickCreateExercise(w.owner, w.org, { name: common.name.toUpperCase() });
    expect(reused).toMatchObject({ id: common.id, created: false, exercise: { shared: true } });
    expect(await prisma.exercise.count({ where: { organizationId: w.org, name: common.name } })).toBe(0);
    // Une fois personnalisée, c'est la copie de l'espace qui est rendue.
    const copy = await personalizeExercise(w.owner, w.org, common.id);
    const after = await quickCreateExercise(w.owner, w.org, { name: common.name });
    expect(after).toMatchObject({ id: copy.id, created: false, exercise: { shared: false } });
  });

  it("recrée une fiche supprimée, et laisse chaque espace avoir la sienne", async () => {
    const w = await prepare();
    const first = await quickCreateExercise(w.owner, w.org, { name: "Tirage corde" });
    await prisma.exercise.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    const second = await quickCreateExercise(w.owner, w.org, { name: "Tirage corde" });
    expect(second.created).toBe(true);
    expect(second.id).not.toBe(first.id);
    const elsewhere = await quickCreateExercise(w.other.owner.userId, w.other.organizationId, { name: "Tirage corde" });
    expect(elsewhere.created).toBe(true);
    expect(elsewhere.id).not.toBe(second.id);
  });

  it("ne crée qu'une fiche quand deux demandes du même nom arrivent ensemble", async () => {
    const w = await prepare();
    const results = await Promise.all([
      quickCreateExercise(w.owner, w.org, { name: "Tirage bûcheron unilatéral lourd" }),
      quickCreateExercise(w.coach, w.org, { name: "Tirage bûcheron unilatéral lourd" }),
      quickCreateExercise(w.assistant, w.org, { name: "tirage bucheron unilateral lourd" }),
    ]);
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await prisma.exercise.count({ where: { organizationId: w.org, name: { contains: "cheron" } } })).toBe(1);
  });

  it("range la fiche dans la liste du coach, créée ou retrouvée", async () => {
    const w = await prepare();
    const { id: listId } = await createExerciseList(w.coach, w.org, { name: "Hiver" });
    const created = await quickCreateExercise(w.coach, w.org, { name: "Traîneau poussé", listId });
    const again = await quickCreateExercise(w.coach, w.org, { name: "Traîneau poussé", listId });
    const common = await prisma.exercise.findFirstOrThrow({
      where: { organizationId: null, catalogKey: "goblet-squat" },
    });
    const reused = await quickCreateExercise(w.coach, w.org, { name: common.name, listId });
    expect(again.created).toBe(false);
    expect((await listExerciseLists(w.coach, w.org))[0]!.exerciseIds).toEqual([created.id, reused.id]);
    // La liste d'un autre coach ne se remplit pas : rien n'est créé non plus.
    expect(await status(quickCreateExercise(w.owner, w.org, { name: "Traîneau tiré", listId }))).toBe(404);
    expect(await rowsNamed(w.org, "Traîneau tiré")).toHaveLength(0);
  });

  it("est réservée à l'encadrement de l'espace", async () => {
    const w = await prepare();
    const guardian = await makeUser("Parent");
    await prisma.organizationMember.create({
      data: { organizationId: w.org, userId: guardian.userId, role: "guardian", status: "active" },
    });
    const left = await addStaff(w.org, "Ancien", "coach");
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: w.org, userId: left.userId } },
      data: { status: "suspended" },
    });
    for (const [who, expected] of [
      [w.owner, 200],
      [w.coach, 200],
      [w.assistant, 200],
      // Un athlète et un parent sont membres, sans le droit `editExercises`.
      [w.athlete.userId, 403],
      [guardian.userId, 403],
      // Un coach suspendu, et le propriétaire d'un autre espace.
      [left.userId, 403],
      [w.other.owner.userId, 403],
    ] as const) {
      expect(await status(quickCreateExercise(who, w.org, { name: `Fiche de ${who}` }))).toBe(expected);
      expect(await status(exerciseDefaultsFor(who, w.org, "Squat"))).toBe(expected);
      expect(await rowsNamed(w.org, `Fiche de ${who}`)).toHaveLength(expected === 200 ? 1 : 0);
    }
  });

  it("refuse un nom vide ou trop long, sans rien créer", async () => {
    const w = await prepare();
    const before = await prisma.exercise.count({ where: { organizationId: w.org } });
    await expect(quickCreateExercise(w.owner, w.org, { name: "   " })).rejects.toThrow();
    await expect(quickCreateExercise(w.owner, w.org, { name: "x".repeat(121) })).rejects.toThrow();
    expect(await prisma.exercise.count({ where: { organizationId: w.org } })).toBe(before);
  });

  it("laisse la fiche se compléter ensuite par le formulaire complet", async () => {
    const w = await prepare();
    const { id } = await quickCreateExercise(w.owner, w.org, { name: "Tirage menton", searchTerm: "upright row" });
    await saveExercise(w.owner, w.org, {
      id,
      name: "Tirage menton",
      category: "strength",
      cues: ["Coudes hauts"],
      defaultPrescription: { sets: 3, reps: 8 },
    });
    expect(await getExercise(w.owner, w.org, id)).toMatchObject({
      aliases: ["upright row"],
      cues: ["Coudes hauts"],
      defaultPrescription: { sets: 3, reps: 8 },
    });
  });
});

describe("recherche du sélecteur", () => {
  it("met d'abord les favoris puis les listes du coach, quand rien n'est cherché", async () => {
    const w = await prepare();
    const byKey = async (catalogKey: string) =>
      (await prisma.exercise.findFirstOrThrow({ where: { organizationId: null, catalogKey } })).id;
    const all = await searchExercises(w.coach, w.org, { limit: 100 });
    // Trois fiches loin dans l'ordre alphabétique.
    const [listed, favorite, both] = all.items.slice(-3).map((e) => e.id) as [string, string, string];
    const { id: listId } = await createExerciseList(w.coach, w.org, { name: "Hiver" });
    await setListMembership(w.coach, w.org, listId, listed, true);
    await setListMembership(w.coach, w.org, listId, both, true);
    await setFavorite(w.coach, w.org, favorite, true);
    await setFavorite(w.coach, w.org, both, true);
    const first = await searchExercises(w.coach, w.org, { ownFirst: true, limit: 5 });
    expect(first.items.slice(0, 3).map((e) => e.id)).toEqual([favorite, both, listed]);
    expect(first.total).toBe(all.total);
    // Le reste garde l'ordre alphabétique, sans doublon.
    const whole = await searchExercises(w.coach, w.org, { ownFirst: true, limit: 100 });
    expect(new Set(whole.items.map((e) => e.id)).size).toBe(whole.items.length);
    expect(whole.items.slice(3).map((e) => e.id)).toEqual(
      all.items.filter((e) => ![listed, favorite, both].includes(e.id)).map((e) => e.id),
    );
    // Un autre coach garde l'ordre de la bibliothèque : les listes sont à chacun.
    expect((await searchExercises(w.owner, w.org, { ownFirst: true, limit: 100 })).items.map((e) => e.id)).toEqual(
      all.items.map((e) => e.id),
    );
    // Une recherche, un filtre ou l'ancien appel ne changent pas d'ordre.
    const goblet = await byKey("goblet-squat");
    await setFavorite(w.coach, w.org, goblet, true);
    const searched = await searchExercises(w.coach, w.org, { q: "squat", ownFirst: true, limit: 100 });
    expect(searched.items.map((e) => e.id)).toEqual(
      (await searchExercises(w.coach, w.org, { q: "squat", limit: 100 })).items.map((e) => e.id),
    );
    expect((await searchExercises(w.coach, w.org, { limit: 100 })).items.map((e) => e.id)).toEqual(
      all.items.map((e) => e.id),
    );
  });
});

describe("POST /exercises/quick", () => {
  it("refuse sans session", async () => {
    const w = await prepare();
    const response = await POST(
      new Request(`http://localhost/api/v1/orgs/${w.org}/exercises/quick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Sans session" }),
      }),
      { params: Promise.resolve({ orgId: w.org }) },
    );
    expect(response.status).toBe(401);
    expect(await rowsNamed(w.org, "Sans session")).toHaveLength(0);
  });
});
