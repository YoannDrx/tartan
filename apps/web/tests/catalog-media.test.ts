import { createHmac } from "node:crypto";
import type { ExerciseGuide } from "@tartan/contracts";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/webhooks/mux/route";
import { env } from "@/lib/env";
import { createDirectUpload } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import {
  catalogVideos,
  createCatalogVideoUpload,
  listCatalogMedia,
  removeCatalogVideo,
  withCatalogVideos,
} from "@/server/catalog-media.service";
import { readExerciseGuide } from "@/server/exercise-catalog.service";
import { getExercise, listExercises } from "@/server/exercise.service";
import { makeOrg, makeUser } from "./helpers";

const SECRET = vi.hoisted(() => {
  process.env.MUX_TOKEN_ID = "test-token";
  process.env.MUX_TOKEN_SECRET = "test-secret";
  process.env.MUX_WEBHOOK_SECRET = "test-webhook-secret";
  return process.env.MUX_WEBHOOK_SECRET;
});

vi.mock("@/lib/mux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mux")>()),
  createDirectUpload: vi.fn(async (passthrough: string) => ({
    uploadId: `upload-${passthrough}`,
    url: `https://upload.mux.com/test/${passthrough}`,
  })),
}));

const KEY = "back-squat";
const deliver = (event: unknown) => {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");
  return POST(
    new Request("https://app.tartan.coach/api/webhooks/mux", {
      method: "POST",
      headers: { "mux-signature": `t=${timestamp},v1=${signature}` },
      body,
    }),
  );
};
const ready = (mediaId: string, asset: string) =>
  deliver({
    type: "video.asset.ready",
    data: { id: asset, status: "ready", passthrough: `catalog:${mediaId}`, playback_ids: [{ id: `play-${asset}` }] },
  });
const admin = async () => {
  const actor = await makeUser("Fondateur");
  env().ADMIN_EMAILS = actor.email;
  return actor;
};

beforeEach(async () => {
  await prisma.catalogMedia.deleteMany({ where: { catalogKey: KEY } });
});
afterEach(() => {
  env().ADMIN_EMAILS = "";
});

