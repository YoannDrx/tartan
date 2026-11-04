import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateProfile } from "@/server/me.service";
import { addPerformance } from "@/server/athlete.service";
import { saveTemplate } from "@/server/session.service";
import { addJumpAttempt } from "@/server/video.service";
import { profileInput } from "@tartan/contracts";
import { addAthlete, makeOrg } from "./helpers";

const prepare = async () => {
  const mine = await makeOrg("Mien");
  const other = await makeOrg("Autre");
  const athlete = await addAthlete(mine.organizationId, mine.groupId, "Léa");
  const competition = await prisma.competition.create({
    data: { organizationId: other.organizationId, name: "Ailleurs", date: new Date("2030-06-22T00:00:00Z") },
  });
  return { mine, other, athlete, competition };
};

describe("références d'un autre espace", () => {
  it("un saut ne peut pas pointer vers la compétition d'un autre espace", async () => {
    const a = await prepare();
    await expect(
      addJumpAttempt(a.mine.owner.userId, a.mine.organizationId, {
        athleteId: a.athlete.athleteId,
        competitionId: a.competition.id,
        barHeightCm: 180,
        attemptNo: 1,
        result: "O",
      }),
    ).rejects.toThrow();
    expect(await prisma.jumpAttempt.count({ where: { athleteId: a.athlete.athleteId } })).toBe(0);
  });
  it("une performance non plus", async () => {
    const a = await prepare();
    await expect(
      addPerformance(a.mine.owner.userId, a.mine.organizationId, {
        athleteId: a.athlete.athleteId,
        discipline: "high_jump",
        mark: 1.8,
        unit: "m",
        date: "2030-06-22",
        competitionId: a.competition.id,
      }),
    ).rejects.toThrow();
  });
  it("un modèle refuse l'exercice privé d'un autre espace", async () => {
    const a = await prepare();
    const foreign = await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.other.organizationId } });
    await expect(
      saveTemplate(a.mine.owner.userId, a.mine.organizationId, {
        title: "Modèle",
        type: "strength",
        durationMin: 60,
        coachNote: null,
        blocks: [{ name: "Corps", variant: "club", items: [{ exerciseId: foreign.id, prescription: { sets: 3 } }] }],
      }),
    ).rejects.toThrow();
  });
  it("une photo de profil vient du stockage de Tartan", async () => {
    const base = { firstName: "Léa", lastName: "Test" };
    expect(profileInput.safeParse({ ...base, avatarUrl: "https://espion.example/p.png" }).success).toBe(false);
    expect(
      profileInput.safeParse({ ...base, avatarUrl: "https://abc.public.blob.vercel-storage.com/a.png" }).success,
    ).toBe(true);
    expect(typeof updateProfile).toBe("function");
  });
});
