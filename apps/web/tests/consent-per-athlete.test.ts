import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { logSession } from "@/server/athlete-view.service";
import {
  consentForAthletes,
  getUserConsents,
  purgeRevokedConsentVideos,
  setAthleteConsent,
  setConsent,
} from "@/server/consent.service";
import { acceptInvitation, groupInvitationLink } from "@/server/invitation.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { getVideo, renewVideoUpload } from "@/server/video.service";
import { addAthlete, makeOrg } from "./helpers";

const accept = { firstName: "Léa", lastName: "Test", birthDate: "2000-01-01" };
const prepare = async () => {
  const a = await makeOrg("Club");
  const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
  return { a, athlete };
};
const session = async (org: Awaited<ReturnType<typeof makeOrg>>) => {
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const saved = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: "2030-06-10",
    startTime: "18:00",
    location: "Stade",
    publishAt: null,
    draft: {
      title: "Séance",
      type: "strength",
      durationMin: 60,
      coachNote: null,
      blocks: [{ name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3 } }] }],
    },
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
  });
  await publishRow(saved.id, org.owner.userId, new Date("2020-01-01T10:00:00Z"), { silent: true });
  return saved;
};
const pain = { bodyArea: "knee", side: "left", intensity: 5 };
const log = (extra: object = {}) => ({
  clientId: randomUUID(),
  status: "done" as const,
  variantDone: "club" as const,
  sets: [],
  ...extra,
});

describe("consentement par fiche", () => {
  it("un refus dans l'espace B est sans effet sur l'accord donné à l'espace A", async () => {
    const { athlete } = await prepare();
    const b = await makeOrg("Préparateur");
    const { link } = await groupInvitationLink(b.owner.userId, b.organizationId, b.groupId);
    const joined = await acceptInvitation(athlete, link.split("/").at(-1)!, {
      ...accept,
      consents: { terms: true, health: false, video: false },
    });
    const consents = await consentForAthletes([athlete.athleteId, joined.athleteId!]);
    expect(consents.get(athlete.athleteId)).toMatchObject({ health: true, video: true });
    expect(consents.get(joined.athleteId!)).toMatchObject({ health: false, video: false });
  });
  it("retirer dans un espace ne touche pas l'autre", async () => {
    const { athlete, a } = await prepare();
    const b = await makeOrg("Préparateur");
    const { link } = await groupInvitationLink(b.owner.userId, b.organizationId, b.groupId);
    const joined = await acceptInvitation(athlete, link.split("/").at(-1)!, {
      ...accept,
      consents: { terms: true, health: true, video: true },
    });
    await setAthleteConsent(athlete.userId, a.organizationId, "health", false);
    const consents = await consentForAthletes([athlete.athleteId, joined.athleteId!]);
    expect(consents.get(athlete.athleteId)?.health).toBe(false);
    expect(consents.get(joined.athleteId!)?.health).toBe(true);
  });
  it("l'ancienne route : retirer vaut partout, accorder à plusieurs fiches est refusé", async () => {
    const { athlete } = await prepare();
    const b = await makeOrg("Préparateur");
    const { link } = await groupInvitationLink(b.owner.userId, b.organizationId, b.groupId);
    const joined = await acceptInvitation(athlete, link.split("/").at(-1)!, {
      ...accept,
      consents: { terms: true, health: true, video: true },
    });
    await setConsent(athlete.userId, "health", false);
    const consents = await consentForAthletes([athlete.athleteId, joined.athleteId!]);
    expect(consents.get(athlete.athleteId)?.health).toBe(false);
    expect(consents.get(joined.athleteId!)?.health).toBe(false);
    await expect(setConsent(athlete.userId, "health", true)).rejects.toMatchObject({
      status: 409,
      code: "consent_scope_required",
    });
  });
  it("une seule fiche : l'ancienne route accorde encore", async () => {
    const { athlete } = await prepare();
    await setConsent(athlete.userId, "health", false);
    await setConsent(athlete.userId, "health", true);
    expect(await getUserConsents(athlete.userId)).toMatchObject({ health: true });
  });
  it("supprimer une fiche garde l'accord du compte aux conditions", async () => {
    const { athlete } = await prepare();
    await prisma.athlete.delete({ where: { id: athlete.athleteId } });
    expect(await getUserConsents(athlete.userId)).toMatchObject({ terms: true });
  });
});

