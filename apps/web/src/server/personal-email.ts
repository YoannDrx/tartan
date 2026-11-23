import { createElement } from "react";
import {
  ACTIVATION_WINDOW_DAYS,
  FINISH_SIGNUP_AFTER_HOURS,
  FINISH_SIGNUP_WINDOW_HOURS,
  finishSignupDue,
  personalActivationEmailFor,
  personalActivationStep,
  type ActivationDay,
  type PersonalStepKey,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { FinishSignupEmail, PersonalTipEmail, PersonalWelcomeEmail } from "@email/personal";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { PERSONAL_STEP_PATH } from "@/lib/onboarding-paths";
import { prisma } from "@/lib/prisma";
import { unsubscribePageUrl, unsubscribeUrl } from "./email-preferences.service";
import { readPersonalFacts } from "./onboarding.service";

// Les e-mails de l'athlète autonome (docs/reference/emails.md) : bienvenue à l'ouverture de son espace personnel,
// conseils J1, J3 et J7 sur ses premiers pas, et « Termine ton inscription » pour un compte resté sans espace.
// Les règles sont dans @tartan/domain ; ce service met en file, puis revérifie tout au moment de l'envoi.
// Aucun ne porte de donnée de santé.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const t = w.personal.emails;

type WelcomePayload = { userId: string; organizationId: string };
export type PersonalActivationPayload = { day: ActivationDay; step: PersonalStepKey };
type FinishSignupPayload = { userId: string };

export const personalWelcomeKey = (userId: string) => `personal_welcome:${userId}`;

// ── Bienvenue ────────────────────────────────────────────────────────────────

// Mise en file dans la transaction qui crée l'espace : si elle échoue, rien ne part.
export const queuePersonalWelcome = async (
  tx: Prisma.TransactionClient,
  input: { organizationId: string; userId: string; email: string },
): Promise<void> => {
  await tx.emailOutbox.createMany({
    data: [
      {
        organizationId: input.organizationId,
        toEmail: input.email,
        kind: "personal_welcome",
        dedupeKey: personalWelcomeKey(input.userId),
        payload: { userId: input.userId, organizationId: input.organizationId } satisfies WelcomePayload,
      },
    ],
    skipDuplicates: true,
  });
};

export const isPersonalWelcomeRelevant = async (payload: unknown, toEmail: string): Promise<boolean> => {
  const { userId, organizationId } = payload as WelcomePayload;
  const space = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { personalOwnerId: true, owner: { select: { email: true } } },
  });
  return space?.personalOwnerId === userId && space.owner.email === toEmail;
};

export const renderPersonalWelcome = (payload: unknown) => {
  const { organizationId } = payload as WelcomePayload;
  return {
    subject: t.welcome.subject,
    react: createElement(PersonalWelcomeEmail, {
      url: `${env().NEXT_PUBLIC_APP_URL}${PERSONAL_STEP_PATH.plan}?espace=${organizationId}`,
    }),
  };
};

// ── Conseils J1, J3, J7 ──────────────────────────────────────────────────────

// Chaque matin : les espaces personnels de moins de dix jours dont l'athlète n'a pas fini ses premiers pas.
export const queuePersonalActivationEmails = async (now: Date = new Date()): Promise<number> => {
  const spaces = await prisma.organization.findMany({
    where: {
      kind: "personal",
      isDemo: false,
      createdAt: {
        gte: new Date(now.getTime() - ACTIVATION_WINDOW_DAYS * DAY_MS),
        lt: new Date(now.getTime() - DAY_MS),
      },
    },
    select: {
      id: true,
      createdAt: true,
      personalOwnerId: true,
      owner: { select: { email: true, profile: { select: { emailTips: true } } } },
    },
  });
  let queued = 0;
  for (const space of spaces) {
    if (!space.personalOwnerId || space.owner.profile?.emailTips === false) continue;
    const athlete = await prisma.athlete.findUnique({
      where: { organizationId_userId: { organizationId: space.id, userId: space.personalOwnerId } },
      select: { id: true },
    });
    if (!athlete) continue;
    const facts = await readPersonalFacts(space.id, space.personalOwnerId, athlete.id);
    const email = personalActivationEmailFor({ id: space.id, createdAt: space.createdAt, facts }, now);
    if (!email) continue;
    const created = await prisma.emailOutbox.createMany({
      data: [
        {
          organizationId: space.id,
          toEmail: space.owner.email,
          kind: "personal_activation",
          dedupeKey: email.dedupeKey,
          payload: { day: email.day, step: email.step } satisfies PersonalActivationPayload,
        },
      ],
      skipDuplicates: true,
    });
    queued += created.count;
  }
  return queued;
};

