import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createVideoInput, sessionSnapshot, type CreateVideoInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { AppError, consentRequired, forbidden, invalid, notFound } from "@/lib/errors";
import { createDirectUpload, readDirectUpload, videoEnabled } from "@/lib/mux";
import { requireOrgMember, requireVisibleAthlete, type Access } from "./access";
import { consentForAthletes } from "./consent.service";
import { athleteAssignedWhere } from "./session-audience.service";
import { assertUploadReservation, withVideoReservation } from "./video-capacity.service";
import { enqueueExternalDeletion } from "./external-deletion.service";

const DAY = 24 * 60 * 60 * 1000;
const alreadyUploaded = () => new AppError(409, "video_already_uploaded", m.videoCollaboration.alreadyUploaded);

const requireVideoConsent = async (athleteId: string) => {
  if (!(await consentForAthletes([athleteId])).get(athleteId)?.video) throw consentRequired();
};

export const validateVideoUploadRefs = async (
  access: Access,
  athleteId: string,
  input: CreateVideoInput,
  db: Prisma.TransactionClient,
) => {
  await requireVisibleAthlete(access, athleteId, db);
  let linkedExercises: string[] = [];
  if (input.scheduledSessionId) {
    // Même lecture que la séance athlète : publiée et attribuée, y compris l'historique réalisé.
    const session = await db.scheduledSession.findFirst({
      where: {
        id: input.scheduledSessionId,
        organizationId: access.organizationId,
        ...(access.role === "athlete" ? await athleteAssignedWhere(athleteId, db) : {}),
      },
      select: { id: true, snapshot: true },
    });
    if (!session) throw notFound();
    const snapshot = sessionSnapshot.safeParse(session.snapshot);
    if (snapshot.success)
      linkedExercises = snapshot.data.blocks.flatMap((b) =>
        b.items.flatMap((i) => (i.exerciseId ? [i.exerciseId] : [])),
      );
  }
  if (input.exerciseId && access.role === "athlete" && !linkedExercises.includes(input.exerciseId)) throw notFound();
  if (
    input.exerciseId &&
    !(await db.exercise.count({
      where: {
        id: input.exerciseId,
        deletedAt: null,
        OR: [{ organizationId: access.organizationId }, { organizationId: null }],
      },
    }))
  )
    throw notFound();
};

