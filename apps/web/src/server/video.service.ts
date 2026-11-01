import {
  type AnnotationInput,
  type CreateVideoInput,
  type JumpAttemptInput,
  type VideoDetail,
  type VideoSummary,
} from "@tartan/contracts";
import { barSheet } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { AppError, consentRequired, forbidden, invalid, notFound } from "@/lib/errors";
import { createDirectUpload, deleteAsset, signedPlayback, unwrapWebhook, videoEnabled } from "@/lib/mux";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireVisibleAthlete, visibleAthleteIds, type Access } from "./access";
import { assertWithinPlan } from "./billing.service";
import { consentForAthletes } from "./consent.service";
import { firstNameOf, namesFor } from "./me.service";
import { notify } from "./notify.service";
import { coachesOfAthlete } from "./org.service";
import { formatHeight } from "@tartan/domain";

const VIDEO_SELECT = {
  id: true,
  athleteId: true,
  status: true,
  muxPlaybackId: true,
  fps: true,
  durationMs: true,
  recordedAt: true,
  sharedWithAthlete: true,
  sharedWithGroup: true,
  scheduledSessionId: true,
  athlete: { select: { firstName: true, lastName: true, userId: true } },
  jumps: { select: { barHeightCm: true, attemptNo: true, result: true }, take: 1 },
  _count: { select: { annotations: true } },
} as const;

const summarize = async (v: {
  id: string;
  athleteId: string;
  status: VideoSummary["status"];
  muxPlaybackId: string | null;
  fps: number | null;
  durationMs: number | null;
  recordedAt: Date | null;
  sharedWithAthlete: boolean;
  athlete: { firstName: string; lastName: string };
  jumps: { barHeightCm: number; attemptNo: number; result: "O" | "X" | "pass" }[];
  _count: { annotations: number };
}): Promise<VideoSummary> => {
  const jump = v.jumps[0];
  let thumbnailUrl: string | null = null;
  if (v.muxPlaybackId && env().MUX_SIGNING_KEY_ID) thumbnailUrl = (await signedPlayback(v.muxPlaybackId)).thumbnailUrl;
  return {
    id: v.id,
    athleteId: v.athleteId,
    athleteName: `${v.athlete.firstName} ${v.athlete.lastName}`.trim(),
    status: v.status,
    playbackId: v.muxPlaybackId,
    thumbnailUrl,
    fps: v.fps,
    durationMs: v.durationMs,
    recordedAt: v.recordedAt?.toISOString() ?? null,
    sharedWithAthlete: v.sharedWithAthlete,
    barHeightCm: jump?.barHeightCm ?? null,
    attemptNo: jump?.attemptNo ?? null,
    result: jump?.result ?? null,
    annotationCount: v._count.annotations,
  };
};

const requireVideoConsent = async (athleteId: string): Promise<void> => {
  const consent = (await consentForAthletes([athleteId])).get(athleteId);
  if (!consent?.video) throw consentRequired();
};

export const createVideoUpload = async (userId: string, organizationId: string, input: CreateVideoInput) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  await requireVisibleAthlete(access, input.athleteId);
  await requireVideoConsent(input.athleteId);
  await assertWithinPlan(organizationId, "maxVideosPerMonth");
  if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
  if (input.scheduledSessionId) {
    const session = await prisma.scheduledSession.findFirst({
      where: { id: input.scheduledSessionId, organizationId },
    });
    if (!session) throw notFound();
  }
  const video = await prisma.video.create({
    data: {
      organizationId,
      athleteId: input.athleteId,
      uploadedBy: userId,
      scheduledSessionId: input.scheduledSessionId ?? null,
      fps: input.fps ?? null,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      ...(input.attempt
        ? {
            jumps: {
              create: {
                organizationId,
                athleteId: input.athleteId,
                scheduledSessionId: input.scheduledSessionId ?? null,
                barHeightCm: input.attempt.barHeightCm,
                attemptNo: input.attempt.attemptNo,
                result: input.attempt.result,
                approachSteps: input.attempt.approachSteps ?? null,
              },
            },
          }
        : {}),
    },
  });
  const upload = await createDirectUpload(`video:${video.id}`);
  await prisma.video.update({ where: { id: video.id }, data: { muxUploadId: upload.uploadId } });
  log.info("video_upload_created", { organizationId, entityId: video.id });
  return { videoId: video.id, uploadUrl: upload.url };
};

