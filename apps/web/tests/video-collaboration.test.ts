import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createVideoUpload,
  renewVideoUpload,
  getVideo,
  listVideos,
  shareVideo,
  addAnnotation,
  deleteAnnotation,
  deleteVideo,
  applyMuxEvent,
} from "@/server/video.service";
import { createExerciseVideoUpload } from "@/server/exercise.service";
import { setAthleteConsent } from "@/server/consent.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const mux = vi.hoisted(() => ({
  calls: 0,
  uploads: new Map<string, { status: string; url: string; assetId: string | null }>(),
}));
vi.mock("@/lib/mux", async (original) => ({
  ...(await original<typeof import("@/lib/mux")>()),
  videoEnabled: () => true,
  createDirectUpload: async () => {
    mux.calls += 1;
    const id = randomUUID();
    const url = `https://upload.invalid/${id}`;
    mux.uploads.set(id, { url, status: "waiting", assetId: null });
    return { uploadId: id, url };
  },
  readDirectUpload: async (id: string) => mux.uploads.get(id) ?? null,
}));
vi.mock("@/server/platform-settings.service", async (original) => ({
  ...(await original<typeof import("@/server/platform-settings.service")>()),
  platformSettings: async () => ({
    muxVideoLimit: null,
    signupMode: "public",
    checkoutEnabled: true,
    gameLeaderboardEnabled: false,
  }),
}));

it("réserve une seule vidéo privée pour des confirmations concurrentes et déduit l'athlète", async () => {
  const org = await makeOrg("Collaboratif");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const peer = await addAthlete(org.organizationId, org.groupId, "Alex");
  const unrelated = await addStaff(org.organizationId, "Autre coach", "assistant");
  const clientId = randomUUID();
  const before = mux.calls;
  const responses = await Promise.all(
    Array.from({ length: 5 }, () => createVideoUpload(athlete.userId, org.organizationId, { clientId })),
  );
  expect(new Set(responses.map((r) => r.videoId)).size).toBe(1);
  expect(new Set(responses.map((r) => r.uploadUrl)).size).toBe(1);
  expect(mux.calls - before).toBe(1);
  const id = responses[0]!.videoId;
  expect(await getVideo(athlete.userId, org.organizationId, id)).toMatchObject({
    athleteId: athlete.athleteId,
    sharedWithAthlete: true,
    sharedWithGroup: false,
  });
  await expect(getVideo(org.owner.userId, org.organizationId, id)).resolves.toMatchObject({ id });
  await expect(getVideo(peer.userId, org.organizationId, id)).rejects.toMatchObject({ status: 404 });
  await expect(getVideo(unrelated.userId, org.organizationId, id)).rejects.toMatchObject({ status: 404 });
  await expect(
    createVideoUpload(athlete.userId, org.organizationId, { clientId, athleteId: peer.athleteId }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(createVideoUpload(athlete.userId, org.organizationId, { clientId, fps: 60 })).rejects.toMatchObject({
    code: "video_request_changed",
  });
  await expect(createVideoUpload(athlete.userId, org.organizationId, {})).rejects.toMatchObject({ status: 400 });
});

it("le même quota arbitre atomiquement les envois coach, athlète et démonstration", async () => {
  const org = await makeOrg("Quota commun");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  await prisma.entitlement.update({
    where: { organizationId_key: { organizationId: org.organizationId, key: "maxVideosPerMonth" } },
    data: { value: { limit: 1 } },
  });
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const results = await Promise.allSettled([
    createVideoUpload(athlete.userId, org.organizationId, { clientId: randomUUID() }),
    createVideoUpload(org.owner.userId, org.organizationId, { clientId: randomUUID(), athleteId: athlete.athleteId }),
    createExerciseVideoUpload(org.owner.userId, org.organizationId, exercise.id),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "plan_limit" });
  const videos = await prisma.video.count({ where: { organizationId: org.organizationId } });
  const media = await prisma.exerciseMedia.count({
    where: { exercise: { organizationId: org.organizationId }, kind: "upload" },
  });
  expect(videos + media).toBe(1);
});

it("le partage choisi est révoqué par le retrait du partage, du groupe, de l'espace ou du consentement", async () => {
  const org = await makeOrg("Partages");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const peer = await addAthlete(org.organizationId, org.groupId, "Alex");
  const outsider = await addAthlete(org.organizationId, null, "Autre");
  const { videoId } = await createVideoUpload(athlete.userId, org.organizationId, { clientId: randomUUID() });
  await expect(
    shareVideo(org.owner.userId, org.organizationId, videoId, {
      withAthlete: true,
      withGroup: true,
      groupIds: [org.groupId],
    }),
  ).rejects.toMatchObject({ status: 403 });
  const grant = () =>
    shareVideo(athlete.userId, org.organizationId, videoId, {
      withAthlete: true,
      withGroup: true,
      groupIds: [org.groupId],
    });
  await grant();
  expect((await listVideos(peer.userId, org.organizationId)).some((v) => v.id === videoId)).toBe(true);
  await expect(getVideo(outsider.userId, org.organizationId, videoId)).rejects.toMatchObject({ status: 404 });
  await shareVideo(athlete.userId, org.organizationId, videoId, { withAthlete: true, withGroup: false, groupIds: [] });
  await expect(getVideo(peer.userId, org.organizationId, videoId)).rejects.toMatchObject({ status: 404 });
  await grant();
  await prisma.groupMember.delete({
    where: { groupId_athleteId: { groupId: org.groupId, athleteId: athlete.athleteId } },
  });
  await expect(getVideo(peer.userId, org.organizationId, videoId)).rejects.toMatchObject({ status: 404 });
  await prisma.groupMember.create({ data: { groupId: org.groupId, athleteId: athlete.athleteId } });
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: org.organizationId, userId: athlete.userId } },
    data: { status: "suspended" },
  });
  await expect(getVideo(peer.userId, org.organizationId, videoId)).rejects.toMatchObject({ status: 404 });
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: org.organizationId, userId: athlete.userId } },
    data: { status: "active" },
  });
  await setAthleteConsent(athlete.userId, org.organizationId, "video", false);
  await expect(getVideo(peer.userId, org.organizationId, videoId)).rejects.toMatchObject({ status: 404 });
  await expect(getVideo(athlete.userId, org.organizationId, videoId)).resolves.toMatchObject({ id: videoId });
  await shareVideo(athlete.userId, org.organizationId, videoId, { withAthlete: true, withGroup: false, groupIds: [] });
  expect((await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).sharedGroupIds).toEqual([]);
});

