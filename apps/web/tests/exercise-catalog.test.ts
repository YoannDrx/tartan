import { exerciseInput } from "@tartan/contracts";
import { EXERCISE_CATALOG_VERSION } from "@tartan/domain/exercise-catalog";
import { expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { listExercises, saveExercise } from "@/server/exercise.service";
import { ensureExerciseCatalog } from "@/server/exercise-catalog.service";
import { buildSnapshot } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

it("distribue 233 fiches sans doublonner les 55 copies, même avec deux premières visites concurrentes", async () => {
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
  expect(list.filter((e) => e.guide)).toHaveLength(233);
  expect(list.filter((e) => e.shared && e.guide)).toHaveLength(178);
  expect(new Set(list.filter((e) => e.guide).map((e) => e.name)).size).toBe(233);
  expect(list.filter((e) => e.guide?.technicalReview === "approved")).toHaveLength(233);
  expect(list.filter((e) => e.guide?.technicalReview === "pending")).toHaveLength(0);
  expect(
    await prisma.exercise.findMany({ where: { organizationId: a.organizationId }, orderBy: { id: "asc" } }),
  ).toEqual(before);
});

it("rattache chaque ancienne copie à sa fiche commune, sans doublon, en gardant les personnalisations", async () => {
  const a = await makeOrg("CatalogueAncien");
  await prisma.exercise.updateMany({
    where: { organizationId: a.organizationId },
    data: { sourceCatalogKey: null, catalogVersion: null, guide: Prisma.DbNull },
  });
  const copies = await prisma.exercise.findMany({
    where: { organizationId: a.organizationId, classification: { not: Prisma.DbNull } },
    orderBy: { name: "asc" },
    take: 3,
  });
  const [changed, older, other] = [copies[0]!, copies[1]!, copies[2]!];
  await prisma.exercise.update({ where: { id: changed.id }, data: { cues: ["Consigne personnelle du coach"] } });
  // Copie d'un espace créé avant le 8 novembre : ni étiquettes, ni classification, ni type de charge.
  await prisma.exercise.update({
    where: { id: older.id },
    data: { tags: [], aliases: [], classification: Prisma.DbNull, strengthLoadKind: null },
  });
  // Reclassée par le coach comme un autre mouvement : elle garde son contenu, sans le guide.
  const movement = (other.classification as { movement: string }).movement === "carry" ? "squat" : "carry";
  await prisma.exercise.update({
    where: { id: other.id },
    data: { classification: { ...(other.classification as object), movement } },
  });
  const list = await listExercises(a.owner.userId, a.organizationId);
  expect(new Set(list.map((e) => e.name)).size).toBe(list.length);
  expect(list.filter((e) => e.guide)).toHaveLength(232);
  expect(list.find((e) => e.id === changed.id)).toMatchObject({
    cues: ["Consigne personnelle du coach"],
    shared: false,
  });
  expect(list.find((e) => e.id === changed.id)?.guide).not.toBeNull();
  const filled = await prisma.exercise.findUniqueOrThrow({ where: { id: older.id } });
  expect(filled.classification).not.toBeNull();
  expect(filled.tags.length).toBeGreaterThan(0);
  expect(list.find((e) => e.id === older.id)?.guide).not.toBeNull();
  expect(list.find((e) => e.id === other.id)).toMatchObject({ guide: null, shared: false });
  expect(
    await prisma.exercise.count({ where: { organizationId: a.organizationId, sourceCatalogKey: { not: null } } }),
  ).toBe(55);
});

it("fige le guide dans la séance, le garde au renommage et le détache quand le mouvement change", async () => {
  const a = await makeOrg("CatalogueHistorique");
  const entry = (await listExercises(a.owner.userId, a.organizationId)).find((e) => !e.shared)!;
  const snapshot = await buildSnapshot(a.organizationId, {
    title: "Guide figé",
    type: "strength",
    durationMin: null,
    coachNote: null,
    blocks: [{ name: "Force", variant: "club", items: [{ exerciseId: entry.id, prescription: { reps: 4 } }] }],
  });
  // La liste annote le geste animé et la version concise ; la séance garde le guide tel qu'enregistré.
  const { motion: _motion, photo: _photo, videos: _videos, ...illustration } = entry.guide!.illustration;
  const { concise: _concise, ...stored } = entry.guide!;
  expect(snapshot.blocks[0]!.items[0]!.guide).toEqual({ ...stored, illustration });
  await saveExercise(
    a.owner.userId,
    a.organizationId,
    exerciseInput.parse({ ...entry, media: null, name: "Mon mouvement adapté", cues: ["Une consigne différente"] }),
  );
  // Renommée, avec ses propres consignes, la copie décrit toujours le même geste : elle garde son guide.
  const renamed = (await listExercises(a.owner.userId, a.organizationId)).find((e) => e.id === entry.id)!;
  expect(renamed).toMatchObject({ name: "Mon mouvement adapté", cues: ["Une consigne différente"] });
  expect(renamed.guide?.catalogKey).toBe(entry.guide?.catalogKey);
  const other = entry.classification?.movement === "jump" ? "carry" : "jump";
  await saveExercise(
    a.owner.userId,
    a.organizationId,
    exerciseInput.parse({ ...renamed, media: null, classification: { ...entry.classification, movement: other } }),
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
  // La liste annote aussi la version concise ; une copie enregistrée ne la porte jamais.
  const { concise: _concise, ...stored } = entry.guide!;
  const { motion: _motion, photo: _photo, videos: _videos, ...illustration } = stored.illustration;
  const oldGuide = {
    ...stored,
    version: 1,
    technicalReview: "pending" as const,
    illustration: {
      ...illustration,
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