describe("retrait de l'accord santé", () => {
  it("efface effort, douleur, blessures, alertes ; un nouvel accord ne rend rien", async () => {
    const { a, athlete } = await prepare();
    const s = await session(a);
    await logSession(athlete.userId, a.organizationId, s.id, log({ rpe: 8, pain }));
    await prisma.injury.create({
      data: {
        organizationId: a.organizationId,
        athleteId: athlete.athleteId,
        bodyArea: "knee",
        side: "left",
        startDate: new Date("2030-01-01T00:00:00Z"),
        status: "active",
      },
    });
    expect(await prisma.notification.count({ where: { type: "pain_alert", userId: a.owner.userId } })).toBeGreaterThan(
      0,
    );

    await setAthleteConsent(athlete.userId, a.organizationId, "health", false);
    const row = await prisma.sessionLog.findFirstOrThrow({ where: { athleteId: athlete.athleteId } });
    expect(row.rpe).toBeNull();
    expect(row.pain).toBeNull();
    expect(row.status).toBe("done");
    expect(await prisma.injury.count({ where: { athleteId: athlete.athleteId } })).toBe(0);
    expect(await prisma.notification.count({ where: { type: "pain_alert", userId: a.owner.userId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "health_erased", entityId: athlete.athleteId } })).toBe(1);

    await setAthleteConsent(athlete.userId, a.organizationId, "health", true);
    const again = await prisma.sessionLog.findFirstOrThrow({ where: { athleteId: athlete.athleteId } });
    expect(again.rpe).toBeNull();
  });
  it("le rejeu hors ligne d'un effort après le retrait n'enregistre rien", async () => {
    const { a, athlete } = await prepare();
    const s = await session(a);
    await setAthleteConsent(athlete.userId, a.organizationId, "health", false);
    await logSession(athlete.userId, a.organizationId, s.id, log({ rpe: 9, pain }));
    const row = await prisma.sessionLog.findFirstOrThrow({ where: { athleteId: athlete.athleteId } });
    expect(row.rpe).toBeNull();
    expect(row.pain).toBeNull();
  });
});

describe("retrait de l'accord vidéo", () => {
  const video = (a: Awaited<ReturnType<typeof makeOrg>>, athleteId: string, status: "ready" | "uploading" = "ready") =>
    prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId,
        uploadedBy: a.owner.userId,
        status,
        muxPlaybackId: "lecture-1",
        muxAssetId: `asset-${randomUUID()}`,
      },
    });
  it("le coach ne voit plus la lecture, et ne peut plus relancer un envoi", async () => {
    const { a, athlete } = await prepare();
    const v = await video(a, athlete.athleteId);
    const pending = await video(a, athlete.athleteId, "uploading");
    await setAthleteConsent(athlete.userId, a.organizationId, "video", false);
    const seen = await getVideo(a.owner.userId, a.organizationId, v.id);
    expect(seen.playbackId).toBeNull();
    expect(seen.consentRevoked).toBe(true);
    await expect(renewVideoUpload(a.owner.userId, a.organizationId, pending.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("effacement 30 jours après, sauf si l'accord revient", async () => {
    const { a, athlete } = await prepare();
    const gone = await video(a, athlete.athleteId);
    await setAthleteConsent(athlete.userId, a.organizationId, "video", false);
    const kept = () => prisma.video.count({ where: { id: gone.id } });
    await purgeRevokedConsentVideos(new Date(Date.now() + 29 * 86_400_000));
    expect(await kept()).toBe(1);
    await setAthleteConsent(athlete.userId, a.organizationId, "video", true);
    await purgeRevokedConsentVideos(new Date(Date.now() + 31 * 86_400_000));
    expect(await kept()).toBe(1);
    await setAthleteConsent(athlete.userId, a.organizationId, "video", false);
    await purgeRevokedConsentVideos(new Date(Date.now() + 31 * 86_400_000));
    expect(await prisma.video.count({ where: { id: gone.id } })).toBe(0);
    expect(await prisma.externalDeletion.count({ where: { externalRef: gone.muxAssetId as string } })).toBe(1);
  });
});
