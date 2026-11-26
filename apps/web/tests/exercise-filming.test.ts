import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listFilming, saveFilming } from "@/server/exercise-filming.service";
import { makeOrg, makeUser } from "./helpers";

it("deux coachs du club partagent le tournage et détectent une modification concurrente", async () => {
  const club = await makeOrg(),
    foreign = await makeOrg(),
    coach = await makeUser("Coach invité");
  await prisma.organizationMember.create({
    data: { organizationId: club.organizationId, userId: coach.userId, role: "coach" },
  });
  const exercise = await prisma.exercise.create({ data: { name: "Mouvement commun", category: "strength" } });
  const first = await saveFilming(club.owner.userId, club.organizationId, {
    exerciseId: exercise.id,
    filmed: false,
    comment: "Vue de profil",
    revision: 0,
  });
  expect(await listFilming(coach.userId, club.organizationId)).toContainEqual(first);
  expect(await listFilming(foreign.owner.userId, foreign.organizationId)).toEqual([]);
  const updated = await saveFilming(coach.userId, club.organizationId, { ...first, filmed: true });
  await expect(
    saveFilming(club.owner.userId, club.organizationId, { ...first, comment: "Autre angle" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await listFilming(club.owner.userId, club.organizationId, exercise.id)).toEqual([updated]);
});
