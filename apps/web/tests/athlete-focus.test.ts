import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAthleteToday } from "@/server/athlete-view.service";
import { setConsent } from "@/server/consent.service";
import { publishRow, saveScheduledSession, listTemplates } from "@/server/session.service";
import { linkVideoExercise, listVideos } from "@/server/video.service";
import { addAthlete, makeOrg, addStaff } from "./helpers";

const NOW = new Date("2030-06-12T10:00:00Z");

const prepare = async () => {
  const org = await makeOrg("Focus");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina", {
    joinedAt: new Date("2030-06-01T10:00:00Z"),
  });
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { organizationId: org.organizationId, name: "Squat arrière" },
  });
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: "2030-06-12",
    startTime: "18:00",
    location: "Stade",
    publishAt: null,
    draft: {
      title: "Force",
      type: "strength",
      durationMin: 60,
      coachNote: "Reste gainé",
      blocks: [
        { name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 5 } }] },
      ],
    },
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
  });
  await publishRow(session.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
  const video = await prisma.video.create({
    data: {
      id: randomUUID(),
      organizationId: org.organizationId,
      athleteId: athlete.athleteId,
      uploadedBy: org.owner.userId,
      status: "ready",
      sharedWithAthlete: true,
      annotations: { create: { authorId: org.owner.userId, tMs: 1200, text: "Pousse dans le sol" } },
    },
  });
  return { ...org, athlete, exercise, video };
};

describe("ce que l'athlète doit travailler", () => {
  it("rassemble la consigne, les points techniques et la dernière remarque vidéo", async () => {
    const a = await prepare();
    await linkVideoExercise(a.owner.userId, a.organizationId, a.video.id, a.exercise.id);
    const today = await getAthleteToday(a.athlete.userId, a.organizationId, NOW);
    expect(today.focus).toMatchObject({
      coachNote: "Reste gainé",
      video: { id: a.video.id, exerciseName: "Squat arrière", text: "Pousse dans le sol" },
    });
    expect(today.focus?.cues[0]?.exercise).toBe("Squat arrière");
  });

  it("ne présente comme conseil que la remarque d'un coach, jamais la sienne", async () => {
    const a = await prepare();
    await prisma.videoAnnotation.create({
      data: { videoId: a.video.id, authorId: a.athlete.userId, tMs: 2000, text: "J'avais mal dormi" },
    });
    const today = await getAthleteToday(a.athlete.userId, a.organizationId, NOW);
    expect(today.focus?.video?.text).toBe("Pousse dans le sol");
  });

  it("ne montre pas une vidéo non partagée ni après retrait de l'accord vidéo", async () => {
    const a = await prepare();
    await prisma.video.update({ where: { id: a.video.id }, data: { sharedWithAthlete: false } });
    expect((await getAthleteToday(a.athlete.userId, a.organizationId, NOW)).focus?.video).toBeNull();
    await prisma.video.update({ where: { id: a.video.id }, data: { sharedWithAthlete: true } });
    await setConsent(a.athlete.userId, "video", false, a.athlete.athleteId);
    expect((await getAthleteToday(a.athlete.userId, a.organizationId, NOW)).focus?.video).toBeNull();
  });
});

describe("lien vidéo et exercice", () => {
  it("filtre les vidéos par exercice", async () => {
    const a = await prepare();
    await linkVideoExercise(a.owner.userId, a.organizationId, a.video.id, a.exercise.id);
    const matching = await listVideos(a.owner.userId, a.organizationId, { exerciseId: a.exercise.id });
    expect(matching.map((v) => v.id)).toEqual([a.video.id]);
    expect(matching[0]?.exerciseName).toBe("Squat arrière");
    await linkVideoExercise(a.owner.userId, a.organizationId, a.video.id, null);
    expect(await listVideos(a.owner.userId, a.organizationId, { exerciseId: a.exercise.id })).toEqual([]);
  });

  it("refuse un exercice d'un autre espace", async () => {
    const a = await prepare();
    const other = await makeOrg("Ailleurs");
    const foreign = await prisma.exercise.findFirstOrThrow({ where: { organizationId: other.organizationId } });
    await expect(linkVideoExercise(a.owner.userId, a.organizationId, a.video.id, foreign.id)).rejects.toThrow();
  });

  it("refuse le lien à qui ne peut pas annoter cette vidéo", async () => {
    const a = await prepare();
    const outsider = await addStaff(a.organizationId, "Adjoint", "assistant", []);
    await expect(linkVideoExercise(outsider.userId, a.organizationId, a.video.id, a.exercise.id)).rejects.toThrow();
  });
});

describe("séances de départ", () => {
  it("sont disponibles dès la création de l'espace", async () => {
    const a = await makeOrg("Modeles");
    const templates = await listTemplates(a.owner.userId, a.organizationId);
    expect(templates.map((t) => t.title).sort()).toEqual([
      "Appuis sur plots",
      "Force bas du corps",
      "Pliométrie basse",
      "Technique de course",
    ]);
    expect(templates.every((t) => t.blocks.every((b) => b.items.length > 0))).toBe(true);
  });
});
