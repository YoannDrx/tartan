import { validateVideoUploadRefs } from "./video-upload.service";
import { VIDEO_SELECT, videoWhereFor, requireVideoAccess as requireVideo } from "./video-access.service";
import { type AnnotationInput, type JumpAttemptInput, type VideoDetail, type VideoSummary } from "@tartan/contracts";
import { barSheet } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { AppError, consentRequired, forbidden, invalid, notFound } from "@/lib/errors";
import { signedPlayback, unwrapWebhook, videoEnabled, readUpload } from "@/lib/mux";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireOwnedRefs, requireVisibleAthlete, visibleAthleteIds, type Access } from "./access";
import { blockedUserIds } from "./blocks.service";
import { drainExternalDeletions, enqueueExternalDeletion } from "./external-deletion.service";
import { consentForAthletes } from "./consent.service";
import { firstNameOf, namesFor } from "./me.service";
import { notify, queueNotifications } from "./notify.service";
import { coachesOfAthlete } from "./org.service";
import {
  bestClearedHeight,
  deliveredFps,
  formatHeight,
  latestSitting,
  MAX_FILE_SECONDS,
  toRealMs,
} from "@tartan/domain";

const summarize = async (
  v: {
    id: string;
    athleteId: string;
    uploadedBy: string;
    status: VideoSummary["status"];
    muxPlaybackId: string | null;
    fps: number | null;
    timeScale: number;
    durationMs: number | null;
    recordedAt: Date | null;
    sharedWithAthlete: boolean;
    sharedWithGroup?: boolean;
    reviewedAt?: Date | null;
    scheduledSessionId?: string | null;
    exerciseId?: string | null;
    exercise?: { name: string } | null;
    athlete: { firstName: string; lastName: string };
    jumps: { barHeightCm: number; attemptNo: number; result: "O" | "X" | "pass" }[];
    _count: { annotations: number };
  },
  consentRevoked = false,
): Promise<VideoSummary> => {
  const jump = v.jumps[0];
  let thumbnailUrl: string | null = null;
  if (v.muxPlaybackId && !consentRevoked && env().MUX_SIGNING_KEY_ID)
    thumbnailUrl = (await signedPlayback(v.muxPlaybackId)).thumbnailUrl;
  return {
    exerciseId: v.exerciseId ?? null,
    exerciseName: v.exercise?.name ?? null,
    id: v.id,
    athleteId: v.athleteId,
    athleteName: `${v.athlete.firstName} ${v.athlete.lastName}`.trim(),
    uploadedBy: v.uploadedBy,
    status: v.status,
    playbackId: consentRevoked ? null : v.muxPlaybackId,
    thumbnailUrl,
    consentRevoked,
    fps: v.fps,
    timeScale: v.timeScale,
    durationMs: v.durationMs,
    recordedAt: v.recordedAt?.toISOString() ?? null,
    sharedWithAthlete: v.sharedWithAthlete,
    sharedWithGroup: v.sharedWithGroup ?? false,
    reviewedAt: v.reviewedAt?.toISOString() ?? null,
    scheduledSessionId: v.scheduledSessionId ?? null,
    barHeightCm: jump?.barHeightCm ?? null,
    attemptNo: jump?.attemptNo ?? null,
    result: jump?.result ?? null,
    annotationCount: v._count.annotations,
  };
};

// Accord vidéo retiré : le coach ne lit plus l'image. L'athlète garde l'accès à ses propres sauts.
const revokedAthletes = async (access: Access, athleteIds: string[]): Promise<Set<string>> => {
  if (access.role === "athlete" || athleteIds.length === 0) return new Set();
  const consents = await consentForAthletes([...new Set(athleteIds)]);
  return new Set([...new Set(athleteIds)].filter((id) => !consents.get(id)?.video));
};

const requireVideoConsent = async (athleteId: string): Promise<void> => {
  const consent = (await consentForAthletes([athleteId])).get(athleteId);
  if (!consent?.video) throw consentRequired();
};