it("un renouvellement invalide les anciens assets et des événements tardifs ne font pas reculer une vidéo prête", async () => {
  const org = await makeOrg("Webhooks");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const { videoId } = await createVideoUpload(athlete.userId, org.organizationId, { clientId: randomUUID() });
  const first = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  mux.uploads.get(first.muxUploadId!)!.status = "timed_out";
  await renewVideoUpload(athlete.userId, org.organizationId, videoId);
  const second = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  expect(second.uploadGeneration).toBe(2);
  await applyMuxEvent({
    type: "video.asset.ready",
    data: { id: "old-asset", passthrough: `video:${videoId}:1`, upload_id: first.muxUploadId!, duration: 2 },
  });
  expect(
    await prisma.externalDeletion.findUnique({
      where: { provider_externalRef: { provider: "mux_asset", externalRef: "old-asset" } },
    }),
  ).not.toBeNull();
  expect((await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).status).toBe("uploading");
  const data = {
    id: "new-asset",
    passthrough: `video:${videoId}:2`,
    upload_id: second.muxUploadId!,
    duration: 2,
    playback_ids: [{ id: "signed-playback" }],
  };
  await applyMuxEvent({ type: "video.asset.ready", data });
  await applyMuxEvent({ type: "video.asset.created", data });
  await applyMuxEvent({ type: "video.asset.errored", data });
  await applyMuxEvent({ type: "video.upload.errored", data: { id: second.muxUploadId! } });
  expect((await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).status).toBe("ready");
});

it("une réponse reste horodatée sur sa remarque, et un athlète ne supprime pas la remarque du coach", async () => {
  const org = await makeOrg("Remarques");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const { videoId } = await createVideoUpload(athlete.userId, org.organizationId, { clientId: randomUUID() });
  const root = await addAnnotation(org.owner.userId, org.organizationId, videoId, {
    tMs: 1200,
    text: "Repère technique",
  });
  const reply = await addAnnotation(athlete.userId, org.organizationId, videoId, {
    tMs: 0,
    parentId: root.id,
    text: "Compris",
  });
  expect(await prisma.videoAnnotation.findUnique({ where: { id: reply.id } })).toMatchObject({
    parentId: root.id,
    tMs: 1200,
  });
  await expect(deleteAnnotation(athlete.userId, org.organizationId, root.id)).rejects.toMatchObject({ status: 403 });
  await expect(
    addAnnotation(athlete.userId, org.organizationId, videoId, {
      tMs: 0,
      parentId: reply.id,
      text: "Troisième niveau",
    }),
  ).rejects.toMatchObject({ status: 404 });
  await deleteAnnotation(athlete.userId, org.organizationId, reply.id);
});

