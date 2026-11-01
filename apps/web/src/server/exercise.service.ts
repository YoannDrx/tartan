import { exerciseInput, type ExerciseInput, type ExerciseSummary, prescriptionSchema } from "@tartan/contracts";
import { parseYouTubeUrl, validateClipRange } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { invalid, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDirectUpload, signedPlayback, videoEnabled } from "@/lib/mux";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "./access";

type MediaRow = {
  kind: "upload" | "youtube";
  muxPlaybackId: string | null;
  youtubeId: string | null;
  customTitle: string | null;
  startS: number | null;
  endS: number | null;
};

export const mediaSnapshot = (media: MediaRow | undefined) => {
  if (!media) return null;
  if (media.kind === "youtube" && media.youtubeId) {
    return {
      kind: "youtube" as const,
      youtubeId: media.youtubeId,
      title: media.customTitle,
      startS: media.startS,
      endS: media.endS,
    };
  }
  return { kind: "upload" as const, muxPlaybackId: media.muxPlaybackId, title: media.customTitle };
};

export const listExercises = async (userId: string, organizationId: string): Promise<ExerciseSummary[]> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const rows = await prisma.exercise.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    include: { media: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return Promise.all(
    rows.map(async (e) => {
      const media = mediaSnapshot(e.media[0]);
      // Vidéos du coach privées : lecture par jeton signé, comme dans une séance.
      const stream =
        media?.kind === "upload" && media.muxPlaybackId && env().MUX_SIGNING_KEY_ID
          ? await signedPlayback(media.muxPlaybackId)
          : null;
      return {
        id: e.id,
        name: e.name,
        category: e.category,
        tags: e.tags,
        cues: e.cues,
        defaultPrescription: prescriptionSchema.parse(e.defaultPrescription),
        media: stream && media ? { ...media, streamUrl: stream.mp4Url, hlsUrl: stream.hlsUrl } : media,
      };
    }),
  );
};

export const saveExercise = async (userId: string, organizationId: string, raw: ExerciseInput) => {
  const input = exerciseInput.parse(raw);
  await requireOrgMember(userId, organizationId, "editExercises");
  let youtube: { youtubeId: string; startS: number | null; endS: number | null; customTitle: string | null } | null =
    null;
  if (input.media?.kind === "youtube") {
    const parsed = parseYouTubeUrl(input.media.url);
    if (!parsed) throw invalid(m.exercises.youtubeInvalid);
    const startS = input.media.startS ?? parsed.startS;
    const endS = input.media.endS ?? null;
    if (!validateClipRange(startS, endS)) throw invalid(m.exercises.clipInvalid);
    youtube = { youtubeId: parsed.youtubeId, startS, endS, customTitle: input.media.customTitle ?? null };
  }
  const data = {
    name: input.name,
    category: input.category,
    tags: input.tags,
    cues: input.cues,
    defaultPrescription: input.defaultPrescription,
  };
  return prisma.$transaction(async (tx) => {
    let id = input.id;
    if (id) {
      const existing = await tx.exercise.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!existing) throw notFound();
      await tx.exercise.update({ where: { id }, data });
    } else {
      id = (await tx.exercise.create({ data: { ...data, organizationId, createdBy: userId } })).id;
    }
    // Lien effacé : le YouTube part. Une vidéo filmée par le coach n'est jamais touchée ici.
    if (input.media === null) await tx.exerciseMedia.deleteMany({ where: { exerciseId: id, kind: "youtube" } });
    if (youtube) {
      await tx.exerciseMedia.deleteMany({ where: { exerciseId: id, kind: "youtube" } });
      await tx.exerciseMedia.create({ data: { exerciseId: id, kind: "youtube", ...youtube } });
    }
    return { id };
  });
};

// Suppression logique : les séances gardent leur copie, l'exercice sort de la bibliothèque (§ 7.4).
export const deleteExercise = async (userId: string, organizationId: string, exerciseId: string) => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const { count } = await prisma.exercise.updateMany({
    where: { id: exerciseId, organizationId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw notFound();
};

export const createExerciseVideoUpload = async (userId: string, organizationId: string, exerciseId: string) => {
  await requireOrgMember(userId, organizationId, "editExercises");
  if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, organizationId, deletedAt: null } });
  if (!exercise) throw notFound();
  const media = await prisma.exerciseMedia.create({ data: { exerciseId, kind: "upload" } });
  const upload = await createDirectUpload(`exercise:${media.id}`);
  await prisma.exerciseMedia.update({ where: { id: media.id }, data: { muxUploadId: upload.uploadId } });
  return { mediaId: media.id, uploadUrl: upload.url };
};
