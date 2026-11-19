import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getExerciseSheet,
  listExerciseIndex,
  personalizeExercise,
  saveExercise,
  searchExercises,
} from "@/server/exercise.service";
import {
  createExerciseList,
  deleteExerciseList,
  listExerciseLists,
  reorderExerciseLists,
  setFavorite,
  setListMembership,
  updateExerciseList,
} from "@/server/exercise-list.service";
import { ensureExerciseCatalog } from "@/server/exercise-catalog.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: { status?: number }) => error.status ?? 500,
  );

const prepare = async () => {
  const main = await makeOrg("Listes");
  const coach = await addStaff(main.organizationId, "Inès", "coach", [main.groupId]);
  const athlete = await addAthlete(main.organizationId, main.groupId, "Malo");
  const other = await makeOrg("Ailleurs");
  await ensureExerciseCatalog(main.owner.userId, main.organizationId);
  const common = await prisma.exercise.findFirstOrThrow({
    where: { organizationId: null, catalogKey: "goblet-squat" },
  });
  const own = await saveExercise(main.owner.userId, main.organizationId, {
    name: "Gainage maison",
    category: "strength",
  });
  return { main, owner: main.owner.userId, org: main.organizationId, coach: coach.userId, athlete, other, common, own };
};

describe("listes d'exercices du coach", () => {
  it("rangent fiches communes et fiches de l'espace, dans leur ordre", async () => {
    const w = await prepare();
    const { id } = await createExerciseList(w.owner, w.org, { name: "Hiver" });
    await setListMembership(w.owner, w.org, id, w.common.id, true);
    await setListMembership(w.owner, w.org, id, w.own.id, true);
    await setListMembership(w.owner, w.org, id, w.own.id, true);
    const [list] = await listExerciseLists(w.owner, w.org);
    expect(list).toMatchObject({
      name: "Hiver",
      mine: true,
      sharedWithCoaches: false,
      exerciseIds: [w.common.id, w.own.id],
    });
    const found = await searchExercises(w.owner, w.org, { filter: { kind: "list", listId: id } });
    expect(found.items.map((e) => e.id)).toEqual([w.common.id, w.own.id]);
    await setListMembership(w.owner, w.org, id, w.common.id, false);
    expect((await listExerciseLists(w.owner, w.org))[0]!.exerciseIds).toEqual([w.own.id]);
    // La fiche reste dans la bibliothèque.
    expect((await listExerciseIndex(w.owner, w.org)).some((e) => e.id === w.common.id)).toBe(true);
  });

  it("restent invisibles des autres coachs tant qu'elles sont privées", async () => {
    const w = await prepare();
    const { id } = await createExerciseList(w.owner, w.org, { name: "Privée" });
    await setListMembership(w.owner, w.org, id, w.own.id, true);
    expect(await listExerciseLists(w.coach, w.org)).toEqual([]);
    expect(await status(searchExercises(w.coach, w.org, { filter: { kind: "list", listId: id } }))).toBe(404);
    expect(await status(setListMembership(w.coach, w.org, id, w.common.id, true))).toBe(404);
    expect(await status(updateExerciseList(w.coach, w.org, id, { name: "Volée" }))).toBe(404);
    expect(await status(deleteExerciseList(w.coach, w.org, id))).toBe(404);
  });

  it("se lisent sans se modifier une fois partagées avec les coachs de l'espace", async () => {
    const w = await prepare();
    const { id } = await createExerciseList(w.owner, w.org, { name: "Partagée" });
    await setListMembership(w.owner, w.org, id, w.own.id, true);
    await updateExerciseList(w.owner, w.org, id, { sharedWithCoaches: true });
    const [seen] = await listExerciseLists(w.coach, w.org);
    expect(seen).toMatchObject({ id, mine: false, ownerName: "Listes Test", exerciseIds: [w.own.id] });
    const found = await searchExercises(w.coach, w.org, { filter: { kind: "list", listId: id } });
    expect(found.items.map((e) => e.id)).toEqual([w.own.id]);
    expect(await status(setListMembership(w.coach, w.org, id, w.common.id, true))).toBe(403);
    expect(await status(setListMembership(w.coach, w.org, id, w.own.id, false))).toBe(403);
    expect(await status(updateExerciseList(w.coach, w.org, id, { name: "Volée" }))).toBe(403);
    expect(await status(deleteExerciseList(w.coach, w.org, id))).toBe(403);
    expect(await status(saveExercise(w.coach, w.org, { name: "Intrus", category: "strength", listId: id }))).toBe(403);
    expect(await prisma.exercise.count({ where: { organizationId: w.org, name: "Intrus" } })).toBe(0);
    expect((await listExerciseLists(w.owner, w.org))[0]!.exerciseIds).toEqual([w.own.id]);
  });

  it("ne sont jamais lues par un athlète ni par un autre espace", async () => {
    const w = await prepare();
    const { id } = await createExerciseList(w.owner, w.org, { name: "Partagée" });
    await updateExerciseList(w.owner, w.org, id, { sharedWithCoaches: true });
    await setFavorite(w.owner, w.org, w.own.id, true);
    expect(await status(listExerciseLists(w.athlete.userId, w.org))).toBe(403);
    expect(await status(searchExercises(w.athlete.userId, w.org, { filter: { kind: "list", listId: id } }))).toBe(403);
    expect(await status(getExerciseSheet(w.athlete.userId, w.org, w.own.id))).toBe(403);
    const stranger = w.other.owner.userId;
    expect(await status(listExerciseLists(stranger, w.org))).toBe(403);
    expect(await listExerciseLists(stranger, w.other.organizationId)).toEqual([]);
    expect(
      await status(searchExercises(stranger, w.other.organizationId, { filter: { kind: "list", listId: id } })),
    ).toBe(404);
    expect(await status(setListMembership(stranger, w.other.organizationId, id, w.common.id, true))).toBe(404);
    // Une fiche de l'espace ne rejoint pas la liste d'un autre espace.
    const theirs = await createExerciseList(stranger, w.other.organizationId, { name: "Ailleurs" });
    expect(await status(setListMembership(stranger, w.other.organizationId, theirs.id, w.own.id, true))).toBe(404);
  });

  it("créent les Favoris à la première étoile, une seule fois même à deux étoiles simultanées", async () => {
    const w = await prepare();
    const { id: winter } = await createExerciseList(w.owner, w.org, { name: "Hiver" });
    await Promise.all([setFavorite(w.owner, w.org, w.own.id, true), setFavorite(w.owner, w.org, w.common.id, true)]);
    const lists = await listExerciseLists(w.owner, w.org);
    expect(lists.map((list) => [list.name, list.isFavorites])).toEqual([
      ["Favoris", true],
      ["Hiver", false],
    ]);
    expect(new Set(lists[0]!.exerciseIds)).toEqual(new Set([w.own.id, w.common.id]));
    expect((await getExerciseSheet(w.owner, w.org, w.own.id)).favorite).toBe(true);
    expect((await getExerciseSheet(w.coach, w.org, w.own.id)).favorite).toBe(false);
    await setFavorite(w.owner, w.org, w.own.id, false);
    expect((await listExerciseLists(w.owner, w.org))[0]!.exerciseIds).toEqual([w.common.id]);
    const favorites = lists[0]!.id;
    expect(await status(updateExerciseList(w.owner, w.org, favorites, { name: "Autre" }))).toBe(409);
    expect(await status(deleteExerciseList(w.owner, w.org, favorites))).toBe(409);
    await reorderExerciseLists(w.owner, w.org, { listIds: [winter, favorites] });
    expect((await listExerciseLists(w.owner, w.org)).map((list) => list.name)).toEqual(["Hiver", "Favoris"]);
    expect(await status(reorderExerciseLists(w.owner, w.org, { listIds: [winter] }))).toBe(400);
  });

  it("créent un exercice directement dans une liste", async () => {
    const w = await prepare();
    const { id } = await createExerciseList(w.coach, w.org, { name: "Plots" });
    const created = await saveExercise(w.coach, w.org, { name: "Slalom des plots", category: "cones", listId: id });
    expect((await listExerciseLists(w.coach, w.org))[0]!.exerciseIds).toEqual([created.id]);
    const sheet = await getExerciseSheet(w.coach, w.org, created.id);
    expect(sheet.listIds).toEqual([id]);
    expect(sheet.family).toBe("coordination");
  });
});

