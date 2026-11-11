import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { deriveToken, idFromToken, tokenMatches } from "@/lib/tokens";
import { suppressEmail } from "./email-suppression.service";

export const EMAIL_KINDS = ["digest", "notifications", "tips"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

const purpose = (kind: EmailKind): string => `email-unsubscribe:${kind}`;
const columns = { digest: "emailDigest", notifications: "emailNotifications", tips: "emailTips" } as const;

export const isEmailKind = (value: string): value is EmailKind => (EMAIL_KINDS as readonly string[]).includes(value);

const tokenFor = (userId: string, kind: EmailKind): string => deriveToken(purpose(kind), userId);

// L'adresse de la page : elle explique et demande confirmation, son affichage ne change rien.
export const unsubscribePageUrl = (userId: string, kind: EmailKind): string =>
  `${env().NEXT_PUBLIC_APP_URL}/e-mails/${kind}/${tokenFor(userId, kind)}`;

// L'adresse de l'en-tête List-Unsubscribe : un POST du client de messagerie, sans session.
export const unsubscribeUrl = (userId: string, kind: EmailKind): string =>
  `${env().NEXT_PUBLIC_APP_URL}/api/email/desinscription/${kind}/${tokenFor(userId, kind)}`;

// Une personne invitée n'a pas de compte : son opposition porte sur son adresse, par un jeton tiré de l'invitation.
const INVITATION = "invitation";
export type UnsubscribeKind = EmailKind | typeof INVITATION;
const invitationPurpose = "email-unsubscribe:invitation";

export const invitationOptOutPageUrl = (invitationId: string): string =>
  `${env().NEXT_PUBLIC_APP_URL}/e-mails/${INVITATION}/${deriveToken(invitationPurpose, invitationId)}`;

export const invitationOptOutUrl = (invitationId: string): string =>
  `${env().NEXT_PUBLIC_APP_URL}/api/email/desinscription/${INVITATION}/${deriveToken(invitationPurpose, invitationId)}`;

export const isValidUnsubscribe = (kind: string, token: string): kind is UnsubscribeKind =>
  kind === INVITATION
    ? tokenMatches(invitationPurpose, token)
    : isEmailKind(kind) && tokenMatches(purpose(kind), token);

export const applyUnsubscribe = async (kind: string, token: string): Promise<void> => {
  if (!isValidUnsubscribe(kind, token)) throw notFound();
  const id = idFromToken(token);
  if (!id) throw notFound();
  if (kind === INVITATION) {
    const invitation = await prisma.invitation.findUnique({ where: { id }, select: { email: true } });
    if (!invitation?.email) throw notFound();
    // L'adresse rejoint la liste de blocage : plus d'invitation ni de rappel, les e-mails de connexion restent.
    await suppressEmail(invitation.email, "suppressed");
    return;
  }
  await prisma.profile.updateMany({ where: { id }, data: { [columns[kind]]: false } });
};

export const getEmailPreferences = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { emailDigest: true, emailNotifications: true, emailTips: true },
  });
  return {
    digest: profile?.emailDigest ?? true,
    notifications: profile?.emailNotifications ?? true,
    tips: profile?.emailTips ?? true,
  };
};

export const setEmailPreference = async (userId: string, kind: EmailKind, on: boolean): Promise<void> => {
  await prisma.profile.update({ where: { id: userId }, data: { [columns[kind]]: on } });
};