// Une adresse d'envoi expire : la file locale en redemande une sans recréer la vidéo ni l'essai.
export const renewVideoUpload = async (userId: string, organizationId: string, videoId: string) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  const video = await requireVideo(access, videoId);
  if (video.status !== "uploading") throw invalid("Cette vidéo est déjà envoyée.");
  if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
  const upload = await createDirectUpload(`video:${videoId}`);
  await prisma.video.update({ where: { id: videoId }, data: { muxUploadId: upload.uploadId } });
  return { videoId, uploadUrl: upload.url };
};

// Mux prévient : la vidéo passe à « prête », avec sa fréquence et sa durée (§ 11.5).
export const handleMuxWebhook = async (rawBody: string, headers: Headers): Promise<void> => {
  const event = unwrapWebhook(rawBody, headers) as unknown as {
    type: string;
    data: {
      id: string;
      passthrough?: string;
      duration?: number;
      playback_ids?: { id: string }[];
      upload_id?: string;
      tracks?: { type: string; max_frame_rate?: number }[];
    };
  };
  await applyMuxEvent(event);
};

export const applyMuxEvent = async (event: {
  type: string;
  data: {
    id: string;
    passthrough?: string;
    duration?: number;
    playback_ids?: { id: string }[];
    tracks?: { type: string; max_frame_rate?: number }[];
  };
}): Promise<void> => {
  const [kind, id] = (event.data.passthrough ?? "").split(":");
  if (!id) return;
  if (kind === "exercise") {
    if (event.type === "video.asset.ready") {
      await prisma.exerciseMedia.updateMany({
        where: { id },
        data: { muxAssetId: event.data.id, muxPlaybackId: event.data.playback_ids?.[0]?.id ?? null },
      });
    }
    return;
  }
  if (kind !== "video") return;
  if (event.type === "video.asset.created") {
    await prisma.video.updateMany({ where: { id }, data: { status: "processing", muxAssetId: event.data.id } });
  } else if (event.type === "video.asset.ready") {
    const track = event.data.tracks?.find((t) => t.type === "video");
    const video = await prisma.video.findUnique({ where: { id }, select: { fps: true } });
    await prisma.video.updateMany({
      where: { id },
      data: {
        status: "ready",
        muxAssetId: event.data.id,
        muxPlaybackId: event.data.playback_ids?.[0]?.id ?? null,
        durationMs: event.data.duration ? Math.round(event.data.duration * 1000) : null,
        fps: track?.max_frame_rate ? Math.round(track.max_frame_rate) : (video?.fps ?? null),
      },
    });
  } else if (event.type === "video.asset.errored") {
    await prisma.video.updateMany({ where: { id }, data: { status: "error" } });
    log.error("video_encoding_failed", { entityId: id });
  }
};

const videoWhereFor = async (access: Access) => {
  if (access.role === "athlete") {
    // Athlète : ses vidéos partagées, et celles partagées au groupe explicitement.
    return {
      organizationId: access.organizationId,
      OR: [{ athleteId: access.athleteId ?? "00000000-0000-0000-0000-000000000000", sharedWithAthlete: true }],
    };
  }
  return { organizationId: access.organizationId, athleteId: { in: await visibleAthleteIds(access) } };
};

