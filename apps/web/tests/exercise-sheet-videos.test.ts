import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getExercise } from "@/server/exercise.service";
import { linkVideoExercise, listVideos } from "@/server/video.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const makeExercise = (organizationId: string | null, name: string, deletedAt: Date | null = null) =>
  prisma.exercise.create({
    data: { organizationId, name, category: "plyo", cues: [], tags: [], defaultPrescription: {}, deletedAt },
  });

const makeVideo = (
  organizationId: string,
  athleteId: string,
  uploadedBy: string,
  exerciseId: string | null,
  sharedWithAthlete = false,
) =>
  prisma.video.create({
    data: { organizationId, athleteId, uploadedBy, exerciseId, status: "ready", sharedWithAthlete },
  });

const setting = async () => {
  const org = await makeOrg("Fiche");
  const lea = await addAthlete(org.organizationId, org.groupId, "Lea");
  const tom = await addAthlete(org.organizationId, org.groupId, "Tom");
  const exercise = await makeExercise(org.organizationId, "Bonds");
  const other = await makeExercise(org.organizationId, "Sprints");
  return { org, lea, tom, exercise, other };
};

describe("vidéos liées à une fiche d'exercice", () => {
  it("ne renvoie que les vidéos de ce mouvement au coach", async () => {
    const { org, lea, tom, exercise, other } = await setting();
    const first = await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, exercise.id);
    const second = await makeVideo(org.organizationId, tom.athleteId, org.owner.userId, exercise.id);
    await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, other.id);
    await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, null);
    const videos = await listVideos(org.owner.userId, org.organizationId, { exerciseId: exercise.id });
    expect(videos.map((video) => video.id).sort()).toEqual([first.id, second.id].sort());
    expect(videos.every((video) => video.exerciseId === exercise.id && video.exerciseName === "Bonds")).toBe(true);
  });

  it("ne montre jamais à un athlète la vidéo d'un autre, même partagée avec lui-même", async () => {
    const { org, lea, tom, exercise } = await setting();
    const shared = await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, exercise.id, true);
    await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, exercise.id, false);
    const forLea = await listVideos(lea.userId, org.organizationId, { exerciseId: exercise.id });
    expect(forLea.map((video) => video.id)).toEqual([shared.id]);
    expect(await listVideos(tom.userId, org.organizationId, { exerciseId: exercise.id })).toEqual([]);
  });

  it("limite un assistant aux athlètes de ses groupes", async () => {
    const { org, lea, exercise } = await setting();
    await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, exercise.id);
    const outside = await addStaff(org.organizationId, "Hors", "assistant", []);
    const inside = await addStaff(org.organizationId, "Dans", "assistant", [org.groupId]);
    expect(await listVideos(outside.userId, org.organizationId, { exerciseId: exercise.id })).toEqual([]);
    expect(await listVideos(inside.userId, org.organizationId, { exerciseId: exercise.id })).toHaveLength(1);
  });

  it("coupe l'image quand l'accord vidéo est retiré", async () => {
    const org = await makeOrg("Accord");
    const lea = await addAthlete(org.organizationId, org.groupId, "Lea", { video: false });
    const exercise = await makeExercise(org.organizationId, "Bonds");
    await prisma.video.create({
      data: {
        organizationId: org.organizationId,
        athleteId: lea.athleteId,
        uploadedBy: org.owner.userId,
        exerciseId: exercise.id,
        status: "ready",
        muxPlaybackId: "lecture-privee",
      },
    });
    const [video] = await listVideos(org.owner.userId, org.organizationId, { exerciseId: exercise.id });
    expect(video).toMatchObject({ consentRevoked: true, playbackId: null, thumbnailUrl: null });
  });

  it("ne traverse pas les espaces", async () => {
    const { org, lea, exercise } = await setting();
    await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, exercise.id);
    const elsewhere = await makeOrg("Ailleurs");
    expect(await listVideos(elsewhere.owner.userId, elsewhere.organizationId, { exerciseId: exercise.id })).toEqual([]);
  });
});

describe("fiche d'exercice", () => {
  it("ouvre un exercice de l'espace ou de la bibliothèque partagée", async () => {
    const { org, exercise } = await setting();
    const shared = await makeExercise(null, "Commun");
    expect(await getExercise(org.owner.userId, org.organizationId, exercise.id)).toMatchObject({
      id: exercise.id,
      shared: false,
    });
    expect(await getExercise(org.owner.userId, org.organizationId, shared.id)).toMatchObject({ shared: true });
    await prisma.exercise.delete({ where: { id: shared.id } });
  });

  it("refuse un exercice supprimé, d'un autre espace ou un athlète", async () => {
    const { org, lea, exercise } = await setting();
    const removed = await makeExercise(org.organizationId, "Retiré", new Date());
    const elsewhere = await makeOrg("Autre");
    await expect(getExercise(org.owner.userId, org.organizationId, removed.id)).rejects.toMatchObject({ status: 404 });
    await expect(getExercise(elsewhere.owner.userId, elsewhere.organizationId, exercise.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(getExercise(lea.userId, org.organizationId, exercise.id)).rejects.toMatchObject({ status: 403 });
  });

  it("limite le lien athlète aux exercices de sa séance attribuée", async () => {
    const { org, lea, exercise } = await setting();
    const video = await makeVideo(org.organizationId, lea.athleteId, org.owner.userId, null, true);
    await expect(linkVideoExercise(lea.userId, org.organizationId, video.id, exercise.id)).rejects.toMatchObject({
      status: 404,
    });
    const elsewhere = await makeOrg("Étranger");
    const foreign = await makeExercise(elsewhere.organizationId, "Étranger");
    await expect(linkVideoExercise(org.owner.userId, org.organizationId, video.id, foreign.id)).rejects.toMatchObject({
      status: 404,
    });
    await linkVideoExercise(org.owner.userId, org.organizationId, video.id, exercise.id);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).exerciseId).toBe(exercise.id);
    await linkVideoExercise(org.owner.userId, org.organizationId, video.id, null);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).exerciseId).toBeNull();
  });
});
