import { Prisma } from "@/generated/prisma/client";
import { effectiveConsent, requiresParentalConsent, type ConsentState } from "@tartan/domain";
import type { ConsentKind } from "@tartan/contracts";
import { createElement } from "react";
import { ParentalConsentEmail } from "@email/auth";
import { env } from "@/lib/env";
import { fromDbDateOrNull } from "@/lib/dates";
import { AppError, forbidden, invalid } from "@/lib/errors";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { deriveToken, idFromToken, sha256, tokenMatches } from "@/lib/tokens";
import { m } from "@tartan/i18n";
import { audit } from "./access";
import { parentalFlowEnabled } from "./age.service";

export const CONSENT_VERSION = "2026-11-2";
const GUARDIAN_PURPOSE = "guardian";

const writeAccountConsent = async (
  userId: string,
  kind: ConsentKind,
  granted: boolean,
  athleteId?: string | null,
): Promise<void> => {
  const now = new Date();
  await prisma.consent.upsert({
    where: { userId_kind: { userId, kind } },
    create: {
      userId,
      kind,
      version: CONSENT_VERSION,
      athleteId: athleteId ?? null,
      grantedAt: granted ? now : null,
      revokedAt: granted ? null : now,
    },
    update: {
      version: CONSENT_VERSION,
      grantedAt: granted ? now : undefined,
      revokedAt: granted ? null : now,
    },
  });
  await audit({ actorId: userId, action: granted ? "consent_granted" : "consent_revoked", entity: `consent_${kind}` });
};

// Retrait de l'accord santé : les données disparaissent aussitôt, dans une seule transaction.
const eraseHealthData = async (athleteId: string, organizationId: string, actorId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.sessionLog.updateMany({ where: { athleteId }, data: { rpe: null, pain: Prisma.DbNull } });
    await tx.injury.deleteMany({ where: { athleteId } });
    await tx.wellnessCheckin.deleteMany({ where: { athleteId } });
    await tx.notification.deleteMany({
      where: { type: "pain_alert", payload: { path: ["link"], equals: `/athletes/${athleteId}` } },
    });
    await tx.auditLog.create({
      data: { organizationId, actorId, action: "health_erased", entity: "athlete", entityId: athleteId },
    });
  });
};

const applyAthleteConsent = async (
  athlete: { id: string; organizationId: string },
  userId: string,
  kind: "health" | "video",
  granted: boolean,
): Promise<void> => {
  const now = new Date();
  const previous = await prisma.athleteConsent.findUnique({
    where: { athleteId_kind: { athleteId: athlete.id, kind } },
    select: { grantedAt: true, revokedAt: true },
  });
  const wasGranted = Boolean(previous?.grantedAt && !previous.revokedAt);
  await prisma.athleteConsent.upsert({
    where: { athleteId_kind: { athleteId: athlete.id, kind } },
    create: {
      athleteId: athlete.id,
      kind,
      version: CONSENT_VERSION,
      grantedAt: granted ? now : null,
      revokedAt: granted ? null : now,
    },
    update: { version: CONSENT_VERSION, grantedAt: granted ? now : undefined, revokedAt: granted ? null : now },
  });
  await audit({
    organizationId: athlete.organizationId,
    actorId: userId,
    action: granted ? "consent_granted" : "consent_revoked",
    entity: `consent_${kind}`,
    entityId: athlete.id,
  });
  if (!granted && wasGranted && kind === "health") await eraseHealthData(athlete.id, athlete.organizationId, userId);
};

const fichesOf = (userId: string) =>
  prisma.athlete.findMany({ where: { userId }, select: { id: true, organizationId: true } });

// Pas de requireOrgMember ici : retirer un accord reste possible même pour un compte dont l'accès est fermé.
// La fiche est cherchée par son propriétaire, ce qui suffit à vérifier l'appartenance.
export const setAthleteConsent = async (
  userId: string,
  organizationId: string,
  kind: "health" | "video",
  granted: boolean,
): Promise<void> => {
  const athlete = await prisma.athlete.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true, organizationId: true },
  });
  if (!athlete) throw forbidden();
  await applyAthleteConsent(athlete, userId, kind, granted);
  // L'ancienne table reste à jour pour un compte à fiche unique, le temps de la transition.
  if ((await fichesOf(userId)).length === 1) await writeAccountConsent(userId, kind, granted, athlete.id);
};