const requireUsableExercise = async (organizationId: string, exerciseId: string) => {
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
    select: { id: true },
  });
  if (!exercise) throw notFound();
};

export { createVideoUpload, renewVideoUpload } from "./video-upload.service";

// Signature absente ou fausse : à distinguer d'une panne de notre côté, que Mux doit pouvoir réessayer.
export class MuxSignatureError extends Error {}

type MuxEvent = {
  type: string;
  data: {
    id: string;
    passthrough?: string;
    upload_id?: string;
    duration?: number;
    playback_ids?: { id: string }[];
    tracks?: { type?: string; max_frame_rate?: number }[];
  };
};

// Mux prévient : la vidéo passe à « prête », avec sa fréquence et sa durée (§ 11.5).
export const handleMuxWebhook = async (rawBody: string, headers: Headers): Promise<void> => {
  let event: MuxEvent;
  try {
    event = (await unwrapWebhook(rawBody, headers)) as MuxEvent;
  } catch {
    throw new MuxSignatureError();
  }
  await applyMuxEvent(event);
};

export const applyMuxEvent = async (event: MuxEvent): Promise<void> => {
  // Un envoi interrompu ne laisse pas la vidéo « en cours d'envoi » pour toujours.
  if (event.type === "video.upload.errored" || event.type === "video.upload.cancelled") {
    await prisma.video.updateMany({
      where: { muxUploadId: event.data.id, status: "uploading" },
      data: { status: "error" },
    });
    return;
  }
  const match = /^(video|exercise):([0-9a-f-]{36})(?::([0-9]+))?$/.exec(event.data.passthrough ?? "");
  if (!match) return;
  const [, kind, id, generation] = match;
  if (kind === "exercise") {
    if (event.type === "video.asset.ready") {
      // Mêmes limites que les vidéos d'athlètes : une démonstration trop longue ne reste pas.
      if ((event.data.duration ?? 0) > MAX_FILE_SECONDS * 1.1) {
        await enqueueExternalDeletion({ provider: "mux_asset", ref: event.data.id, reason: "video_oversized" });
        await prisma.exerciseMedia.deleteMany({ where: { id } });
        log.warn("video_oversized", { entityId: id });
        return;
      }
      const updated = await prisma.exerciseMedia.updateMany({
        where: { id },
        data: { muxAssetId: event.data.id, muxPlaybackId: event.data.playback_ids?.[0]?.id ?? null },
      });
      if (!updated.count) {
        await enqueueExternalDeletion({ provider: "mux_asset", ref: event.data.id, reason: "late_webhook" });
      }
    }
    return;
  }
  if (kind !== "video") return;
  await prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT id FROM videos WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await db.video.findUnique({
      where: { id },
      select: {
        uploadGeneration: true,
        muxUploadId: true,
        muxAssetId: true,
        status: true,
        organizationId: true,
        athleteId: true,
        uploadedBy: true,
        athlete: { select: { userId: true } },
      },
    });
    const stale =
      !current ||
      current.uploadGeneration !== Number(generation ?? 0) ||
      (event.data.upload_id && current.muxUploadId !== event.data.upload_id) ||
      (current.muxAssetId && current.muxAssetId !== event.data.id);
    if (stale) {
      if (["video.asset.created", "video.asset.ready", "video.asset.errored"].includes(event.type))
        await enqueueExternalDeletion({ provider: "mux_asset", ref: event.data.id, reason: "late_webhook" }, db);
      return;
    }
    if (event.type === "video.asset.created") {
      // Mux ne garantit pas l'ordre : un « créé » tardif ne fait pas reculer une vidéo déjà prête.
      await db.video.updateMany({
        where: { id, status: "uploading" },
        data: { status: "processing", muxAssetId: event.data.id },
      });
    } else if (event.type === "video.asset.ready") {
      const track = event.data.tracks?.find((t) => t.type === "video");
      const video = await db.video.findUnique({ where: { id }, select: { fps: true, timeScale: true } });
      const timeScale = video?.timeScale ?? 1;
      // Le client refuse déjà les fichiers trop longs : ici, seul un envoi qui l'aurait contourné est arrêté.
      if ((event.data.duration ?? 0) > MAX_FILE_SECONDS * 1.1) {
        await db.video.updateMany({ where: { id }, data: { status: "error" } });
        await enqueueExternalDeletion({ provider: "mux_asset", ref: event.data.id, reason: "video_oversized" }, db);
        log.warn("video_oversized", { entityId: id });
        return;
      }
      await db.video.updateMany({
        where: { id },
        data: {
          status: "ready",
          muxAssetId: event.data.id,
          muxPlaybackId: event.data.playback_ids?.[0]?.id ?? null,
          durationMs: event.data.duration ? Math.round(toRealMs(event.data.duration, timeScale)) : null,
          fps: deliveredFps({
            declaredFps: video?.fps ?? null,
            encodedFps: track?.max_frame_rate ?? null,
            timeScale,
          }),
        },
      });
      if (current.status !== "ready" && current.uploadedBy === current.athlete.userId) {
        const ids = await coachesOfAthlete(current.organizationId, current.athleteId);
        const members = await db.organizationMember.findMany({
          where: {
            organizationId: current.organizationId,
            userId: { in: ids, not: current.uploadedBy },
            status: "active",
            role: { in: ["owner", "coach", "assistant"] },
          },
          select: { userId: true },
        });
        await queueNotifications(
          db,
          members.map((member) => member.userId),
          "video_shared",
          {
            organizationId: current.organizationId,
            videoId: id,
            link: `/videos/${id}`,
          },
        );
      }
    } else if (event.type === "video.asset.errored") {
      await db.video.updateMany({ where: { id, status: { not: "ready" } }, data: { status: "error" } });
      log.error("video_encoding_failed", { entityId: id });
    }
  });
};