describe("fiches personnalisées", () => {
  it("copient la fiche commune avec son guide, et prennent sa place dans la bibliothèque et les listes", async () => {
    const w = await prepare();
    const { id: list } = await createExerciseList(w.owner, w.org, { name: "Force" });
    await setListMembership(w.owner, w.org, list, w.common.id, true);
    const copy = await personalizeExercise(w.owner, w.org, w.common.id);
    expect(copy.created).toBe(true);
    expect(await personalizeExercise(w.coach, w.org, w.common.id)).toEqual({ id: copy.id, created: false });
    const sheet = await getExerciseSheet(w.owner, w.org, copy.id);
    expect(sheet.shared).toBe(false);
    expect(sheet.guide?.catalogKey).toBe("goblet-squat");
    expect(sheet.guide?.concise?.steps).toHaveLength(3);
    expect(sheet.listIds).toEqual([list]);
    const index = await listExerciseIndex(w.owner, w.org);
    expect(index.filter((e) => e.name === w.common.name).map((e) => e.id)).toEqual([copy.id]);
    // Un autre espace garde la fiche commune.
    const elsewhere = await listExerciseIndex(w.other.owner.userId, w.other.organizationId);
    expect(elsewhere.some((e) => e.id === w.common.id)).toBe(true);
  });

  it("gardent le guide réécrit par le coach, même renommées, sans version concise", async () => {
    const w = await prepare();
    const copy = await personalizeExercise(w.owner, w.org, w.common.id);
    const base = await getExerciseSheet(w.owner, w.org, copy.id);
    const guide = {
      objective: "Des jambes solides pour le saut.",
      setup: "Barre sur les trapèzes, sécurités réglées.",
      steps: ["Sors du rack.", "Descends sous contrôle.", "Remonte vite.", "Repose la barre."],
      mistakes: ["Talons décollés."],
    };
    await saveExercise(w.owner, w.org, {
      id: copy.id,
      name: base.name,
      category: "strength",
      cues: base.cues,
      guideEdit: guide,
    });
    await saveExercise(w.owner, w.org, { id: copy.id, name: "Squat du club", category: "strength", cues: ["Gainé"] });
    const sheet = await getExerciseSheet(w.owner, w.org, copy.id);
    expect(sheet.name).toBe("Squat du club");
    expect(sheet.guide).toMatchObject({ author: "coach", steps: guide.steps, setup: [guide.setup] });
    expect(sheet.guide?.illustration.positions).toEqual([guide.setup, ...guide.steps]);
    expect(sheet.guide?.concise).toBeUndefined();
    // Une fiche sans guide d'origine n'en reçoit pas.
    expect(
      await status(
        saveExercise(w.owner, w.org, { id: w.own.id, name: "Gainage maison", category: "strength", guideEdit: guide }),
      ),
    ).toBe(400);
  });
});

describe("bibliothèque cherchée côté serveur", () => {
  it("range l'haltérophilie dans sa famille et pagine les résultats", async () => {
    const w = await prepare();
    const lifts = await searchExercises(w.owner, w.org, { filter: { kind: "family", family: "weightlifting" } });
    expect(lifts.total).toBe(20);
    const strength = await searchExercises(w.owner, w.org, {
      filter: { kind: "family", family: "strength" },
      limit: 100,
    });
    expect(strength.items.some((e) => e.motionKey === "snatch")).toBe(false);
    const page = await searchExercises(w.owner, w.org, { limit: 10, offset: 10 });
    expect(page.items).toHaveLength(10);
    expect(page.total).toBeGreaterThan(170);
    expect(page.items.every((e) => e.guide === null)).toBe(true);
    const clean = await searchExercises(w.owner, w.org, { q: "power clean" });
    expect(clean.items[0]?.motionKey).toBe("power-clean");
    const mine = await searchExercises(w.owner, w.org, { filter: { kind: "mine" } });
    expect(mine.items.every((e) => !e.shared)).toBe(true);
  });
});
