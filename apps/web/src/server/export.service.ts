import { prisma } from "@/lib/prisma";
import { audit } from "./access";

// Droit d'accès et de portabilité (art. 15 et 20 RGPD, § 15.4) : tout ce qui concerne l'utilisateur,
// jamais les notes privées d'un coach à son sujet, qui restent des données du coach.
export const exportMyData = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true, profile: true, consents: true },
  });
  const athletes = await prisma.athlete.findMany({
    where: { userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      disciplines: true,
      level: true,
      takeoffFoot: true,
      approachSteps: true,
      goals: true,
      particularities: true,
      organization: { select: { name: true } },
      groups: { select: { group: { select: { name: true } } } },
      tests: { select: { exerciseKey: true, value: true, kind: true, date: true } },
      performances: {
        select: { discipline: true, mark: true, unit: true, wind: true, date: true, location: true, isPb: true },
      },
      injuries: {
        select: {
          bodyArea: true,
          side: true,
          description: true,
          startDate: true,
          endDate: true,
          status: true,
          restrictions: true,
        },
      },
      wellness: { select: { date: true, sleep: true, fatigue: true, soreness: true } },
      jumps: { select: { barHeightCm: true, attemptNo: true, result: true, approachSteps: true, createdAt: true } },
      attendance: { select: { status: true, source: true, session: { select: { title: true, date: true } } } },
      logs: {
        select: {
          status: true,
          variantDone: true,
          rpe: true,
          durationMin: true,
          comment: true,
          pain: true,
          completedAt: true,
          session: { select: { title: true, date: true, type: true } },
          sets: {
            select: {
              itemRef: true,
              setIndex: true,
              reps: true,
              loadKg: true,
              distanceM: true,
              timeS: true,
              done: true,
            },
          },
        },
      },
      videos: {
        where: { sharedWithAthlete: true },
        select: {
          recordedAt: true,
          fps: true,
          durationMs: true,
          annotations: { select: { tMs: true, phase: true, text: true } },
        },
      },
    },
  });
  const [comments, memberships, videosUploaded, announcements] = await Promise.all([
    prisma.comment.findMany({ where: { authorId: userId }, select: { entityType: true, body: true, createdAt: true } }),
    prisma.organizationMember.findMany({
      where: { userId },
      select: { role: true, status: true, organization: { select: { name: true } } },
    }),
    prisma.video.count({ where: { uploadedBy: userId } }),
    prisma.announcement.findMany({ where: { authorId: userId }, select: { body: true, createdAt: true } }),
  ]);
  await audit({ actorId: userId, action: "data_exported", entity: "user" });
  return { exportedAt: new Date().toISOString(), user, memberships, athletes, comments, announcements, videosUploaded };
};
