import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addComment,
  adminResolveReport,
  blockUser,
  deleteComment,
  listAllReports,
  publishAnnouncement,
  reportContent,
  unblockUser,
} from "@/server/comm.service";
import { listVideos } from "@/server/video.service";
import { addAthlete, makeOrg } from "./helpers";

const prepare = async () => {
  const a = await makeOrg("Modération");
  const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
  return { a, athlete };
};
const admin = (email: string) => {
  process.env.ADMIN_EMAILS = email;
};

describe("modération", () => {
  it("un commentaire insultant est refusé, un texte normal passe", async () => {
    const { a, athlete } = await prepare();
    const thread = await prisma.video.create({
      data: { organizationId: a.organizationId, athleteId: athlete.athleteId, uploadedBy: a.owner.userId },
    });
    await expect(
      addComment(a.owner.userId, a.organizationId, { entityType: "video", entityId: thread.id, body: "Quel connard" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      publishAnnouncement(a.owner.userId, a.organizationId, { groupId: a.groupId, body: "Espèce de connard" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      addComment(a.owner.userId, a.organizationId, {
        entityType: "video",
        entityId: thread.id,
        body: "Belle impulsion",
      }),
    ).resolves.toBeTruthy();
  });
  it("l'auteur retire son commentaire, un autre non", async () => {
    const { a, athlete } = await prepare();
    const thread = await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: athlete.athleteId,
        uploadedBy: a.owner.userId,
        sharedWithAthlete: true,
      },
    });
    const created = await addComment(a.owner.userId, a.organizationId, {
      entityType: "video",
      entityId: thread.id,
      body: "Belle impulsion",
    });
    await expect(deleteComment(athlete.userId, a.organizationId, created.id)).rejects.toMatchObject({ status: 403 });
    await deleteComment(a.owner.userId, a.organizationId, created.id);
    expect(await prisma.comment.count({ where: { id: created.id } })).toBe(0);
  });
  it("une vidéo déposée par un utilisateur bloqué disparaît, et revient au déblocage", async () => {
    const { a, athlete } = await prepare();
    const video = await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: athlete.athleteId,
        uploadedBy: a.owner.userId,
        sharedWithAthlete: true,
        status: "ready",
      },
    });
    const seen = async () =>
      (await listVideos(athlete.userId, a.organizationId, {})).some((row) => row.id === video.id);
    expect(await seen()).toBe(true);
    await blockUser(athlete.userId, a.owner.userId);
    expect(await seen()).toBe(false);
    await unblockUser(athlete.userId, a.owner.userId);
    expect(await seen()).toBe(true);
  });
  it("l'éditeur traite un signalement depuis sa console, un autre compte non", async () => {
    const { a, athlete } = await prepare();
    const video = await prisma.video.create({
      data: { organizationId: a.organizationId, athleteId: athlete.athleteId, uploadedBy: a.owner.userId },
    });
    await reportContent(athlete.userId, a.organizationId, {
      entityType: "video",
      entityId: video.id,
      reason: "inappropriate",
    });
    const report = await prisma.contentReport.findFirstOrThrow({ where: { entityId: video.id } });
    await expect(listAllReports({ email: a.owner.email })).rejects.toMatchObject({ status: 403 });
    await expect(
      adminResolveReport({ userId: a.owner.userId, email: a.owner.email }, { id: report.id, removeContent: true }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.video.count({ where: { id: video.id } })).toBe(1);
  });
});
