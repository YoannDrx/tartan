import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/webhooks/mux/route";
import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/mux";
import { reconcileStuckVideos } from "@/server/video.service";
import { addAthlete, makeOrg } from "./helpers";

const SECRET = vi.hoisted(() => {
  process.env.MUX_TOKEN_ID = "test-token";
  process.env.MUX_TOKEN_SECRET = "test-secret";
  process.env.MUX_WEBHOOK_SECRET = "test-webhook-secret";
  return process.env.MUX_WEBHOOK_SECRET;
});

vi.mock("@/lib/mux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mux")>()),
  readUpload: vi.fn(),
}));

const deliver = (event: unknown, secret: string = SECRET) => {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return POST(
    new Request("https://app.tartan.coach/api/webhooks/mux", {
      method: "POST",
      headers: { "mux-signature": `t=${timestamp},v1=${signature}` },
      body,
    }),
  );
};

const makeVideo = async () => {
  const org = await makeOrg("Webhook Mux");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Vidéo");
  return prisma.video.create({
    data: {
      organizationId: org.organizationId,
      athleteId: athlete.athleteId,
      uploadedBy: org.owner.userId,
      muxUploadId: `upload-${randomUUID()}`,
    },
  });
};

const statusOf = async (id: string) => (await prisma.video.findUniqueOrThrow({ where: { id } })).status;
const later = (ms: number) => new Date(Date.now() + ms);
const ready = {
  id: "asset-ready",
  status: "ready",
  duration: 5,
  playback_ids: [{ id: "playback-ready" }],
  tracks: [{ type: "video", max_frame_rate: 30 }],
};

describe("webhook Mux avec une vraie signature", () => {
  it("une vidéo signée passe à prête", async () => {
    const video = await makeVideo();
    const response = await deliver({
      type: "video.asset.ready",
      data: { ...ready, passthrough: `video:${video.id}` },
    });
    expect(response.status).toBe(200);
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: "ready",
      muxAssetId: "asset-ready",
      muxPlaybackId: "playback-ready",
      durationMs: 5000,
    });
  });

  it("un mauvais secret est refusé sans rien changer", async () => {
    const video = await makeVideo();
    const response = await deliver(
      { type: "video.asset.ready", data: { ...ready, passthrough: `video:${video.id}` } },
      "autre-secret",
    );
    expect(response.status).toBe(400);
    expect(await statusOf(video.id)).toBe("uploading");
  });

  it("une panne de traitement répond 500 pour que Mux réessaie", async () => {
    const spy = vi.spyOn(prisma.video, "count").mockRejectedValueOnce(new Error("base indisponible"));
    const response = await deliver({
      type: "video.asset.created",
      data: { id: "asset-panne", passthrough: `video:${randomUUID()}` },
    });
    spy.mockRestore();
    expect(response.status).toBe(500);
  });

  it("un « créé » reçu après « prêt » ne fait pas reculer la vidéo", async () => {
    const video = await makeVideo();
    const passthrough = `video:${video.id}`;
    await deliver({ type: "video.asset.ready", data: { ...ready, passthrough } });
    await deliver({ type: "video.asset.created", data: { id: "asset-ready", passthrough } });
    expect(await statusOf(video.id)).toBe("ready");
  });

  it("un envoi annulé passe en erreur", async () => {
    const video = await makeVideo();
    await deliver({ type: "video.upload.cancelled", data: { id: video.muxUploadId } });
    expect(await statusOf(video.id)).toBe("error");
  });
});

describe("rattrapage des vidéos restées en chemin", () => {
  const upload = vi.mocked(readUpload);
  beforeEach(() => upload.mockReset());

  it("répare une vidéo dont le webhook n'est jamais arrivé", async () => {
    const video = await makeVideo();
    upload.mockImplementation(async (id) =>
      id === video.muxUploadId ? { state: "asset", asset: ready } : { state: "waiting" },
    );
    await reconcileStuckVideos(later(11 * 60 * 1000));
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: "ready",
      muxPlaybackId: "playback-ready",
    });
  });

  it("laisse tranquille un envoi récent", async () => {
    const video = await makeVideo();
    upload.mockResolvedValue({ state: "asset", asset: ready });
    await reconcileStuckVideos(later(5 * 60 * 1000));
    expect(await statusOf(video.id)).toBe("uploading");
  });

  it("une adresse expirée reste renouvelable, puis abandonnée après 7 jours", async () => {
    const video = await makeVideo();
    upload.mockImplementation(async (id) => (id === video.muxUploadId ? { state: "expired" } : { state: "waiting" }));
    await reconcileStuckVideos(later(2 * 24 * 3600 * 1000));
    expect(await statusOf(video.id)).toBe("uploading");
    await reconcileStuckVideos(later(8 * 24 * 3600 * 1000));
    expect(await statusOf(video.id)).toBe("error");
  });

  it("une panne Mux sur une ligne n'arrête pas le lot", async () => {
    const [broken, fine] = [await makeVideo(), await makeVideo()];
    upload.mockImplementation(async (id) => {
      if (id === broken.muxUploadId) throw new Error("Mux indisponible");
      return id === fine.muxUploadId ? { state: "asset", asset: ready } : { state: "waiting" };
    });
    await reconcileStuckVideos(later(11 * 60 * 1000));
    expect(await statusOf(broken.id)).toBe("uploading");
    expect(await statusOf(fine.id)).toBe("ready");
  });
});