export const listVideos = async (userId: string, organizationId: string, query: { athleteId?: string } = {}) => {
  const access = await requireOrgMember(userId, organizationId, "viewVideos");
  const rows = await prisma.video.findMany({
    where: { ...(await videoWhereFor(access)), ...(query.athleteId ? { athleteId: query.athleteId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: VIDEO_SELECT,
  });
  return Promise.all(rows.map(summarize));
};

const requireVideo = async (access: Access, videoId: string) => {
  const video = await prisma.video.findFirst({
    where: { id: videoId, ...(await videoWhereFor(access)) },
    select: VIDEO_SELECT,
  });
  if (!video) throw notFound();
  return video;
};

export const getVideo = async (userId: string, organizationId: string, videoId: string): Promise<VideoDetail> => {
  const access = await requireOrgMember(userId, organizationId, "viewVideos");
  const video = await requireVideo(access, videoId);
  const [annotations, comments, attempts] = await Promise.all([
    prisma.videoAnnotation.findMany({ where: { videoId }, orderBy: { tMs: "asc" } }),
    prisma.comment.findMany({
      where: { organizationId, entityType: "video", entityId: videoId },
      orderBy: { createdAt: "asc" },
    }),
    video.scheduledSessionId
      ? prisma.jumpAttempt.findMany({
          where: { athleteId: video.athleteId, scheduledSessionId: video.scheduledSessionId },
        })
      : Promise.resolve([]),
  ]);
  const names = await namesFor([...annotations.map((a) => a.authorId), ...comments.map((c) => c.authorId)]);
  const signed = video.muxPlaybackId && env().MUX_SIGNING_KEY_ID ? await signedPlayback(video.muxPlaybackId) : null;
  const devMp4 = process.env.NODE_ENV !== "production" ? env().VIDEO_DEV_MP4_URL : undefined;
  return {
    ...(await summarize(video)),
    hlsUrl: signed?.hlsUrl ?? null,
    mp4Url: signed?.mp4Url ?? devMp4 ?? null,
    annotations: annotations.map((a) => ({
      id: a.id,
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

export const addAnnotation = async (
  userId: string,
  organizationId: string,
  videoId: string,
  input: AnnotationInput,
) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  await requireVideo(access, videoId);
  return prisma.videoAnnotation.create({
    data: { videoId, authorId: userId, tMs: input.tMs, phase: input.phase ?? null, kind: "comment", text: input.text },
    select: { id: true },
  });
};

export const deleteAnnotation = async (userId: string, organizationId: string, annotationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  const annotation = await prisma.videoAnnotation.findFirst({
    where: { id: annotationId, video: { organizationId } },
    select: { id: true, videoId: true },
  });
  if (!annotation) throw notFound();
  await requireVideo(access, annotation.videoId);
  await prisma.videoAnnotation.delete({ where: { id: annotation.id } });
};

export const shareVideo = async (
  userId: string,
  organizationId: string,
  videoId: string,
  input: { withAthlete: boolean; withGroup?: boolean },
) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  const video = await requireVideo(access, videoId);
  if (input.withGroup) {
    // Vidéos de mineurs : jamais partagées au groupe (§ 15.3). Le partage au groupe reste hors V1.
    throw forbidden();
  }
  await prisma.video.update({ where: { id: videoId }, data: { sharedWithAthlete: input.withAthlete } });
  if (input.withAthlete && !video.sharedWithAthlete && video.athlete.userId) {
    const jump = video.jumps[0];
    await notify([video.athlete.userId], "video_shared", {
      coach: await firstNameOf(userId),
      height: jump ? formatHeight(jump.barHeightCm) : undefined,
      organizationId,
      videoId,
      link: `/mes-sauts/${videoId}`,
    });
  }
};

export const deleteVideo = async (userId: string, organizationId: string, videoId: string) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  await requireVideo(access, videoId);
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId }, select: { muxAssetId: true } });
  if (video.muxAssetId && videoEnabled()) await deleteAsset(video.muxAssetId);
  await prisma.video.delete({ where: { id: videoId } });
};

export const addJumpAttempt = async (userId: string, organizationId: string, input: JumpAttemptInput) => {
  const access = await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  await requireVisibleAthlete(access, input.athleteId);
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
    select: { barHeightCm: true, attemptNo: true, result: true, session: { select: { date: true } } },
  });
  return {
    rows: barSheet(attempts),
    date: attempts[0]?.session ? fromDbDate(attempts[0].session.date) : null,
  };
};

export const coachesForVideo = coachesOfAthlete;
