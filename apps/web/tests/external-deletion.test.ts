import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/server/account.service";
import {
  enqueueExternalDeletion,
  processExternalDeletions,
  reconcileExternalAssets,
} from "@/server/external-deletion.service";
import { removeAthlete } from "@/server/members.service";
import { applyMuxEvent } from "@/server/video.service";
import { addAthlete, makeOrg } from "./helpers";

const mocks = vi.hoisted(() => ({
  deleteAsset: vi.fn(),
  cancelUpload: vi.fn(),
  listAssets: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/lib/mux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mux")>()),
  videoEnabled: () => true,
  deleteAsset: mocks.deleteAsset,
  cancelUpload: mocks.cancelUpload,
  listAssets: mocks.listAssets,
}));
vi.mock("@vercel/blob", () => ({ del: mocks.del, put: vi.fn() }));

const FAR = new Date("2035-01-01T00:00:00Z");
const pendingFor = (ref: string) => prisma.externalDeletion.findFirst({ where: { externalRef: ref } });
const asset = () => `asset-${randomUUID()}`;

const video = (organizationId: string, athleteId: string, uploadedBy: string, muxAssetId: string | null) =>
  prisma.video.create({ data: { organizationId, athleteId, uploadedBy, muxAssetId, status: "ready" } });

beforeEach(() => {
  mocks.deleteAsset.mockReset().mockResolvedValue(undefined);
  mocks.cancelUpload.mockReset().mockResolvedValue(undefined);
  mocks.del.mockReset().mockResolvedValue(undefined);
});

describe("toute suppression en base laisse une ligne de file", () => {
  it("suppression d'un athlète, de sa vidéo par cascade", async () => {
    const a = await makeOrg("File");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    const ref = asset();
    await video(a.organizationId, athlete.athleteId, a.owner.userId, ref);
    await removeAthlete(a.owner.userId, a.organizationId, athlete.athleteId);
    expect(await prisma.video.count({ where: { muxAssetId: ref } })).toBe(0);
    const row = await pendingFor(ref);
    expect(row).toMatchObject({ provider: "mux_asset" });
  });
  it("un compte supprimé, un espace disparu", async () => {
    const a = await makeOrg("Compte");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    const ref = asset();
    await video(a.organizationId, athlete.athleteId, a.owner.userId, ref);
    await deleteAccount(a.owner.userId);
    expect(await prisma.organization.count({ where: { id: a.organizationId } })).toBe(0);
    expect(await pendingFor(ref)).not.toBeNull();
  });
  it("un envoi sans fichier annule l'envoi chez Mux", async () => {
    const a = await makeOrg("Envoi");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    const upload = `upload-${randomUUID()}`;
    const row = await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: athlete.athleteId,
        uploadedBy: a.owner.userId,
        muxUploadId: upload,
        status: "uploading",
      },
    });
    await prisma.video.delete({ where: { id: row.id } });
    expect(await pendingFor(upload)).toMatchObject({ provider: "mux_upload" });
  });
  it("une démonstration d'exercice supprimée", async () => {
    const a = await makeOrg("Exercice");
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.organizationId } });
    const ref = asset();
    const media = await prisma.exerciseMedia.create({
      data: { exerciseId: exercise.id, kind: "upload", muxAssetId: ref },
    });
    await prisma.exerciseMedia.delete({ where: { id: media.id } });
    expect(await pendingFor(ref)).toMatchObject({ provider: "mux_asset" });
  });
  it("un avatar remplacé ou un profil supprimé, un logo remplacé ; une adresse tierce est ignorée", async () => {
    const a = await makeOrg("Avatar");
    const first = `https://abc.public.blob.vercel-storage.com/${randomUUID()}.png`;
    const second = `https://abc.public.blob.vercel-storage.com/${randomUUID()}.png`;
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { avatarUrl: first } });
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { avatarUrl: second } });
    expect(await pendingFor(first)).toMatchObject({ provider: "blob" });
    expect(await pendingFor(second)).toBeNull();
    const logo = `https://abc.public.blob.vercel-storage.com/${randomUUID()}.png`;
    await prisma.organization.update({ where: { id: a.organizationId }, data: { logoUrl: logo } });
    await prisma.organization.update({ where: { id: a.organizationId }, data: { logoUrl: null } });
    expect(await pendingFor(logo)).toMatchObject({ provider: "blob" });
    const other = "https://exemple.test/photo.png";
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { avatarUrl: other } });
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { avatarUrl: null } });
    expect(await pendingFor(other)).toBeNull();
  });
});

