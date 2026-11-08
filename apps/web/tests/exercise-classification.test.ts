import { expect, it } from "vitest";
import { makeOrg, addAthlete } from "./helpers";
import { prisma } from "@/lib/prisma";
import { listExercises, saveExercise } from "@/server/exercise.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { getTrainingAnalysis } from "@/server/training-analysis.service";

it("préserve le classement avec un ancien client, le fige à la publication et refuse l’autre espace", async () => {
  const a = await makeOrg("Classement");
  await addAthlete(a.organizationId, a.groupId, "Ada");
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: true } });
  const input = {
    name: "Squat classé",
    category: "strength" as const,
    classification: { movement: "squat" as const, equipment: ["barbell" as const, "rack" as const] },
  };
  const e = await saveExercise(a.owner.userId, a.organizationId, input);
  await saveExercise(a.owner.userId, a.organizationId, { id: e.id, name: input.name, category: "strength" });
  expect(
    (await listExercises(a.owner.userId, a.organizationId)).find((row) => row.id === e.id)?.classification,
  ).toEqual(input.classification);
  const session = await saveScheduledSession(a.owner.userId, a.organizationId, {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    overrides: [],
    assignments: [{ targetType: "group", targetId: a.groupId }],
    draft: {
      title: "Force",
      type: "strength",
      durationMin: 40,
      coachNote: null,
      blocks: [{ name: "Force", variant: "club", items: [{ exerciseId: e.id, prescription: { sets: 3, reps: 4 } }] }],
    },
  });
  await publishRow(session.id, a.owner.userId, new Date(), { silent: true });
  await saveExercise(a.owner.userId, a.organizationId, {
    ...input,
    id: e.id,
    classification: { movement: "hinge", equipment: [] },
  });
  const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, { from: "2030-06-01", to: "2030-06-28" });
  expect(data.classification).toMatchObject({
    items: 1,
    movementKnownItems: 1,
    equipmentKnownItems: 1,
    movements: [{ key: "squat", plannedSets: 3 }],
  });
  expect(data.classification?.equipment.map((row) => row.key).sort()).toEqual(["barbell", "rack"]);
  await saveExercise(a.owner.userId, a.organizationId, { ...input, id: e.id, classification: null });
  expect(
    (await listExercises(a.owner.userId, a.organizationId)).find((row) => row.id === e.id)?.classification,
  ).toBeNull();
  const foreign = await makeOrg("AutreClassement");
  await expect(
    saveExercise(foreign.owner.userId, foreign.organizationId, { ...input, id: e.id }),
  ).rejects.toMatchObject({ status: 404 });
});

it("refuse les codes inconnus et doublons de matériel sans écrire", async () => {
  const a = await makeOrg("ClassementInvalide");
  for (const classification of [
    { movement: "invented", equipment: [] },
    { movement: "squat", equipment: ["barbell", "barbell"] },
  ]) {
    await expect(
      saveExercise(a.owner.userId, a.organizationId, {
        name: "Invalide",
        category: "strength",
        classification,
      } as never),
    ).rejects.toThrow();
  }
  expect(await prisma.exercise.count({ where: { organizationId: a.organizationId, name: "Invalide" } })).toBe(0);
});