// Une réservation en base précède Mux. Le verrou propre à la vidéo sérialise les
// doubles clics ; les appels réseau sont bornés, hors du verrou global des quotas.
const provision = async (userId: string, organizationId: string, videoId: string) =>
  prisma.$transaction(
    async (db) => {
      const access = await requireOrgMember(userId, organizationId, "uploadVideos", db);
      await db.$queryRaw`SELECT id FROM videos WHERE id = ${videoId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`;
      const video = await db.video.findFirst({ where: { id: videoId, organizationId } });
      if (!video || video.uploadedBy !== userId) throw notFound();
      await validateVideoUploadRefs(
        access,
        video.athleteId,
        {
          scheduledSessionId: video.scheduledSessionId ?? undefined,
          exerciseId: video.exerciseId ?? undefined,
        },
        db,
      );
      await requireVideoConsent(video.athleteId);
      if (video.status !== "uploading" || video.muxAssetId) throw alreadyUploaded();
      if (video.muxUploadId && video.uploadClientId) {
        const previous = await readDirectUpload(video.muxUploadId);
        if (previous?.assetId || previous?.status === "asset_created") throw alreadyUploaded();
        if (previous?.status === "waiting" && previous.url) return { videoId, uploadUrl: previous.url };
      }
      const generation = video.uploadGeneration + 1;
      const upload = await createDirectUpload(`video:${videoId}:${generation}`);
      if (video.muxUploadId)
        await enqueueExternalDeletion({ provider: "mux_upload", ref: video.muxUploadId, reason: "upload_renewed" }, db);
      await db.video.update({
        where: { id: videoId },
        data: { muxUploadId: upload.uploadId, uploadGeneration: generation },
      });
      return { videoId, uploadUrl: upload.url };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

export const createVideoUpload = async (userId: string, organizationId: string, raw: CreateVideoInput) => {
  const input = createVideoInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "uploadVideos");
  const athleteId = access.role === "athlete" ? access.athleteId : input.athleteId;
  if (!athleteId) throw invalid(m.videoCollaboration.athleteRequired);
  if (access.role === "athlete") {
    if (input.athleteId && input.athleteId !== athleteId) throw forbidden();
    if (!input.clientId) throw invalid(m.videoCollaboration.requestRequired);
  }
  await validateVideoUploadRefs(access, athleteId, input, prisma);
  await requireVideoConsent(athleteId);
  if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...input, athleteId }))
    .digest("hex");
  const video = await withVideoReservation(async (db) => {
    const current = await requireOrgMember(userId, organizationId, "uploadVideos", db);
    await validateVideoUploadRefs(current, athleteId, input, db);
    if (input.clientId) {
      const existing = await db.video.findUnique({
        where: {
          organizationId_uploadedBy_uploadClientId: {
            organizationId,
            uploadedBy: userId,
            uploadClientId: input.clientId,
          },
        },
      });
      if (existing) {
        if (existing.uploadRequestHash !== hash)
          throw new AppError(409, "video_request_changed", m.videoCollaboration.requestChanged);
        if (existing.status !== "uploading" || existing.muxAssetId) throw alreadyUploaded();
        if (existing.quotaReservedAt.getTime() < Date.now() - DAY) {
          await assertUploadReservation(current, organizationId, db);
          return db.video.update({ where: { id: existing.id }, data: { quotaReservedAt: new Date() } });
        }
        return existing;
      }
    }
    await assertUploadReservation(current, organizationId, db);
    return db.video.create({
      data: {
        organizationId,
        athleteId,
        uploadedBy: userId,
        uploadClientId: input.clientId ?? null,
        uploadRequestHash: hash,
        exerciseId: input.exerciseId ?? null,
        scheduledSessionId: input.scheduledSessionId ?? null,
        sharedWithAthlete: current.role === "athlete",
        fps: input.fps ?? null,
        timeScale: input.timeScale ?? 1,
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
        // Un essai de saut se note par l'encadrement : l'athlète ne déclare pas lui-même sa barre.
        ...(input.attempt && current.role !== "athlete"
          ? {
              jumps: {
                create: {
                  organizationId,
                  athleteId,
                  scheduledSessionId: input.scheduledSessionId ?? null,
                  ...input.attempt,
                  approachSteps: input.attempt.approachSteps ?? null,
                },
              },
            }
          : {}),
      },
    });
  });
  return provision(userId, organizationId, video.id);
};

export const renewVideoUpload = async (userId: string, organizationId: string, videoId: string) => {
  await requireOrgMember(userId, organizationId, "uploadVideos");
  await withVideoReservation(async (db) => {
    const access = await requireOrgMember(userId, organizationId, "uploadVideos", db);
    const video = await db.video.findFirst({ where: { id: videoId, organizationId, uploadedBy: userId } });
    if (!video) throw notFound();
    await validateVideoUploadRefs(
      access,
      video.athleteId,
      {
        scheduledSessionId: video.scheduledSessionId ?? undefined,
        exerciseId: video.exerciseId ?? undefined,
      },
      db,
    );
    await requireVideoConsent(video.athleteId);
    if (video.status !== "uploading" || video.muxAssetId) throw alreadyUploaded();
    if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
    if (video.quotaReservedAt.getTime() < Date.now() - DAY) {
      await assertUploadReservation(access, organizationId, db);
      await db.video.update({ where: { id: videoId }, data: { quotaReservedAt: new Date() } });
    }
  });
  return provision(userId, organizationId, videoId);
};