const assetEvent = (status: string): string | null =>
  status === "ready"
    ? "video.asset.ready"
    : status === "errored"
      ? "video.asset.errored"
      : status === "preparing"
        ? "video.asset.created"
        : null;

const STUCK_AFTER_MS = 10 * 60 * 1000;
// Une adresse expire après 24 h, mais la file locale peut la renouveler : un téléphone resté sans réseau n'est pas un échec.
const ABANDONED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const RECONCILE_BATCH = 50;

// Filet du webhook : relit chez Mux les vidéos restées en chemin, y compris les démonstrations d'exercices.
export const reconcileStuckVideos = async (now: Date = new Date()) => {
  const result = { checked: 0, repaired: 0, failed: 0 };
  if (!videoEnabled()) return result;
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MS);
  const abandonedBefore = new Date(now.getTime() - ABANDONED_AFTER_MS);
  const lost = await prisma.video.updateMany({
    where: { status: "uploading", muxUploadId: null, createdAt: { lt: abandonedBefore } },
    data: { status: "error" },
  });
  result.failed += lost.count;
  const [videos, media] = await Promise.all([
    prisma.video.findMany({
      where: {
        status: { in: ["uploading", "processing"] },
        muxUploadId: { not: null },
        updatedAt: { lt: stuckBefore },
      },
      select: { id: true, muxUploadId: true, createdAt: true, uploadGeneration: true },
      orderBy: { updatedAt: "asc" },
      take: RECONCILE_BATCH,
    }),
    prisma.exerciseMedia.findMany({
      // Fenêtre bornée : une démonstration abandonnée ne doit pas occuper le lot pour toujours.
      where: { muxUploadId: { not: null }, muxPlaybackId: null, createdAt: { lt: stuckBefore, gt: abandonedBefore } },
      select: { id: true, muxUploadId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: RECONCILE_BATCH,
    }),
  ]);
  const rows = [
    ...videos.map((row) => ({ ...row, passthrough: `video:${row.id}:${row.uploadGeneration}`, isVideo: true })),
    ...media.map((row) => ({ ...row, passthrough: `exercise:${row.id}`, isVideo: false })),
  ];
  for (const row of rows) {
    result.checked += 1;
    try {
      const upload = await readUpload(row.muxUploadId!);
      if (upload.state === "asset") {
        const type = assetEvent(upload.asset.status);
        if (!type) continue;
        await applyMuxEvent({ type, data: { ...upload.asset, passthrough: row.passthrough } });
        if (upload.asset.status === "ready") result.repaired += 1;
        continue;
      }
      if (!row.isVideo) continue;
      const gaveUp =
        upload.state === "failed" ||
        upload.state === "missing" ||
        (upload.state === "expired" && row.createdAt < abandonedBefore);
      if (gaveUp) {
        await prisma.video.updateMany({ where: { id: row.id, status: "uploading" }, data: { status: "error" } });
        result.failed += 1;
      }
    } catch {
      // Une panne Mux ponctuelle n'arrête pas le lot : la ligne sera relue au prochain passage.
      log.warn("video_reconcile_failed", { entityId: row.id });
    }
  }
  if (result.repaired || result.failed) log.info("video_reconciled", { count: result.repaired + result.failed });
  return result;
};