describe("vidéos des fiches communes du catalogue", () => {
  it("l'envoi est réservé au fondateur, pour une fiche qui existe, et passe par Mux avec sa propre étiquette", async () => {
    expect(EXERCISE_CATALOG.some((entry) => entry.catalogKey === KEY)).toBe(true);
    const coach = await makeUser("Coach");
    await expect(createCatalogVideoUpload(coach, KEY, "side")).rejects.toMatchObject({ status: 403 });
    await expect(listCatalogMedia(coach.email)).rejects.toMatchObject({ status: 403 });
    const actor = await admin();
    await expect(createCatalogVideoUpload(actor, "fiche-inconnue", "side")).rejects.toMatchObject({ status: 404 });
    const upload = await createCatalogVideoUpload(actor, KEY, "side");
    expect(createDirectUpload).toHaveBeenLastCalledWith(`catalog:${upload.mediaId}`);
    expect(upload.uploadUrl).toContain(upload.mediaId);
    const row = await prisma.catalogMedia.findUniqueOrThrow({ where: { id: upload.mediaId } });
    expect(row).toMatchObject({ catalogKey: KEY, view: "side", status: "uploading", createdBy: actor.userId });
    expect(await prisma.auditLog.count({ where: { actorId: actor.userId, action: "catalog_video_upload" } })).toBe(1);
    expect(await listCatalogMedia(actor.email)).toEqual([
      expect.objectContaining({ catalogKey: KEY, view: "side", status: "uploading" }),
    ]);
  });

  it("le webhook rend la vidéo prête ; un nouvel envoi prêt remplace l'ancien, dont la vidéo est effacée chez Mux", async () => {
    const actor = await admin();
    const first = await createCatalogVideoUpload(actor, KEY, "side");
    expect((await ready(first.mediaId, "asset-one")).status).toBe(200);
    expect(await prisma.catalogMedia.findUniqueOrThrow({ where: { id: first.mediaId } })).toMatchObject({
      status: "ready",
      muxAssetId: "asset-one",
      muxPlaybackId: "play-asset-one",
    });
    const second = await createCatalogVideoUpload(actor, KEY, "side");
    await ready(second.mediaId, "asset-two");
    expect(await prisma.catalogMedia.findMany({ where: { catalogKey: KEY } })).toEqual([
      expect.objectContaining({ id: second.mediaId, status: "ready" }),
    ]);
    expect(await prisma.externalDeletion.count({ where: { provider: "mux_asset", externalRef: "asset-one" } })).toBe(1);
    // Un envoi interrompu passe en échec ; une vidéo arrivée pour une ligne disparue est effacée.
    const third = await createCatalogVideoUpload(actor, KEY, "front");
    await deliver({ type: "video.upload.errored", data: { id: `upload-catalog:${third.mediaId}` } });
    expect((await prisma.catalogMedia.findUniqueOrThrow({ where: { id: third.mediaId } })).status).toBe("error");
    await prisma.catalogMedia.delete({ where: { id: third.mediaId } });
    await ready(third.mediaId, "asset-late");
    expect(await prisma.externalDeletion.count({ where: { provider: "mux_asset", externalRef: "asset-late" } })).toBe(
      1,
    );
  });

  it("la fiche reçoit ses vidéos à la lecture, profil d'abord, sans rien enregistrer dans le guide", async () => {
    const actor = await admin();
    const front = await createCatalogVideoUpload(actor, KEY, "front");
    await ready(front.mediaId, "asset-front");
    const side = await createCatalogVideoUpload(actor, KEY, "side");
    await ready(side.mediaId, "asset-side");
    const videos = await catalogVideos([KEY, KEY, "front-squat"]);
    // Sans clé de signature, la vidéo est annoncée sans adresse de lecture.
    expect(videos.get(KEY)).toEqual([
      { view: "side", streamUrl: null, hlsUrl: null, posterUrl: null },
      { view: "front", streamUrl: null, hlsUrl: null, posterUrl: null },
    ]);
    expect(videos.has("front-squat")).toBe(false);
    const entry = EXERCISE_CATALOG.find((item) => item.catalogKey === KEY)!;
    const guide = withCatalogVideos<ExerciseGuide | null>(readExerciseGuide(entry.guide), videos);
    expect(guide?.illustration.videos).toHaveLength(2);
    expect(readExerciseGuide(guide)?.illustration).not.toHaveProperty("videos");
    expect(withCatalogVideos(null, videos)).toBeNull();

    // Un coach qui ouvre la fiche commune la voit avec sa vidéo.
    const org = await makeOrg("Catalogue vidéo");
    const library = await listExercises(org.owner.userId, org.organizationId);
    const listed = library.find((item) => item.guide?.catalogKey === KEY)!;
    expect(listed.guide?.illustration.videos).toHaveLength(2);
    const exercise = await getExercise(org.owner.userId, org.organizationId, listed.id);
    expect(exercise.guide?.illustration.videos?.map((video) => video.view)).toEqual(["side", "front"]);
  });

  it("le fondateur retire une vidéo : la fiche revient au geste animé, la vidéo est effacée chez Mux", async () => {
    const actor = await admin();
    const upload = await createCatalogVideoUpload(actor, KEY, "side");
    await ready(upload.mediaId, "asset-removed");
    const coach = await makeUser("Coach");
    await expect(removeCatalogVideo(coach, KEY, "side")).rejects.toMatchObject({ status: 403 });
    await removeCatalogVideo(actor, KEY, "side");
    expect(await prisma.catalogMedia.count({ where: { catalogKey: KEY } })).toBe(0);
    expect(
      await prisma.externalDeletion.count({ where: { provider: "mux_asset", externalRef: "asset-removed" } }),
    ).toBe(1);
    expect((await catalogVideos([KEY])).has(KEY)).toBe(false);
    await expect(removeCatalogVideo(actor, KEY, "side")).rejects.toMatchObject({ status: 404 });
  });
});
