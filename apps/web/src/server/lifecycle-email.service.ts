import { createElement } from "react";
import {
  ACTIVATION_WINDOW_DAYS,
  activationEmailFor,
  coachNextStep,
  type ActivationDay,
  type CoachOnboardingFacts,
  type CoachStepKey,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { BillingNoticeEmail } from "@email/billing";
import { TipEmail } from "@email/lifecycle";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { unsubscribePageUrl, unsubscribeUrl } from "./email-preferences.service";

// Les e-mails d'activation et de plafond : la règle est dans @tartan/domain, ce service fournit les faits,
// met en file le jour dû, puis revérifie tout au moment de l'envoi.

const DAY_MS = 86_400_000;

// Les faits des premiers pas pour tout l'espace, sans regard d'un membre : réservé aux tâches planifiées.
export const coachOnboardingFacts = async (organizationId: string): Promise<CoachOnboardingFacts> => {
  const [invitations, athletes, sessions, publishedSessions, validations] = await Promise.all([
    prisma.invitation.count({ where: { organizationId, role: "athlete" } }),
    prisma.athlete.count({ where: { organizationId } }),
    prisma.scheduledSession.count({ where: { organizationId } }),
    prisma.scheduledSession.count({ where: { organizationId, publishedAt: { not: null } } }),
    prisma.sessionLog.count({
      where: { athlete: { organizationId }, status: { in: ["done", "partial"] } },
    }),
  ]);
  return { invitations, athletes, sessions, publishedSessions, validations };
};

export type ActivationPayload = { space: string; day: ActivationDay; step: CoachStepKey };

// Chaque matin : les espaces de moins de dix jours dont le coach n'a pas fini ses premiers pas.
export const queueActivationEmails = async (now: Date = new Date()): Promise<number> => {
  const spaces = await prisma.organization.findMany({
    where: {
      createdAt: {
        gte: new Date(now.getTime() - ACTIVATION_WINDOW_DAYS * DAY_MS),
        lt: new Date(now.getTime() - DAY_MS),
      },
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      owner: { select: { email: true, profile: { select: { emailTips: true } } } },
    },
  });
  let queued = 0;
  for (const space of spaces) {
    if (space.owner.profile?.emailTips === false) continue;
    const email = activationEmailFor(
      { id: space.id, createdAt: space.createdAt, facts: await coachOnboardingFacts(space.id) },
      now,
    );
    if (!email) continue;
    const created = await prisma.emailOutbox.createMany({
      data: [
        {
          organizationId: space.id,
          toEmail: space.owner.email,
          kind: "activation",
          dedupeKey: email.dedupeKey,
          payload: { space: space.name, day: email.day, step: email.step } satisfies ActivationPayload,
        },
      ],
      skipDuplicates: true,
    });
    queued += created.count;
  }
  return queued;
};

const STEP_PATH: Record<CoachStepKey, string> = {
  invite: "/reglages#invitations",
  create: "/seances/nouvelle",
  publish: "/calendrier",
  validate: "/suivi",
};

// Le conseil ne part que s'il est encore vrai : même propriétaire, conseils voulus, même étape manquante.
export const isActivationEmailRelevant = async (
  organizationId: string,
  payload: unknown,
  toEmail: string,
): Promise<boolean> => {
  const space = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { owner: { select: { email: true, profile: { select: { emailTips: true } } } } },
  });
  if (!space || space.owner.email !== toEmail || space.owner.profile?.emailTips === false) return false;
  return coachNextStep(await coachOnboardingFacts(organizationId)) === (payload as ActivationPayload).step;
};

export const renderActivationEmail = async (organizationId: string, payload: unknown) => {
  const { space, day, step } = payload as ActivationPayload;
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { ownerId: true },
  });
  const copy = m.email.activation.steps[step];
  const base = env().NEXT_PUBLIC_APP_URL;
  // Le lien ouvre le bon espace, même pour un coach qui en a plusieurs.
  const [path, hash] = STEP_PATH[step].split("#");
  return {
    subject: copy.subject,
    unsubscribeUrl: unsubscribeUrl(organization.ownerId, "tips"),
    react: createElement(TipEmail, {
      title: copy.subject,
      body: copy.body(space),
      // Au troisième rappel, l'aide humaine vaut mieux qu'une consigne de plus.
      help: day === 7 ? m.email.activation.help : undefined,
      cta: copy.cta,
      url: `${base}${path}?espace=${organizationId}${hash ? `#${hash}` : ""}`,
      space,
      unsubscribe: unsubscribePageUrl(organization.ownerId, "tips"),
    }),
  };
};

export type NearLimitKey = "maxAthletes" | "maxVideosPerMonth";
export type NearLimitPayload = { space: string; key: NearLimitKey; used: number; limit: number };

export const renderNearLimitEmail = (organizationId: string, payload: unknown) => {
  const { space, key, used, limit } = payload as NearLimitPayload;
  const copy = m.email.nearLimit[key];
  return {
    subject: copy.subject,
    react: createElement(BillingNoticeEmail, {
      title: copy.subject,
      body: copy.body(space, used, limit),
      cta: m.email.nearLimit.cta,
      url: `${env().NEXT_PUBLIC_APP_URL}/abonnement?espace=${organizationId}`,
    }),
  };
};