export type VideoQuery = {
  athleteId?: string;
  exerciseId?: string;
  sessionId?: string;
  status?: VideoSummary["status"];
  needsReview?: boolean;
  cursor?: string;
};

const readVideoRows = async (userId: string, organizationId: string, query: VideoQuery = {}, take = 100) => {
  const access = await requireOrgMember(userId, organizationId, "viewVideos");
  const rows = await prisma.video.findMany({
    // AND : le filtre demandé réduit le périmètre, il ne le remplace jamais.
    where: {
      AND: [
        await videoWhereFor(access),
        query.athleteId ? { athleteId: query.athleteId } : {},
        query.exerciseId ? { exerciseId: query.exerciseId } : {},
        query.sessionId ? { scheduledSessionId: query.sessionId } : {},
        query.status ? { status: query.status } : {},
        query.needsReview ? { reviewedAt: null, status: "ready" } : {},
        // Une vidéo déposée par quelqu'un qu'on a bloqué n'apparaît plus.
        { uploadedBy: { notIn: await blockedUserIds(userId) } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take,
    select: VIDEO_SELECT,
  });
  const revoked = await revokedAthletes(
    access,
    rows.map((r) => r.athleteId),
  );
  return Promise.all(rows.map((row) => summarize(row, revoked.has(row.athleteId))));
};

export const listVideos = (userId: string, organizationId: string, query: VideoQuery = {}) =>
  readVideoRows(userId, organizationId, query);

export const listVideoPage = async (userId: string, organizationId: string, query: VideoQuery = {}) => {
  const rows = await readVideoRows(userId, organizationId, query, 41);
  const videos = rows.slice(0, 40);
  return { videos, nextCursor: rows.length > 40 ? videos.at(-1)!.id : null };
};

export const getVideo = async (userId: string, organizationId: string, videoId: string): Promise<VideoDetail> => {
  const access = await requireOrgMember(userId, organizationId, "viewVideos");
  const video = await requireVideo(access, videoId);
  // Un camarade du groupe regarde la vidéo partagée et ce qu'en dit son auteur, jamais les remarques du coach.
  const peer = access.role === "athlete" && access.athleteId !== video.athleteId;
  const visibleAuthors = peer ? { in: video.athlete.userId ? [video.athlete.userId] : [] } : {};
  const [annotations, comments, attempts] = await Promise.all([
    prisma.videoAnnotation.findMany({
      where: { videoId, authorId: { notIn: await blockedUserIds(userId), ...visibleAuthors } },
      orderBy: { tMs: "asc" },
    }),
    prisma.comment.findMany({
      where: {
        organizationId,
        entityType: "video",
        entityId: videoId,
        authorId: { notIn: await blockedUserIds(userId), ...visibleAuthors },
      },
      orderBy: { createdAt: "asc" },
    }),
    video.scheduledSessionId && !peer
      ? prisma.jumpAttempt.findMany({
          where: { athleteId: video.athleteId, scheduledSessionId: video.scheduledSessionId },
        })
      : Promise.resolve([]),
  ]);
  const names = await namesFor([...annotations.map((a) => a.authorId), ...comments.map((c) => c.authorId)]);
  const consentRevoked = (await revokedAthletes(access, [video.athleteId])).has(video.athleteId);
  const signed =
    video.muxPlaybackId && !consentRevoked && env().MUX_SIGNING_KEY_ID
      ? await signedPlayback(video.muxPlaybackId)
      : null;
  const devMp4 = process.env.NODE_ENV !== "production" && !consentRevoked ? env().VIDEO_DEV_MP4_URL : undefined;
  return {
    ...(await summarize(video, consentRevoked)),
    canAnnotate: !peer && Boolean((await consentForAthletes([video.athleteId])).get(video.athleteId)?.video),
    canHideFromAthlete: video.uploadedBy !== video.athlete.userId && video.sharedGroupIds.length === 0,
    // L'athlète gère ce qu'il a envoyé ; une vidéo filmée par le coach reste gérée par l'encadrement.
    canManage: access.role !== "athlete" || (access.athleteId === video.athleteId && video.uploadedBy === userId),
    canShareGroups: access.role === "athlete" && access.athleteId === video.athleteId,
    sharedGroupIds: access.athleteId === video.athleteId ? video.sharedGroupIds : [],
    availableShareGroups:
      access.athleteId === video.athleteId
        ? (
            await prisma.groupMember.findMany({
              where: { athleteId: video.athleteId, group: { organizationId } },
              select: { group: { select: { id: true, name: true } } },
            })
          ).map((g) => g.group)
        : [],
    hlsUrl: signed?.hlsUrl ?? null,
    mp4Url: signed?.mp4Url ?? devMp4 ?? null,
    // Une réponse dont la remarque d'origine est masquée n'aurait plus de contexte : elle l'est aussi.
    annotations: annotations
      .filter((a) => !a.parentId || annotations.some((root) => root.id === a.parentId))
      .map((a) => ({
      id: a.id,
      authorId: a.authorId,
      parentId: a.parentId,
      tMs: a.tMs,
      phase: a.phase,
      text: a.text,
      authorName: names.get(a.authorId) ?? null,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      authorName: names.get(c.authorId) ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    barSheet: barSheet(attempts).map((r) => ({ heightCm: r.heightCm, label: r.label, notation: r.notation })),
  };
};

export const linkVideoExercise = async (
  userId: string,
  organizationId: string,
  videoId: string,
  exerciseId: string | null,
): Promise<void> => {
  const access = await requireOrgMember(userId, organizationId, "uploadVideos");
  const video = await requireVideo(access, videoId);
  if (access.role === "athlete" && access.athleteId !== video.athleteId) throw forbidden();
  if (exerciseId) {
    if (access.role === "athlete")
      await validateVideoUploadRefs(
        access,
        video.athleteId,
        { exerciseId, scheduledSessionId: video.scheduledSessionId },
        prisma,
      );
    else await requireUsableExercise(organizationId, exerciseId);
  }
  await prisma.video.update({ where: { id: videoId }, data: { exerciseId } });
};

export const addAnnotation = async (
  userId: string,
  organizationId: string,
  videoId: string,
  input: AnnotationInput,
) => {
  const access = await requireOrgMember(userId, organizationId, "replyVideos");
  const video = await requireVideo(access, videoId);
  if (access.role === "athlete" && access.athleteId !== video.athleteId) throw forbidden();
  await requireVideoConsent(video.athleteId);
  const parent = input.parentId
    ? await prisma.videoAnnotation.findFirst({
        where: { id: input.parentId, videoId, parentId: null },
        select: { id: true, tMs: true },
      })
    : null;
  if (input.parentId && !parent) throw notFound();
  const tMs = parent?.tMs ?? input.tMs;
  if (video.durationMs !== null && tMs > video.durationMs) throw invalid(m.errors.invalid);
  const targets =
    access.role === "athlete"
      ? await coachesOfAthlete(organizationId, video.athleteId)
      : video.sharedWithAthlete && video.athlete.userId
        ? [video.athlete.userId]
        : [];
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: "active", userId: { in: targets, not: userId } },
    select: { userId: true },
  });
  return prisma.$transaction(async (db) => {
    await db.video.update({ where: { id: videoId }, data: { reviewedAt: null, reviewedBy: null } });
    const annotation = await db.videoAnnotation.create({
      data: {
        videoId,
        authorId: userId,
        tMs,
        parentId: parent?.id ?? null,
        phase: input.phase ?? null,
        kind: "comment",
        text: input.text,
      },
      select: { id: true },
    });
    await queueNotifications(
      db,
      members.map((member) => member.userId),
      "comment",
      {
        organizationId,
        videoId,
        link: access.role === "athlete" ? `/videos/${videoId}` : `/mes-sauts/${videoId}`,
        ...(access.role === "athlete" ? { athlete: await firstNameOf(userId) } : { coach: await firstNameOf(userId) }),
      },
    );
    return annotation;
  });
};

export const deleteAnnotation = async (userId: string, organizationId: string, annotationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "replyVideos");
  const annotation = await prisma.videoAnnotation.findFirst({
    where: { id: annotationId, video: { organizationId } },
    select: { id: true, videoId: true, authorId: true },
  });
  if (!annotation) throw notFound();
  await requireVideo(access, annotation.videoId);
  if (access.role === "athlete" && annotation.authorId !== userId) throw forbidden();
  await prisma.videoAnnotation.delete({ where: { id: annotation.id } });
};

export const shareVideo = async (
  userId: string,
  organizationId: string,
  videoId: string,
  input: { withAthlete: boolean; withGroup?: boolean; groupIds?: string[] },
) => {
  const access = await requireOrgMember(userId, organizationId, "replyVideos");
  const video = await requireVideo(access, videoId);
  if (access.role === "athlete" && access.athleteId !== video.athleteId) throw forbidden();
  const requestedGroups = input.groupIds === undefined ? undefined : [...new Set(input.groupIds)];
  if (input.withGroup || requestedGroups?.length) {
    if (access.role !== "athlete" || access.athleteId !== video.athleteId) throw forbidden();
    if (!input.withGroup || !requestedGroups?.length) throw invalid(m.videoCollaboration.chooseGroup);
    const known = await prisma.groupMember.count({
      where: { athleteId: video.athleteId, groupId: { in: requestedGroups }, group: { organizationId } },
    });
    if (known !== requestedGroups.length) throw notFound();
    await requireVideoConsent(video.athleteId);
  }
  // Un ancien client qui ne connaît pas les groupes ne peut pas effacer ce choix.
  const groupIds = requestedGroups ?? video.sharedGroupIds;
  const withAthlete = video.uploadedBy === video.athlete.userId || groupIds.length > 0 || input.withAthlete;
  const revokingOwnGroups =
    access.role === "athlete" &&
    requestedGroups !== undefined &&
    requestedGroups.every((id) => video.sharedGroupIds.includes(id)) &&
    (video.sharedWithAthlete || video.uploadedBy === userId);
  if (withAthlete && !revokingOwnGroups) await requireVideoConsent(video.athleteId);
  await prisma.video.update({
    where: { id: videoId },
    data: {
      sharedWithAthlete: withAthlete,
      sharedWithGroup: groupIds.length > 0,
      sharedGroupIds: groupIds,
    },
  });
  if (withAthlete && !video.sharedWithAthlete && video.athlete.userId && video.athlete.userId !== userId) {
    await notify([video.athlete.userId], "video_shared", {
      coach: await firstNameOf(userId),
      organizationId,
      videoId,
      link: `/mes-sauts/${videoId}`,
    });
  }
};

export const markVideoReviewed = async (userId: string, organizationId: string, videoId: string) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  const video = await requireVideo(access, videoId);
  await requireVideoConsent(video.athleteId);
  await prisma.video.update({ where: { id: videoId }, data: { reviewedAt: new Date(), reviewedBy: userId } });
};

export const deleteVideo = async (userId: string, organizationId: string, videoId: string) => {
  const access = await requireOrgMember(userId, organizationId, "uploadVideos");
  const video = await requireVideo(access, videoId);
  // Une vidéo filmée par le coach porte ses remarques : l'athlète peut la masquer, pas l'effacer.
  if (access.role === "athlete" && (access.athleteId !== video.athleteId || video.uploadedBy !== userId))
    throw forbidden();
  await prisma.video.delete({ where: { id: videoId } });
  await drainExternalDeletions();
};

export const deleteJumpAttempt = async (userId: string, organizationId: string, attemptId: string) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  const attempt = await prisma.jumpAttempt.findFirst({ where: { id: attemptId, organizationId } });
  if (!attempt) throw notFound();
  await requireVisibleAthlete(access, attempt.athleteId);
  await prisma.jumpAttempt.delete({ where: { id: attempt.id } });
  return { athleteId: attempt.athleteId };
};

