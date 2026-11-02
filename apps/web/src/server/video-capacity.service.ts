import { m } from "@tartan/i18n";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// Une adresse d'envoi Mux vit 24 h : au-delà, un envoi jamais arrivé n'occupe plus de place.
const UPLOAD_ADDRESS_MS = 24 * 60 * 60 * 1000;

// Offre gratuite de Mux : un nombre de vidéos stockées, tous espaces confondus. Sans MUX_VIDEO_LIMIT, aucun plafond.
export const videoCapacity = async (now = new Date()): Promise<{ used: number; limit: number } | null> => {
  const limit = Number(env().MUX_VIDEO_LIMIT);
  if (!limit) return null;
  const inFlight = { muxAssetId: null, createdAt: { gte: new Date(now.getTime() - UPLOAD_ADDRESS_MS) } };
  const [videos, media] = await Promise.all([
    prisma.video.count({ where: { OR: [{ muxAssetId: { not: null } }, inFlight] } }),
    prisma.exerciseMedia.count({ where: { kind: "upload", OR: [{ muxAssetId: { not: null } }, inFlight] } }),
  ]);
  return { used: videos + media, limit };
};

export const assertVideoCapacity = async (): Promise<void> => {
  const capacity = await videoCapacity();
  if (capacity && capacity.used >= capacity.limit) {
    throw new AppError(409, "video_storage_full", m.errors.videoStorageFull);
  }
};