// Ancien point d'entrée. Retirer vaut partout ; accorder n'a de sens qu'avec une seule fiche.
export const setConsent = async (
  userId: string,
  kind: ConsentKind,
  granted: boolean,
  athleteId?: string | null,
): Promise<void> => {
  if (kind === "terms") return writeAccountConsent(userId, kind, granted, athleteId);
  const fiches = await fichesOf(userId);
  const targets = athleteId ? fiches.filter((fiche) => fiche.id === athleteId) : fiches;
  if (granted && !athleteId && fiches.length > 1) {
    throw new AppError(409, "consent_scope_required", m.settings.consentPerSpace);
  }
  for (const fiche of targets) await applyAthleteConsent(fiche, userId, kind, granted);
  if (fiches.length <= 1 || !granted) await writeAccountConsent(userId, kind, granted, athleteId);
};

export const getUserConsents = async (userId: string): Promise<{ health: boolean; video: boolean; terms: boolean }> => {
  const [account, athleteRows] = await Promise.all([
    prisma.consent.findMany({ where: { userId } }),
    prisma.athleteConsent.findMany({ where: { athlete: { userId } } }),
  ]);
  const on = (kind: ConsentKind) =>
    athleteRows.some((r) => r.kind === kind && r.grantedAt && !r.revokedAt) ||
    (athleteRows.length === 0 && account.some((r) => r.kind === kind && r.grantedAt && !r.revokedAt));
  return {
    health: on("health"),
    video: on("video"),
    terms: account.some((r) => r.kind === "terms" && r.grantedAt && !r.revokedAt),
  };
};

export const athleteConsentState = async (athleteId: string): Promise<{ health: boolean; video: boolean }> => {
  const rows = await prisma.athleteConsent.findMany({ where: { athleteId } });
  const on = (kind: ConsentKind) => rows.some((r) => r.kind === kind && r.grantedAt && !r.revokedAt);
  return { health: on("health"), video: on("video") };
};

// Trente jours après le retrait de l'accord vidéo, les vidéos partent : un nouvel accord avant cette date les garde.
const VIDEO_REVOKED_DAYS = 30;
export const purgeRevokedConsentVideos = async (now: Date = new Date()): Promise<number> => {
  const expired = await prisma.athleteConsent.findMany({
    where: {
      kind: "video",
      revokedAt: { lte: new Date(now.getTime() - VIDEO_REVOKED_DAYS * 86_400_000) },
    },
    select: { athleteId: true },
  });
  if (expired.length === 0) return 0;
  const { count } = await prisma.video.deleteMany({ where: { athleteId: { in: expired.map((e) => e.athleteId) } } });
  return count;
};

export type EffectiveConsent = { health: boolean; video: boolean; parentalPending: boolean };

// Consentement réel d'athlètes : le leur, combiné à celui du parent sous 15 ans.
export const consentForAthletes = async (athleteIds: string[]): Promise<Map<string, EffectiveConsent>> => {
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: athleteIds } },
    select: {
      id: true,
      userId: true,
      guardians: { select: { consentStatus: true, consentScope: true }, orderBy: { createdAt: "desc" }, take: 1 },
      athleteConsents: { select: { kind: true, grantedAt: true, revokedAt: true } },
    },
  });
  const result = new Map<string, EffectiveConsent>();
  for (const a of athletes) {
    const on = (kind: ConsentKind) => a.athleteConsents.some((c) => c.kind === kind && c.grantedAt && !c.revokedAt);
    const guardian = a.guardians[0];
    const state: ConsentState = {
      health: on("health"),
      video: on("video"),
      guardian: guardian ? guardian.consentStatus : "none",
      guardianScope: (guardian?.consentScope as ConsentState["guardianScope"]) ?? null,
    };
    result.set(a.id, {
      ...effectiveConsent(state),
      // Bandeaux inertes tant que le parcours est dormant.
      parentalPending: parentalFlowEnabled() && guardian?.consentStatus === "pending",
    });
  }
  return result;
};

