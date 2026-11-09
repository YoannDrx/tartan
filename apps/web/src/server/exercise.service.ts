import { Prisma } from "@/generated/prisma/client";
import {
  exerciseClassification,
  exerciseInput,
  type ExerciseInput,
  type ExerciseSummary,
  prescriptionSchema,
} from "@tartan/contracts";
import { cleanExerciseAliases, parseInstagramUrl, parseYouTubeUrl, validateClipRange } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { invalid, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDirectUpload, signedPlayback, videoEnabled } from "@/lib/mux";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "./access";
import { assertWithinPlan } from "./billing.service";
import { assertVideoCapacity } from "./video-capacity.service";

type MediaRow = {
  kind: "upload" | "youtube" | "instagram";
  muxPlaybackId: string | null;
  youtubeId: string | null;
  instagramCode: string | null;
  author: string | null;
  embeddable: boolean;
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
      author: media.author,
      startS: media.startS,
      endS: media.endS,
    };
  }
  if (media.kind === "instagram" && media.instagramCode) {
    return {
      kind: "instagram" as const,
      instagramCode: media.instagramCode,
      title: media.customTitle,
      author: media.author,
      embeddable: media.embeddable,
    };
  }
  return { kind: "upload" as const, muxPlaybackId: media.muxPlaybackId, title: media.customTitle };
};

type ExerciseRow = Prisma.ExerciseGetPayload<{ include: { media: true } }>;

const exerciseSummary = async (e: ExerciseRow): Promise<ExerciseSummary> => {
  const media = mediaSnapshot(e.media[0]);
  // Vidéos du coach privées : lecture par jeton signé, comme dans une séance.
  const stream =
    media?.kind === "upload" && media.muxPlaybackId && env().MUX_SIGNING_KEY_ID
      ? await signedPlayback(media.muxPlaybackId)
      : null;
  return {
    id: e.id,
    classification: e.classification ? exerciseClassification.parse(e.classification) : null,
    name: e.name,
    category: e.category,
    tags: e.tags,
    aliases: e.aliases,
    cues: e.cues,
    defaultPrescription: prescriptionSchema.parse(e.defaultPrescription),
    strengthLoadKind: e.strengthLoadKind as ExerciseSummary["strengthLoadKind"],
    loadStepKg: Number(e.loadStepKg),
    media: stream && media ? { ...media, streamUrl: stream.mp4Url, hlsUrl: stream.hlsUrl } : media,
    shared: e.organizationId === null,
  };
};

export const listExercises = async (userId: string, organizationId: string): Promise<ExerciseSummary[]> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const rows = await prisma.exercise.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], deletedAt: null },
    orderBy: { name: "asc" },
    include: { media: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return Promise.all(rows.map(exerciseSummary));
};

// Fiche d'un exercice : réservée à l'encadrement, comme la bibliothèque.
export const getExercise = async (
  userId: string,
  organizationId: string,
  exerciseId: string,
): Promise<ExerciseSummary> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const row = await prisma.exercise.findFirst({
    where: { id: exerciseId, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
    include: { media: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!row) throw notFound();
  return exerciseSummary(row);
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
  let instagram: { instagramCode: string; customTitle: string | null } | null = null;
  if (input.media?.kind === "instagram") {
    const instagramCode = parseInstagramUrl(input.media.url);
    if (!instagramCode) throw invalid(m.exercises.linkInvalid);
    instagram = { instagramCode, customTitle: input.media.customTitle ?? null };
  }
  const data = {
    classification: input.classification === null ? Prisma.DbNull : input.classification,
    name: input.name,
    category: input.category,
    tags: input.tags,
    aliases: input.aliases === undefined ? undefined : cleanExerciseAliases(input.name, input.aliases),
    cues: input.cues,
    defaultPrescription: input.defaultPrescription,
    strengthLoadKind: input.strengthLoadKind,
    loadStepKg: input.loadStepKg,
  };
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    let id = input.id;
    if (id) {
      const existing = await tx.exercise.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!existing) throw notFound();
      if (input.strengthLoadKind !== undefined && input.strengthLoadKind !== existing.strengthLoadKind) {
        const [tests, references, sets] = await Promise.all([
          tx.strengthTest.count({ where: { exerciseId: id } }),
          tx.strengthReference.count({ where: { exerciseId: id } }),
          // Une case cochée ne mesure rien : seule une valeur saisie dépend de la convention.
          tx.setLog.count({
            where: {
              exerciseId: id,
              OR: [
                { reps: { not: null } },
                { loadKg: { not: null } },
                { distanceM: { not: null } },
                { timeS: { not: null } },
                { groundContacts: { not: null } },
              ],
            },
          }),
        ]);
        if (tests + references + sets > 0)
          throw new AppError(409, "exercise_convention_locked", m.strength.conventionLocked);
      }
      await tx.exercise.update({ where: { id }, data });
    } else {
      id = (await tx.exercise.create({ data: { ...data, organizationId, createdBy: userId } })).id;
    }
    // Lien effacé ou remplacé : l'ancien part. Une vidéo filmée par le coach n'est jamais touchée ici.
    if (input.media === null || youtube || instagram) {
      await tx.exerciseMedia.deleteMany({ where: { exerciseId: id, kind: { in: ["youtube", "instagram"] } } });
    }
    if (youtube) await tx.exerciseMedia.create({ data: { exerciseId: id, kind: "youtube", ...youtube } });
    if (instagram) await tx.exerciseMedia.create({ data: { exerciseId: id, kind: "instagram", ...instagram } });
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
  await assertVideoCapacity();
  await assertWithinPlan(organizationId, "maxVideosPerMonth");
  const media = await prisma.exerciseMedia.create({ data: { exerciseId, kind: "upload" } });
  const upload = await createDirectUpload(`exercise:${media.id}`);
  await prisma.exerciseMedia.update({ where: { id: media.id }, data: { muxUploadId: upload.uploadId } });
  return { mediaId: media.id, uploadUrl: upload.url };
};