it("rattache seulement une séance publiée attribuée et un mouvement de cette séance", async () => {
  const { saveScheduledSession, publishRow } = await import("@/server/session.service");
  const org = await makeOrg("Contexte vidéo");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const other = await addAthlete(org.organizationId, null, "Autre");
  const [exercise, extra] = await prisma.exercise.findMany({ where: { organizationId: org.organizationId }, take: 2 });
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: "2030-06-12",
    publishAt: null,
    startTime: null,
    location: null,
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
    draft: {
      title: "Force",
      type: "strength",
      durationMin: 30,
      coachNote: null,
      blocks: [
        { name: "Force", variant: "club", items: [{ exerciseId: exercise!.id, prescription: { sets: 2, reps: 5 } }] },
      ],
    },
  });
  const input = { clientId: randomUUID(), scheduledSessionId: session.id, exerciseId: exercise!.id };
  await expect(createVideoUpload(athlete.userId, org.organizationId, input)).rejects.toMatchObject({ status: 404 });
  await publishRow(session.id, org.owner.userId, new Date(), { silent: true });
  await expect(createVideoUpload(other.userId, org.organizationId, input)).rejects.toMatchObject({ status: 404 });
  await expect(
    createVideoUpload(athlete.userId, org.organizationId, { ...input, exerciseId: extra!.id }),
  ).rejects.toMatchObject({ status: 404 });
  const accepted = await createVideoUpload(athlete.userId, org.organizationId, input);
  expect(await getVideo(athlete.userId, org.organizationId, accepted.videoId)).toMatchObject({
    scheduledSessionId: session.id,
    exerciseId: exercise!.id,
  });
  await prisma.assignment.deleteMany({ where: { scheduledSessionId: session.id } });
  const callsBeforeRenewal = mux.calls;
  await expect(renewVideoUpload(athlete.userId, org.organizationId, accepted.videoId)).rejects.toMatchObject({
    status: 404,
  });
  expect(mux.calls).toBe(callsBeforeRenewal);
  const outside = await makeOrg("Autre espace");
  await expect(createVideoUpload(outside.owner.userId, org.organizationId, input)).rejects.toMatchObject({
    status: 403,
  });
});

it("la pagination garde l'isolation même avec un curseur d'un autre espace", async () => {
  const { listVideoPage } = await import("@/server/video.service");
  const org = await makeOrg("Pagination");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const privatePeer = await addAthlete(org.organizationId, org.groupId, "Alex");
  await prisma.video.createMany({
    data: Array.from({ length: 45 }, () => ({
      organizationId: org.organizationId,
      athleteId: athlete.athleteId,
      uploadedBy: athlete.userId,
      sharedWithAthlete: true,
      status: "ready" as const,
    })),
  });
  await prisma.video.create({
    data: { organizationId: org.organizationId, athleteId: privatePeer.athleteId, uploadedBy: privatePeer.userId },
  });
  const first = await listVideoPage(athlete.userId, org.organizationId);
  const second = await listVideoPage(athlete.userId, org.organizationId, { cursor: first.nextCursor! });
  expect(first.videos).toHaveLength(40);
  expect(second.videos).toHaveLength(5);
  expect(new Set([...first.videos, ...second.videos].map((v) => v.id)).size).toBe(45);
  expect(second.nextCursor).toBeNull();
  expect([...first.videos, ...second.videos].every((v) => v.athleteId === athlete.athleteId)).toBe(true);
  const foreign = await makeOrg("Curseur étranger");
  const foreignAthlete = await addAthlete(foreign.organizationId, foreign.groupId, "Autre");
  const row = await prisma.video.create({
    data: {
      organizationId: foreign.organizationId,
      athleteId: foreignAthlete.athleteId,
      uploadedBy: foreign.owner.userId,
    },
  });
  const page = await listVideoPage(athlete.userId, org.organizationId, { cursor: row.id });
  expect(page.videos.every((v) => v.athleteId === athlete.athleteId)).toBe(true);
});

it("un camarade regarde la vidéo partagée sans lire ni écrire de remarque, et l'athlète n'efface pas une vidéo du coach", async () => {
  const org = await makeOrg("Camarades");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Lina");
  const peer = await addAthlete(org.organizationId, org.groupId, "Alex");
  const { videoId } = await createVideoUpload(athlete.userId, org.organizationId, { clientId: randomUUID() });
  await addAnnotation(org.owner.userId, org.organizationId, videoId, { tMs: 500, text: "Remarque du coach" });
  await addAnnotation(athlete.userId, org.organizationId, videoId, { tMs: 900, text: "Mon ressenti" });
  await shareVideo(athlete.userId, org.organizationId, videoId, {
    withAthlete: true,
    withGroup: true,
    groupIds: [org.groupId],
  });
  const seen = await getVideo(peer.userId, org.organizationId, videoId);
  expect(seen.annotations.map((a) => a.text)).toEqual(["Mon ressenti"]);
  expect(seen.canAnnotate).toBe(false);
  await expect(
    addAnnotation(peer.userId, org.organizationId, videoId, { tMs: 100, text: "Bravo" }),
  ).rejects.toMatchObject({ status: 403 });
  expect((await getVideo(athlete.userId, org.organizationId, videoId)).annotations).toHaveLength(2);

  const filmed = await createVideoUpload(org.owner.userId, org.organizationId, {
    clientId: randomUUID(),
    athleteId: athlete.athleteId,
  });
  await shareVideo(org.owner.userId, org.organizationId, filmed.videoId, {
    withAthlete: true,
    withGroup: false,
    groupIds: [],
  });
  await expect(deleteVideo(athlete.userId, org.organizationId, filmed.videoId)).rejects.toMatchObject({ status: 403 });
  await deleteVideo(athlete.userId, org.organizationId, videoId);
});
