import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { visibleAthleteIds, type Access } from "./access";
import { blockedUserIds } from "./blocks.service";
import { consentForAthletes } from "./consent.service";

export const VIDEO_SELECT = {
  id: true,
  athleteId: true,
  uploadedBy: true,
  status: true,
  sharedGroupIds: true,
  reviewedAt: true,
  reviewedBy: true,
  uploadClientId: true,
  uploadGeneration: true,
  quotaReservedAt: true,
  muxUploadId: true,
  muxAssetId: true,
  muxPlaybackId: true,
  fps: true,
  timeScale: true,
  durationMs: true,
  recordedAt: true,
  sharedWithAthlete: true,
  sharedWithGroup: true,
  scheduledSessionId: true,
  exerciseId: true,
  exercise: { select: { name: true } },
  athlete: { select: { firstName: true, lastName: true, userId: true } },
  jumps: { select: { barHeightCm: true, attemptNo: true, result: true }, take: 1 },
  _count: { select: { annotations: true } },
} as const;

// Adaptateur interne, appelé uniquement après requireOrgMember. Partage explicite
// avec des groupes précis ; départ du groupe/espace ou retrait d'accord = révocation.
export const videoWhereFor = async (access: Access): Promise<Prisma.VideoWhereInput> => {
  const blocked = await blockedUserIds(access.userId);
  const base = { organizationId: access.organizationId, uploadedBy: { notIn: blocked } };
  if (access.role !== "athlete") return { ...base, athleteId: { in: await visibleAthleteIds(access) } };
  if (!access.athleteId) return { ...base, id: { in: [] } };
  const groups = await prisma.groupMember.findMany({
    where: { athleteId: access.athleteId, group: { organizationId: access.organizationId } },
    select: { groupId: true },
  });
  const peers = groups.length
    ? await prisma.athlete.findMany({
        where: {
          organizationId: access.organizationId,
          groups: { some: { groupId: { in: groups.map((g) => g.groupId) } } },
          userId: { notIn: blocked },
          user: { memberships: { some: { organizationId: access.organizationId, status: "active" } } },
        },
        select: { id: true, groups: { select: { groupId: true } } },
      })
    : [];
  const consent = await consentForAthletes(peers.map((p) => p.id));
  const shared = groups.map(({ groupId }): Prisma.VideoWhereInput => ({
    sharedWithGroup: true,
    sharedGroupIds: { has: groupId },
    athleteId: {
      in: peers.filter((p) => consent.get(p.id)?.video && p.groups.some((g) => g.groupId === groupId)).map((p) => p.id),
    },
  }));
  return {
    ...base,
    OR: [{ athleteId: access.athleteId, OR: [{ sharedWithAthlete: true }, { uploadedBy: access.userId }] }, ...shared],
  };
};

export const requireVideoAccess = async (access: Access, videoId: string) => {
  const video = await prisma.video.findFirst({
    where: { id: videoId, ...(await videoWhereFor(access)) },
    select: VIDEO_SELECT,
  });
  if (!video) throw notFound();
  return video;
};
