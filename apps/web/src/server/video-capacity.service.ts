import type { Prisma } from "@/generated/prisma/client";
import { assertAthleteVideoQuota, assertWithinPlan } from "./billing.service";
import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { platformSettings } from "./platform-settings.service";

// Une adresse d'envoi Mux vit 24 h : au-delà, un envoi jamais arrivé n'occupe plus de place.
const UPLOAD_ADDRESS_MS = 24 * 60 * 60 * 1000;

// Plafond technique de stockage, tous espaces confondus. Sans réglage, aucun plafond global.
export const videoCapacity = async (
  now = new Date(),
  db: Prisma.TransactionClient = prisma,
): Promise<{ used: number; limit: number } | null> => {
  const limit = (await platformSettings()).muxVideoLimit;
  if (!limit) return null;
  const inFlight = { muxAssetId: null, quotaReservedAt: { gte: new Date(now.getTime() - UPLOAD_ADDRESS_MS) } };
  const [videos, media] = await Promise.all([
    db.video.count({ where: { OR: [{ muxAssetId: { not: null } }, inFlight] } }),
    db.exerciseMedia.count({ where: { kind: "upload", OR: [{ muxAssetId: { not: null } }, inFlight] } }),
  ]);
  return { used: videos + media, limit };
};

export const assertVideoCapacity = async (db: Prisma.TransactionClient = prisma): Promise<void> => {
  const capacity = await videoCapacity(new Date(), db);
  if (capacity && capacity.used >= capacity.limit) {
    throw new AppError(409, "video_storage_full", m.errors.videoStorageFull);
  }
};

// Tous les créateurs (vidéos personnelles et démonstrations) réservent sous le
// même verrou. Aucun appel réseau ne doit avoir lieu dans cette transaction.
export const withVideoReservation = <T>(operation: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('tartan:video-reservations'))`;
    return operation(db);
  });

export const assertVideoReservation = async (organizationId: string, db: Prisma.TransactionClient): Promise<void> => {
  await assertWithinPlan(organizationId, "maxVideosPerMonth", db);
  await assertVideoCapacity(db);
};

// L'athlète qui envoie sa propre vidéo consomme son quota personnel ; l'encadrement, celui de l'espace.
export const assertUploadReservation = async (
  access: { role: string; athleteId: string | null; userId: string },
  organizationId: string,
  db: Prisma.TransactionClient,
): Promise<void> => {
  if (access.role === "athlete" && access.athleteId) {
    await assertAthleteVideoQuota(organizationId, access.athleteId, access.userId, db);
    await assertVideoCapacity(db);
  } else await assertVideoReservation(organizationId, db);
};