export const addJumpAttempt = async (userId: string, organizationId: string, input: JumpAttemptInput) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  await requireVisibleAthlete(access, input.athleteId);
  await requireOwnedRefs(organizationId, {
    sessionId: input.scheduledSessionId,
    competitionId: input.competitionId,
    videoId: input.videoId,
  });
  if (input.clientId) {
    const existing = await prisma.jumpAttempt.findUnique({
      where: { athleteId_clientId: { athleteId: input.athleteId, clientId: input.clientId } },
      select: { id: true },
    });
    if (existing) return existing;
  }
  return prisma.jumpAttempt.create({
    data: {
      clientId: input.clientId ?? null,
      organizationId,
      athleteId: input.athleteId,
      scheduledSessionId: input.scheduledSessionId ?? null,
      competitionId: input.competitionId ?? null,
      barHeightCm: input.barHeightCm,
      attemptNo: input.attemptNo,
      result: input.result,
      approachSteps: input.approachSteps ?? null,
      takeoffDistanceCm: input.takeoffDistanceCm ?? null,
      videoId: input.videoId ?? null,
    },
    select: { id: true },
  });
};

export const getBarSheet = async (
  userId: string,
  organizationId: string,
  query: { athleteId: string; scheduledSessionId?: string; competitionId?: string },
) => {
  const access = await requireOrgMember(userId, organizationId, "viewVideos");
  if (access.role === "athlete") {
    if (access.athleteId !== query.athleteId) throw forbidden();
  } else {
    await requireVisibleAthlete(access, query.athleteId);
  }
  const attempts = await prisma.jumpAttempt.findMany({
    where: {
      organizationId,
      athleteId: query.athleteId,
      ...(query.scheduledSessionId ? { scheduledSessionId: query.scheduledSessionId } : {}),
      ...(query.competitionId ? { competitionId: query.competitionId } : {}),
    },
    orderBy: [{ barHeightCm: "asc" }, { attemptNo: "asc" }],
    select: {
      id: true,
      barHeightCm: true,
      attemptNo: true,
      result: true,
      scheduledSessionId: true,
      competitionId: true,
      createdAt: true,
      session: { select: { date: true } },
    },
  });
  // Sans filtre, une seule séance : la notation O/X n'a de sens que le temps d'un concours.
  const shown = query.scheduledSessionId || query.competitionId ? attempts : latestSitting(attempts);
  return {
    rows: barSheet(shown),
    attempts: shown.map((a) => ({ id: a.id, heightCm: a.barHeightCm, attemptNo: a.attemptNo, result: a.result })),
    date: shown[0]?.session ? fromDbDate(shown[0].session.date) : null,
    bestCm: bestClearedHeight(attempts),
  };
};
