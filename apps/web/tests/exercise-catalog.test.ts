import { exerciseInput } from "@tartan/contracts";
import { EXERCISE_CATALOG_VERSION } from "@tartan/domain/exercise-catalog";
import { expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { listExercises, saveExercise } from "@/server/exercise.service";
import { ensureExerciseCatalog } from "@/server/exercise-catalog.service";
import { buildSnapshot } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

it("distribue 150 fiches sans doublonner les 55 copies, même avec deux premières visites concurrentes", async () => {
  const a = await makeOrg("Catalogue");
  const before = await prisma.exercise.findMany({
    where: { organizationId: a.organizationId },
    orderBy: { id: "asc" },
  });
  await Promise.all([
    ensureExerciseCatalog(a.owner.userId, a.organizationId),
    ensureExerciseCatalog(a.owner.userId, a.organizationId),
  ]);
  const list = await listExercises(a.owner.userId, a.organizationId);
  expect(list.filter((e) => e.guide)).toHaveLength(150);
  expect(list.filter((e) => e.shared && e.guide)).toHaveLength(95);
  expect(new Set(list.filter((e) => e.guide).map((e) => e.name)).size).toBe(150);
  expect(list.filter((e) => e.guide).every((e) => e.guide?.technicalReview === "approved")).toBe(true);
  expect(
    await prisma.exercise.findMany({ where: { organizationId: a.organizationId }, orderBy: { id: "asc" } }),
  ).toEqual(before);
});

it("rattache uniquement les anciennes copies intactes et préserve les personnalisations", async () => {
  const a = await makeOrg("CatalogueAncien");
  await prisma.exercise.updateMany({
    where: { organizationId: a.organizationId },
    data: { sourceCatalogKey: null, catalogVersion: null, guide: Prisma.DbNull },
  });
  const changed = await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.organizationId } });
  await prisma.exercise.update({ where: { id: changed.id }, data: { cues: ["Consigne personnelle du coach"] } });
  const list = await listExercises(a.owner.userId, a.organizationId);
  expect(list.filter((e) => e.guide)).toHaveLength(150);
  expect(list.find((e) => e.id === changed.id)).toMatchObject({ cues: ["Consigne personnelle du coach"], guide: null });
  expect(
    await prisma.exercise.count({ where: { organizationId: a.organizationId, sourceCatalogKey: { not: null } } }),
  ).toBe(54);
});

it("fige le guide dans la séance et détache celui d'un exercice privé modifié", async () => {
  const a = await makeOrg("CatalogueHistorique");
  const entry = (await listExercises(a.owner.userId, a.organizationId)).find((e) => !e.shared)!;
  const snapshot = await buildSnapshot(a.organizationId, {
    title: "Guide figé",
    type: "strength",
    durationMin: null,
    coachNote: null,
    blocks: [{ name: "Force", variant: "club", items: [{ exerciseId: entry.id, prescription: { reps: 4 } }] }],
  });
  expect(snapshot.blocks[0]!.items[0]!.guide).toEqual(entry.guide);
  await saveExercise(
    a.owner.userId,
    a.organizationId,
    exerciseInput.parse({ ...entry, media: null, name: "Mon mouvement adapté", cues: ["Une consigne différente"] }),
  );
  expect((await listExercises(a.owner.userId, a.organizationId)).find((e) => e.id === entry.id)?.guide).toBeNull();
  expect(snapshot.blocks[0]!.items[0]!.guide?.catalogKey).toBe(entry.guide?.catalogKey);
});

it("refuse l'initialisation aux athlètes, aux autres espaces et la modification du catalogue commun", async () => {
  const a = await makeOrg("CatalogueAcces");
  const athlete = await addAthlete(a.organizationId, a.groupId, "Lecteur");
  const b = await makeOrg("CatalogueEtranger");
  await expect(ensureExerciseCatalog(athlete.userId, a.organizationId)).rejects.toMatchObject({ status: 403 });
  await expect(ensureExerciseCatalog(b.owner.userId, a.organizationId)).rejects.toMatchObject({ status: 403 });
  const entry = (await listExercises(a.owner.userId, a.organizationId)).find((e) => e.shared && e.guide)!;
  await expect(
    saveExercise(a.owner.userId, a.organizationId, exerciseInput.parse({ ...entry, media: null, name: "Écrasement" })),
  ).rejects.toMatchObject({ status: 404 });
});

it("diffuse l'approbation aux copies existantes sans modifier prescriptions, personnalisations ou instantanés", async () => {
  const a = await makeOrg("CatalogueApprobation");
  const b = await makeOrg("CatalogueAutreEspace");
  const initial = await listExercises(a.owner.userId, a.organizationId);
  const entry = initial.find((e) => !e.shared && e.guide)!;
  const detached = initial.find((e) => !e.shared && e.guide && e.id !== entry.id)!;
  const oldGuide = {
    ...entry.guide!,
    version: 1,
    technicalReview: "pending" as const,
    illustration: {
      ...entry.guide!.illustration,
      path: entry.guide!.illustration.path.replace(`-v${EXERCISE_CATALOG_VERSION}.svg`, "-v1.svg"),
    },
  };
  await prisma.exercise.update({
    where: { id: entry.id },
    data: { catalogVersion: 1, guide: oldGuide, defaultPrescription: { reps: 8, sets: 4 }, loadStepKg: 2.5 },
  });
  await prisma.exercise.update({
    where: { id: detached.id },
    data: {
      catalogVersion: 1,
      guide: Prisma.DbNull,
      name: "Mon mouvement privé",
      cues: ["Personnalisation à conserver"],
    },
  });
  const before = await prisma.exercise.findUniqueOrThrow({ where: { id: entry.id } });
  const snapshot = await buildSnapshot(a.organizationId, {
    title: "Historique avant approbation",
    type: "strength",
    durationMin: null,
    coachNote: null,
    blocks: [{ name: "Force", variant: "club", items: [{ exerciseId: entry.id, prescription: { reps: 4 } }] }],
  });
  const foreignBefore = await prisma.exercise.findMany({
    where: { organizationId: b.organizationId },
    orderBy: { id: "asc" },
  });
  // The common catalogue is already up to date: old private copies still need this revision.
  await Promise.all([
    ensureExerciseCatalog(a.owner.userId, a.organizationId),
    ensureExerciseCatalog(a.owner.userId, a.organizationId),
  ]);
  const after = await prisma.exercise.findUniqueOrThrow({ where: { id: entry.id } });
  expect(after).toMatchObject({
    id: before.id,
    defaultPrescription: before.defaultPrescription,
    loadStepKg: before.loadStepKg,
    catalogVersion: EXERCISE_CATALOG_VERSION,
    guide: { technicalReview: "approved", illustration: { status: "draft" } },
  });
  expect(snapshot.blocks[0]!.items[0]!.guide).toEqual(oldGuide);
  expect(await prisma.exercise.findUniqueOrThrow({ where: { id: detached.id } })).toMatchObject({
    name: "Mon mouvement privé",
    cues: ["Personnalisation à conserver"],
    guide: null,
  });
  expect(
    await prisma.exercise.findMany({ where: { organizationId: b.organizationId }, orderBy: { id: "asc" } }),
  ).toEqual(foreignBefore);
  await ensureExerciseCatalog(a.owner.userId, a.organizationId);
  expect(await prisma.exercise.findUniqueOrThrow({ where: { id: entry.id } })).toEqual(after);
});