const personalOwner = (organizationId: string) =>
  prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      kind: true,
      personalOwnerId: true,
      owner: { select: { email: true, profile: { select: { emailTips: true } } } },
    },
  });

// Le conseil ne part que s'il est encore vrai : même titulaire, conseils voulus, même étape manquante.
export const isPersonalActivationRelevant = async (
  organizationId: string,
  payload: unknown,
  toEmail: string,
): Promise<boolean> => {
  const space = await personalOwner(organizationId);
  if (!space?.personalOwnerId || space.kind !== "personal") return false;
  if (space.owner.email !== toEmail || space.owner.profile?.emailTips === false) return false;
  const athlete = await prisma.athlete.findUnique({
    where: { organizationId_userId: { organizationId, userId: space.personalOwnerId } },
    select: { id: true },
  });
  if (!athlete) return false;
  const facts = await readPersonalFacts(organizationId, space.personalOwnerId, athlete.id);
  return personalActivationStep(facts) === (payload as PersonalActivationPayload).step;
};

export const renderPersonalActivation = async (organizationId: string, payload: unknown) => {
  const { day, step } = payload as PersonalActivationPayload;
  const space = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { ownerId: true },
  });
  // `install` ne vaut pas un e-mail (`personalActivationStep`) : il n'arrive jamais ici.
  const copy = t.activation.steps[step as Exclude<PersonalStepKey, "install">];
  const [path, hash] = PERSONAL_STEP_PATH[step].split("#");
  return {
    subject: copy.subject,
    unsubscribeUrl: unsubscribeUrl(space.ownerId, "tips"),
    react: createElement(PersonalTipEmail, {
      title: copy.subject,
      body: copy.body,
      help: day === 7 ? t.activation.help : undefined,
      cta: copy.cta,
      url: `${env().NEXT_PUBLIC_APP_URL}${path}?espace=${organizationId}${hash ? `#${hash}` : ""}`,
      unsubscribe: unsubscribePageUrl(space.ownerId, "tips"),
      unsubscribeLabel: m.email.unsubscribeLink,
    }),
  };
};

// ── Termine ton inscription ──────────────────────────────────────────────────

const openInvitations = (email: string, now: Date) =>
  prisma.invitation.count({
    where: {
      email: email.toLowerCase(),
      status: { in: ["sent", "opened"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

// Chaque heure : un compte confirmé, créé il y a 24 à 72 heures, sans espace ni invitation ouverte. Une fois.
export const queueFinishSignupEmails = async (now: Date = new Date()): Promise<number> => {
  const accounts = await prisma.user.findMany({
    where: {
      emailVerified: true,
      suspendedAt: null,
      createdAt: {
        gte: new Date(now.getTime() - (FINISH_SIGNUP_AFTER_HOURS + FINISH_SIGNUP_WINDOW_HOURS) * HOUR_MS),
        lte: new Date(now.getTime() - FINISH_SIGNUP_AFTER_HOURS * HOUR_MS),
      },
      memberships: { none: {} },
    },
    select: { id: true, email: true, createdAt: true },
    take: 500,
  });
  let queued = 0;
  for (const account of accounts) {
    if (account.email.endsWith("@demo.tartan.coach")) continue;
    const due = finishSignupDue(
      { createdAt: account.createdAt, spaces: 0, openInvitations: await openInvitations(account.email, now) },
      now,
    );
    if (!due) continue;
    const created = await prisma.emailOutbox.createMany({
      data: [
        {
          organizationId: null,
          toEmail: account.email,
          kind: "finish_signup",
          dedupeKey: `finish_signup:${account.id}`,
          payload: { userId: account.id } satisfies FinishSignupPayload,
        },
      ],
      skipDuplicates: true,
    });
    queued += created.count;
  }
  return queued;
};

// Revérifié à l'envoi : un espace rejoint ou ouvert entre-temps, et le message n'a plus d'objet.
export const isFinishSignupRelevant = async (payload: unknown, toEmail: string, now = new Date()): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: (payload as FinishSignupPayload).userId },
    select: { email: true, _count: { select: { memberships: true } } },
  });
  if (!user || user.email !== toEmail || user._count.memberships > 0) return false;
  return (await openInvitations(user.email, now)) === 0;
};

export const renderFinishSignup = () => ({
  subject: t.finishSignup.subject,
  react: createElement(FinishSignupEmail, { url: `${env().NEXT_PUBLIC_APP_URL}/bienvenue` }),
});
