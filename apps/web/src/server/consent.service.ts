import { effectiveConsent, requiresParentalConsent, type ConsentState } from "@tartan/domain";
import type { ConsentKind } from "@tartan/contracts";
import { createElement } from "react";
import { ParentalConsentEmail } from "@email/auth";
import { env } from "@/lib/env";
import { fromDbDateOrNull } from "@/lib/dates";
import { invalid } from "@/lib/errors";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { deriveToken, idFromToken, sha256, tokenMatches } from "@/lib/tokens";
import { audit } from "./access";

export const CONSENT_VERSION = "2026-11";
const GUARDIAN_PURPOSE = "guardian";

export const setConsent = async (userId: string, kind: ConsentKind, granted: boolean, athleteId?: string | null) => {
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

export const getUserConsents = async (userId: string): Promise<{ health: boolean; video: boolean; terms: boolean }> => {
  const rows = await prisma.consent.findMany({ where: { userId } });
  const on = (kind: ConsentKind) => rows.some((r) => r.kind === kind && r.grantedAt && !r.revokedAt);
  return { health: on("health"), video: on("video"), terms: on("terms") };
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
    },
  });
  const userIds = athletes.map((a) => a.userId).filter((id): id is string => Boolean(id));
  const consents = await prisma.consent.findMany({ where: { userId: { in: userIds } } });
  const result = new Map<string, EffectiveConsent>();
  for (const a of athletes) {
    const on = (kind: ConsentKind) =>
      consents.some((c) => c.userId === a.userId && c.kind === kind && c.grantedAt && !c.revokedAt);
    const guardian = a.guardians[0];
    const state: ConsentState = {
      health: on("health"),
      video: on("video"),
      guardian: guardian ? guardian.consentStatus : "none",
      guardianScope: (guardian?.consentScope as ConsentState["guardianScope"]) ?? null,
    };
    result.set(a.id, { ...effectiveConsent(state), parentalPending: guardian?.consentStatus === "pending" });
  }
  return result;
};

export const startParentalConsent = async (input: {
  organizationId: string;
  athleteId: string;
  guardianEmail: string;
  athleteName: string;
  coachName: string;
}): Promise<void> => {
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

