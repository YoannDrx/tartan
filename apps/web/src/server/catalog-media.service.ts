import type { CatalogVideo, ExerciseGuide } from "@tartan/contracts";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { m } from "@tartan/i18n";
import { AppError, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDirectUpload, signedPlayback, videoEnabled } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./admin.service";
import { enqueueExternalDeletion } from "./external-deletion.service";

// Les vidéos des fiches communes du catalogue. Le fondateur les dépose depuis la console : toute écriture passe par
// `requireAdmin`. Leur lecture est ouverte à tout membre qui ouvre une fiche : contenu commun, hors de tout espace,
// ce service ne lit et n'écrit que sa propre table (catalog_media). Il n'a aucune route : `catalogVideos` n'est
// appelé que par les services qui ont déjà vérifié le membre (bibliothèque, fiche, séance de l'athlète).

export const CATALOG_VIEWS = ["side", "front"] as const;
export type CatalogView = (typeof CATALOG_VIEWS)[number];

const known = (catalogKey: string) => EXERCISE_CATALOG.some((entry) => entry.catalogKey === catalogKey);

// L'état des vidéos, pour la console : la dernière par fiche et par vue.
export const listCatalogMedia = async (email: string) => {
  await requireAdmin(email);
  const rows = await prisma.catalogMedia.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, catalogKey: true, view: true, status: true, createdAt: true },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows)
    if (!latest.has(`${row.catalogKey}:${row.view}`)) latest.set(`${row.catalogKey}:${row.view}`, row);
  return [...latest.values()];
};

// Un envoi direct vers Mux, réservé au fondateur : le navigateur envoie le fichier, le webhook le rend lisible.
export const createCatalogVideoUpload = async (
  actor: { email: string; userId: string },
  catalogKey: string,
  view: CatalogView,
) => {
  await requireAdmin(actor.email);
  if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
  if (!known(catalogKey)) throw notFound();
  const media = await prisma.$transaction(async (tx) => {
    const row = await tx.catalogMedia.create({ data: { catalogKey, view, createdBy: actor.userId } });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "catalog_video_upload",
        entity: "catalog_media",
        metadata: { catalogKey, view },
      },
    });
    return row;
  });
  const upload = await createDirectUpload(`catalog:${media.id}`);
  await prisma.catalogMedia.update({ where: { id: media.id }, data: { muxUploadId: upload.uploadId } });
  return { mediaId: media.id, uploadUrl: upload.url };
};

// Retire la vidéo d'une fiche et d'une vue : la fiche revient au seul geste animé.
export const removeCatalogVideo = async (
  actor: { email: string; userId: string },
  catalogKey: string,
  view: CatalogView,
) => {
  await requireAdmin(actor.email);
  const rows = await prisma.catalogMedia.findMany({ where: { catalogKey, view } });
  if (rows.length === 0) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.catalogMedia.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    for (const row of rows)
      if (row.muxAssetId)
        await enqueueExternalDeletion(
          { provider: "mux_asset", ref: row.muxAssetId, reason: "catalog_video_removed" },
          tx,
        );
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "catalog_video_removed",
        entity: "catalog_media",
        metadata: { catalogKey, view },
      },
    });
  });
};

// Un envoi interrompu ne laisse pas la fiche « en cours d'envoi » pour toujours.
export const failCatalogUpload = async (uploadId: string) => {
  await prisma.catalogMedia.updateMany({
    where: { muxUploadId: uploadId, status: "uploading" },
    data: { status: "error" },
  });
};

// Mux prévient : la vidéo est prête, ou l'envoi a échoué. Une vidéo prête remplace les précédentes de la même vue.
export const applyCatalogMuxEvent = async (
  id: string,
  event: { type: string; data: { id: string; playback_ids?: { id: string }[] } },
): Promise<void> => {
  if (event.type === "video.asset.errored") {
    await prisma.catalogMedia.updateMany({ where: { id }, data: { status: "error" } });
    return;
  }
  if (event.type !== "video.asset.ready") return;
  const row = await prisma.catalogMedia.findUnique({ where: { id } });
  if (!row) {
    await enqueueExternalDeletion({ provider: "mux_asset", ref: event.data.id, reason: "late_webhook" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.catalogMedia.update({
      where: { id },
      data: { status: "ready", muxAssetId: event.data.id, muxPlaybackId: event.data.playback_ids?.[0]?.id ?? null },
    });
    const older = await tx.catalogMedia.findMany({
      where: { catalogKey: row.catalogKey, view: row.view, id: { not: id }, createdAt: { lte: row.createdAt } },
    });
    await tx.catalogMedia.deleteMany({ where: { id: { in: older.map((item) => item.id) } } });
    for (const item of older)
      if (item.muxAssetId)
        await enqueueExternalDeletion(
          { provider: "mux_asset", ref: item.muxAssetId, reason: "catalog_video_replaced" },
          tx,
        );
  });
};

// Les vidéos prêtes des fiches demandées, une par vue, profil d'abord. La lecture passe par un jeton signé ; sans clé
// de signature (un poste de développement), la vidéo est annoncée sans adresse de lecture.
export const catalogVideos = async (catalogKeys: readonly string[]): Promise<Map<string, CatalogVideo[]>> => {
  const keys = [...new Set(catalogKeys)];
  const result = new Map<string, CatalogVideo[]>();
  if (keys.length === 0) return result;
  const rows = await prisma.catalogMedia.findMany({
    where: { catalogKey: { in: keys }, status: "ready", muxPlaybackId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { catalogKey: true, view: true, muxPlaybackId: true },
  });
  const signing = Boolean(env().MUX_SIGNING_KEY_ID);
  for (const view of CATALOG_VIEWS)
    for (const key of keys) {
      const row = rows.find((item) => item.catalogKey === key && item.view === view);
      if (!row) continue;
      const stream = signing ? await signedPlayback(row.muxPlaybackId!) : null;
      result.set(key, [
        ...(result.get(key) ?? []),
        {
          view,
          streamUrl: stream?.mp4Url ?? null,
          hlsUrl: stream?.hlsUrl ?? null,
          posterUrl: stream?.thumbnailUrl ?? null,
        },
      ]);
    }
  return result;
};

// La fiche reçoit ses vidéos au moment de l'affichage, comme son geste animé : rien n'est enregistré dans le guide.
export const withCatalogVideos = <G extends ExerciseGuide | null | undefined>(
  guide: G,
  videos: ReadonlyMap<string, CatalogVideo[]>,
): G => {
  const found = guide ? videos.get(guide.catalogKey) : undefined;
  return guide && found?.length ? ({ ...guide, illustration: { ...guide.illustration, videos: found } } as G) : guide;
};
