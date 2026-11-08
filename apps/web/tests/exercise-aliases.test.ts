import { expect, it } from "vitest";
import { makeOrg } from "./helpers";
import { prisma } from "@/lib/prisma";
import { saveExercise, listExercises } from "@/server/exercise.service";

it("conserve les alias des anciens clients et exige un effacement explicite autorisé", async () => {
  const a = await makeOrg("Alias");
  const input = { name: "Squat arrière alias", category: "strength" as const };
  const saved = await saveExercise(a.owner.userId, a.organizationId, {
    ...input,
    aliases: [" Back squat ", "BACK SQUAT", input.name],
  });
  const read = async () => (await listExercises(a.owner.userId, a.organizationId)).find((e) => e.id === saved.id);
  expect((await read())?.aliases).toEqual(["Back squat"]);
  await saveExercise(a.owner.userId, a.organizationId, { ...input, id: saved.id });
  expect((await read())?.aliases).toEqual(["Back squat"]);
  const other = await makeOrg("AliasAutre");
  await expect(
    saveExercise(other.owner.userId, other.organizationId, { ...input, id: saved.id, aliases: [] }),
  ).rejects.toMatchObject({ status: 404 });
  expect((await read())?.aliases).toEqual(["Back squat"]);
  await saveExercise(a.owner.userId, a.organizationId, { ...input, id: saved.id, aliases: [] });
  expect((await read())?.aliases).toEqual([]);
});

it("borne les alias et ne modifie pas les fiches historiques par rapprochement de nom", async () => {
  const a = await makeOrg("AliasBornes");
  const input = { name: "RDL", category: "strength" as const };
  for (const aliases of [[" "], ["a".repeat(121)], Array.from({ length: 21 }, (_, i) => `alias ${i}`)])
    await expect(saveExercise(a.owner.userId, a.organizationId, { ...input, aliases })).rejects.toThrow();
  const first = await saveExercise(a.owner.userId, a.organizationId, input);
  const second = await saveExercise(a.owner.userId, a.organizationId, { ...input, aliases: ["Romanian deadlift"] });
  expect((await prisma.exercise.findUniqueOrThrow({ where: { id: first.id } })).aliases).toEqual([]);
  expect((await prisma.exercise.findUniqueOrThrow({ where: { id: second.id } })).aliases).toEqual([
    "Romanian deadlift",
  ]);
});