describe("traitement de la file", () => {
  const enqueue = async (ref = asset()) => {
    await enqueueExternalDeletion({ provider: "mux_asset", ref, reason: "test" });
    return ref;
  };
  it("efface chez le prestataire et clôt la ligne", async () => {
    const ref = await enqueue();
    await processExternalDeletions(FAR);
    expect(mocks.deleteAsset).toHaveBeenCalledWith(ref);
    expect(await pendingFor(ref)).toMatchObject({ state: "done" });
  });
  it("une préversion n'appelle aucun prestataire et laisse la ligne en file", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const ref = await enqueue();
    expect(await processExternalDeletions(FAR)).toBe(0);
    vi.unstubAllEnvs();
    expect(mocks.deleteAsset).not.toHaveBeenCalled();
    expect(await pendingFor(ref)).toMatchObject({ state: "pending" });
  });
  it("un 404 vaut réussite", async () => {
    const ref = await enqueue();
    mocks.deleteAsset.mockRejectedValueOnce(Object.assign(new Error("absent"), { status: 404 }));
    await processExternalDeletions(FAR);
    expect(await pendingFor(ref)).toMatchObject({ state: "done" });
  });
  it("une panne reprend plus tard, puis échoue au 14e essai", async () => {
    const ref = await enqueue();
    mocks.deleteAsset.mockRejectedValue(Object.assign(new Error("panne"), { status: 503 }));
    let at = FAR;
    await processExternalDeletions(at);
    let row = await pendingFor(ref);
    expect(row).toMatchObject({ state: "pending", attempts: 1, lastErrorCode: "http_503" });
    expect(row!.nextAttemptAt.getTime()).toBeGreaterThan(at.getTime());
    await processExternalDeletions(at);
    expect(mocks.deleteAsset).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 13; i += 1) {
      at = new Date(at.getTime() + 2 * 86_400_000);
      await processExternalDeletions(at);
    }
    row = await pendingFor(ref);
    expect(row).toMatchObject({ state: "failed", attempts: 14 });
  });
  it("deux exécutions concurrentes ne font qu'un appel", async () => {
    const ref = await enqueue();
    await Promise.all([processExternalDeletions(FAR), processExternalDeletions(FAR)]);
    expect(mocks.deleteAsset.mock.calls.filter(([id]) => id === ref)).toHaveLength(1);
  });
  it("une date différée est respectée", async () => {
    const ref = asset();
    await enqueueExternalDeletion({
      provider: "mux_asset",
      ref,
      reason: "test",
      notBefore: new Date(FAR.getTime() + 1000),
    });
    await processExternalDeletions(FAR);
    expect(mocks.deleteAsset).not.toHaveBeenCalledWith(ref);
  });
});

describe("webhook tardif", () => {
  it("un fichier créé après la suppression de sa vidéo part en file", async () => {
    const ref = asset();
    await applyMuxEvent({
      type: "video.asset.ready",
      data: { id: ref, passthrough: `video:${randomUUID()}`, playback_ids: [], tracks: [] },
    });
    expect(await pendingFor(ref)).toMatchObject({ provider: "mux_asset", reason: "late_webhook" });
  });
});

describe("rapprochement", () => {
  const list = (rows: { id: string; passthrough: string | null; createdAt: Date }[]) =>
    mocks.listAssets.mockReturnValue(
      (async function* () {
        yield* rows;
      })(),
    );
  it("un fichier sans passthrough reconnu est conservé, un orphelin n'est mis en file qu'après validation", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const old = new Date("2030-01-01T00:00:00Z");
    const orphan = asset();
    const unknown = asset();
    const recent = asset();
    const rows = [
      { id: orphan, passthrough: `video:${randomUUID()}`, createdAt: old },
      { id: unknown, passthrough: null, createdAt: old },
      { id: recent, passthrough: `video:${randomUUID()}`, createdAt: new Date(FAR.getTime() - 1000) },
    ];
    list(rows);
    expect(await reconcileExternalAssets(FAR)).toEqual({ orphans: 1, unknown: 1, enqueued: 0 });
    expect(await pendingFor(orphan)).toBeNull();
    vi.stubEnv("RECONCILE_APPLY", "true");
    list(rows);
    expect(await reconcileExternalAssets(FAR)).toEqual({ orphans: 1, unknown: 1, enqueued: 1 });
    expect(await pendingFor(orphan)).toMatchObject({ reason: "reconcile_orphan" });
    expect(await pendingFor(unknown)).toBeNull();
    expect(await pendingFor(recent)).toBeNull();
    vi.unstubAllEnvs();
  });
  it("hors production, rien", async () => {
    expect(await reconcileExternalAssets(FAR)).toEqual({ orphans: 0, unknown: 0, enqueued: 0 });
  });
});
