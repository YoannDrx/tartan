import { createElement } from "react";
import { m } from "@tartan/i18n";
import { AthleteWelcomeEmail, InvitationReminderEmail } from "@email/lifecycle";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { invitationOptOutPageUrl, invitationOptOutUrl } from "./email-preferences.service";
import { invitationLink } from "./invitation-email";
import { namesFor } from "./me.service";

// Les e-mails de l'arrivée d'un athlète : la bienvenue après l'invitation acceptée, et un rappel unique
// quand une invitation nominative reste sans réponse. Rendus au moment de l'envoi, à partir d'identifiants.

const DAY_MS = 86_400_000;
const dateInParis = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(date);

export type AthleteWelcomePayload = { athleteId: string; invitedBy: string; groupId: string | null };

const welcomeContext = async (payload: unknown) => {
  const { athleteId, invitedBy, groupId } = payload as AthleteWelcomePayload;
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId ?? "" },
    select: {
      firstName: true,
      organizationId: true,
      organization: { select: { name: true } },
      user: { select: { email: true } },
    },
  });
  if (!athlete) return null;
  const [names, group] = await Promise.all([
    namesFor([invitedBy]),
    groupId ? prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }) : null,
  ]);
  return {
    athlete,
    coach: names.get(invitedBy) ?? athlete.organization.name,
    target: group?.name ?? athlete.organization.name,
  };
};

// La bienvenue ne part qu'à l'adresse du compte qui a rejoint, tant que sa fiche existe.
export const isAthleteWelcomeRelevant = async (payload: unknown, toEmail: string): Promise<boolean> =>
  (await welcomeContext(payload))?.athlete.user?.email === toEmail;

export const renderAthleteWelcome = async (payload: unknown) => {
  const context = await welcomeContext(payload);
  if (!context) throw new Error("athlete_missing");
  const copy = m.email.athleteWelcome;
  const title = copy.subject(context.target);
  return {
    subject: title,
    react: createElement(AthleteWelcomeEmail, {
      title,
      body: copy.body(context.athlete.firstName, context.coach),
      tip: copy.tip,
      cta: copy.cta,
      url: `${env().NEXT_PUBLIC_APP_URL}/accueil?espace=${context.athlete.organizationId}`,
    }),
  };
};

// Chaque matin : les invitations nominatives d'athlètes restées sans réponse depuis trois à cinq jours.
// La fenêtre part de la dernière action sur l'invitation : un renvoi par le coach repousse le rappel.
export const queueInvitationReminders = async (now: Date = new Date()): Promise<number> => {
  const invitations = await prisma.invitation.findMany({
    where: {
      kind: "personal_email",
      role: "athlete",
      status: { in: ["sent", "opened"] },
      email: { not: null },
      updatedAt: { gte: new Date(now.getTime() - 5 * DAY_MS), lt: new Date(now.getTime() - 3 * DAY_MS) },
      expiresAt: { gt: now },
    },
    select: { id: true, email: true, organizationId: true },
  });
  if (!invitations.length) return 0;
  const created = await prisma.emailOutbox.createMany({
    data: invitations.map((invitation) => ({
      organizationId: invitation.organizationId,
      toEmail: invitation.email!,
      kind: "invitation_reminder",
      // Une seule relance par invitation, quoi qu'il arrive ensuite.
      dedupeKey: `invitation:${invitation.id}:reminder`,
      payload: { invitationId: invitation.id },
    })),
    skipDuplicates: true,
  });
  return created.count;
};

export const renderInvitationReminder = async (payload: unknown) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: (payload as { invitationId: string }).invitationId ?? "" },
    include: { organization: { select: { name: true } } },
  });
  if (!invitation) throw new Error("invitation_missing");
  const [names, groups] = await Promise.all([
    namesFor([invitation.invitedBy]),
    prisma.group.findMany({ where: { id: { in: invitation.groupIds } }, select: { name: true } }),
  ]);
  const inviter = names.get(invitation.invitedBy) ?? invitation.organization.name;
  const target = groups[0]?.name ?? invitation.organization.name;
  const copy = m.email.invitationReminder;
  const title = copy.subject(inviter, target);
  return {
    subject: title,
    unsubscribeUrl: invitationOptOutUrl(invitation.id),
    react: createElement(InvitationReminderEmail, {
      title,
      body: invitation.expiresAt ? copy.body(dateInParis(invitation.expiresAt)) : copy.bodyOpen,
      cta: copy.cta,
      url: invitationLink(invitation.id),
      optOut: invitationOptOutPageUrl(invitation.id),
    }),
  };
};
