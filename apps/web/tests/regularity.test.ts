import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { athleteRegularity, regularityOf } from "@/server/stats.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

const NOW = new Date("2030-06-12T10:00:00Z");

const publish = async (org: Awaited<ReturnType<typeof makeOrg>>, date: string) => {
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const saved = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date,
    startTime: "18:00",
    location: "Stade",
    publishAt: null,
    draft: {
      title: "Séance",
      type: "strength",
      durationMin: 60,
      coachNote: null,
      blocks: [{ name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3 } }] }],
    },
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
  });
  await publishRow(saved.id, org.owner.userId, new Date("2020-01-01T10:00:00Z"), { silent: true });
  return saved.id;
};

describe("série de régularité, lue en base", () => {
  it("compte les semaines rendues, excuse l'absence signalée, et s'arrête à la séance manquée", async () => {
    const org = await makeOrg("Série");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Yanis");
    const log = (sessionId: string) =>
      prisma.sessionLog.create({
        data: { scheduledSessionId: sessionId, athleteId: athlete.athleteId, status: "done", variantDone: "club" },
      });
    // Le mercredi 12 juin 2030 : semaines des 27 mai, 3 et 10 juin.
    await publish(org, "2030-05-21");
    await log(await publish(org, "2030-05-28"));
    const excused = await publish(org, "2030-06-04");
    await prisma.attendance.create({
      data: { scheduledSessionId: excused, athleteId: athlete.athleteId, status: "absent", source: "athlete" },
    });
    await log(await publish(org, "2030-06-05"));
    await log(await publish(org, "2030-06-10"));
    await publish(org, "2030-06-14");
    expect(await regularityOf(athlete.athleteId, NOW)).toEqual({ weeks: 3, planned: 2, validated: 1 });
  });

  it("un coach d'un autre espace ne lit pas la série", async () => {
    const org = await makeOrg("Série A");
    const other = await makeOrg("Série B");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Yanis");
    await expect(athleteRegularity(other.owner.userId, org.organizationId, athlete.athleteId)).rejects.toThrow();
    await expect(athleteRegularity(org.owner.userId, org.organizationId, athlete.athleteId)).resolves.toMatchObject({
      weeks: 0,
    });
  });
});
