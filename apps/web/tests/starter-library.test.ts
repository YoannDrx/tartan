import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeOrg } from "./helpers";
import { listExercises, saveExercise } from "@/server/exercise.service";

it("copie une bibliothèque athlé modifiable et isole les choix de chaque espace", async () => {
  const first = await makeOrg("Bibliothèque");
  const original = await listExercises(first.owner.userId, first.organizationId);
  expect(original.length).toBeGreaterThanOrEqual(40);
  expect(original.some((exercise) => exercise.tags.includes("Endurance"))).toBe(true);
  const squat = original.find((exercise) => exercise.name === "Squat arrière")!;
  const pullups = original.find((exercise) => exercise.name === "Tractions")!;
  expect(squat.strengthLoadKind).toBe("external_total");
  expect(pullups.strengthLoadKind).toBe("bodyweight");
  await saveExercise(first.owner.userId, first.organizationId, {
    id: squat.id,
    name: "Squat adapté du coach",
    category: "strength",
    tags: ["Personnalisé"],
    cues: ["Amplitude définie avec l’athlète"],
    defaultPrescription: { sets: 2, reps: 8 },
    strengthLoadKind: "external_total",
  });
  const second = await makeOrg("Autre bibliothèque");
  const next = await listExercises(second.owner.userId, second.organizationId);
  expect(next.find((exercise) => exercise.name === "Squat arrière")?.id).not.toBe(squat.id);
  expect(next.some((exercise) => exercise.name === "Squat adapté du coach")).toBe(false);
  expect(await prisma.exercise.findUniqueOrThrow({ where: { id: squat.id } })).toMatchObject({
    name: "Squat adapté du coach",
    tags: ["Personnalisé"],
    defaultPrescription: { sets: 2, reps: 8 },
  });
  expect(await prisma.exerciseMedia.count({ where: { exercise: { organizationId: second.organizationId } } })).toBe(0);
});
