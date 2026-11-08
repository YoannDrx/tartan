import { env } from "@/lib/env";
import { signedPlayback, videoEnabled } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit } from "./access";

const sharedPhases = {
  where: { publishedAt: { not: null }, deletedAt: null },
  select: { name: true, kind: true, startDate: true, endDate: true, objective: true, description: true },
} as const;

// Droit d'accès et de portabilité (art. 15 et 20 RGPD, § 15.4) : tout ce qui concerne l'utilisateur,
// jamais les notes privées d'un coach à son sujet, qui restent des données du coach.
export const exportMyData = async (userId: string) => {
  await enforceRateLimit(`export:${userId}`, 5, 3600);
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
      athleteConsents: { select: { kind: true, version: true, grantedAt: true, revokedAt: true } },
      groups: { select: { group: { select: { name: true, trainingPhases: sharedPhases } } } },
      trainingPhases: sharedPhases,
      tests: { select: { exerciseKey: true, exerciseId: true, loadKind: true, value: true, kind: true, date: true } },
      strengthReferences: {
        select: { exerciseId: true, valueKg: true, kind: true, loadKind: true, sourceTestId: true, selectedAt: true },
      },
      prescriptions: {
        select: { scheduledSessionId: true, sessionVersion: true, snapshot: true, origin: true, frozenAt: true },
      },
      performances: {
        select: {
          discipline: true,
          mark: true,
          unit: true,
          wind: true,
          date: true,
          location: true,
          isPb: true,
          measurementType: true,
          recordDirection: true,
          comparisonContext: true,
        },
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
          sessionVersion: true,
          prescriptionSnapshot: true,
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
              setKind: true,
              loadKind: true,
              repetitionScope: true,
              sideCount: true,
              groundContacts: true,
            },
          },
        },
      },
      // Le droit d'accès couvre aussi les vidéos que le coach n'a pas encore partagées.
      videos: {
        select: {
          recordedAt: true,
          fps: true,
          durationMs: true,
          sharedWithAthlete: true,
          muxPlaybackId: true,
          annotations: { select: { tMs: true, phase: true, text: true } },
        },
      },
    },
  });
  const [
    comments,
    memberships,
    videosUploaded,
    announcements,
    notifications,
    devices,
    sessions,
    satisfaction,
    referrals,
  ] = await Promise.all([
    prisma.comment.findMany({ where: { authorId: userId }, select: { entityType: true, body: true, createdAt: true } }),
    prisma.organizationMember.findMany({
      where: { userId },
      select: { role: true, status: true, organization: { select: { name: true } } },
    }),
    prisma.video.count({ where: { uploadedBy: userId } }),
    prisma.announcement.findMany({ where: { authorId: userId }, select: { body: true, createdAt: true } }),
    prisma.notification.findMany({ where: { userId }, select: { type: true, createdAt: true, sentAt: true } }),
    // Plateforme et date seulement : un jeton d'appareil ou de session ne doit pas sortir.
    prisma.device.findMany({ where: { userId }, select: { platform: true, createdAt: true } }),
    prisma.session.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true } }),
    prisma.satisfactionAnswer.findMany({
      where: { userId },
      select: { recommend: true, comment: true, createdAt: true },
    }),
    prisma.referral.findMany({ where: { referredUserId: userId }, select: { status: true, createdAt: true } }),
  ]);
  const signing = videoEnabled() && Boolean(env().MUX_SIGNING_KEY_ID);
  const withLinks = await Promise.all(
    athletes.map(async ({ videos, ...athlete }) => ({
      ...athlete,
      videos: await Promise.all(
        videos.map(async ({ muxPlaybackId, ...video }) => ({
          ...video,
          // Valable 1 heure, comme toute lecture signée.
          downloadUrl: signing && muxPlaybackId ? (await signedPlayback(muxPlaybackId)).mp4Url : null,
        })),
      ),
    })),
  );
  await audit({ actorId: userId, action: "data_exported", entity: "user" });
  return {
    exportedAt: new Date().toISOString(),
    notifications,
    devices,
    sessions,
    satisfaction,
    referrals,
    user,
    memberships,
    athletes: withLinks,
    comments,
    announcements,
    videosUploaded,
  };
};