const assertParentalFlow = (): void => {
  if (!parentalFlowEnabled()) throw invalid(m.age.parentalClosed);
};

export const startParentalConsent = async (input: {
  organizationId: string;
  athleteId: string;
  guardianEmail: string;
  athleteName: string;
  coachName: string;
}): Promise<void> => {
  assertParentalFlow();
  const guardian = await prisma.guardian.create({
    data: {
      organizationId: input.organizationId,
      athleteId: input.athleteId,
      guardianEmail: input.guardianEmail.toLowerCase(),
      consentStatus: "pending",
      tokenExpiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    },
  });
  const token = deriveToken(GUARDIAN_PURPOSE, guardian.id);
  await prisma.guardian.update({ where: { id: guardian.id }, data: { tokenHash: sha256(token) } });
  await sendEmail({
    to: input.guardianEmail,
    subject: `Ton accord est demandé pour ${input.athleteName}`,
    react: createElement(ParentalConsentEmail, {
      url: `${env().NEXT_PUBLIC_APP_URL}/accord-parental/${token}`,
      athlete: input.athleteName,
      coach: input.coachName,
    }),
  });
};

// Le parent n'a pas répondu : l'athlète relance sa demande, sans attendre son coach.
export const resendParentalConsent = async (userId: string, organizationId: string): Promise<void> => {
  assertParentalFlow();
  await enforceRateLimit(`parental:${userId}`, 3, 3600);
  const athlete = await prisma.athlete.findFirst({
    where: { userId, organizationId },
    select: {
      firstName: true,
      organization: { select: { name: true } },
      guardians: { where: { consentStatus: "pending" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const guardian = athlete?.guardians[0];
  if (!athlete || !guardian) throw invalid("Aucune demande en attente.");
  await prisma.guardian.update({
    where: { id: guardian.id },
    data: { tokenExpiresAt: new Date(Date.now() + 30 * 86400 * 1000) },
  });
  await sendEmail({
    to: guardian.guardianEmail,
    subject: `Ton accord est demandé pour ${athlete.firstName}`,
    react: createElement(ParentalConsentEmail, {
      url: `${env().NEXT_PUBLIC_APP_URL}/accord-parental/${deriveToken(GUARDIAN_PURPOSE, guardian.id)}`,
      athlete: athlete.firstName,
      coach: athlete.organization.name,
    }),
  });
};

const guardianFromToken = async (token: string) => {
  if (!tokenMatches(GUARDIAN_PURPOSE, token) || !idFromToken(token)) return null;
  const guardian = await prisma.guardian.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      athlete: { select: { firstName: true, organization: { select: { owner: { select: { name: true } } } } } },
    },
  });
  if (!guardian || (guardian.tokenExpiresAt && guardian.tokenExpiresAt < new Date())) return null;
  return guardian;
};

export const previewParentalConsent = async (token: string) => {
  const guardian = await guardianFromToken(token);
  if (!guardian) return null;
  return {
    athleteFirstName: guardian.athlete.firstName,
    coachName: guardian.athlete.organization.owner.name,
    status: guardian.consentStatus,
  };
};

export const answerParentalConsent = async (input: {
  token: string;
  decision: "granted" | "refused";
  scope: { health: boolean; video: boolean };
}): Promise<void> => {
  assertParentalFlow();
  const guardian = await guardianFromToken(input.token);
  if (!guardian) throw invalid();
  await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      consentStatus: input.decision,
      consentAt: new Date(),
      consentScope: input.decision === "granted" ? input.scope : { health: false, video: false },
    },
  });
  await audit({
    organizationId: guardian.organizationId,
    action: `parental_consent_${input.decision}`,
    entity: "guardian",
    entityId: guardian.id,
  });
};
