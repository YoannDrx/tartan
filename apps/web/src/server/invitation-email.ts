import { createElement } from "react";
import { m } from "@tartan/i18n";
import { InvitationEmail, StaffInvitationEmail } from "@email/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { deriveToken } from "@/lib/tokens";
import { namesFor } from "./me.service";

// L'e-mail d'invitation, rendu au moment de l'envoi : la file ne garde que l'identifiant de l'invitation,
// jamais son lien. Un lien en clair dans une table serait un accès à l'espace.

export const INVITATION_PURPOSE = "invitation";

export const invitationLink = (invitationId: string): string =>
  `${env().NEXT_PUBLIC_APP_URL}/i/${deriveToken(INVITATION_PURPOSE, invitationId)}`;

export const invitationOutboxKind = (role: string): "invitation_athlete" | "invitation_staff" =>
  role === "athlete" ? "invitation_athlete" : "invitation_staff";

export const isInvitationOutboxKind = (kind: string): boolean =>
  kind === "invitation_athlete" || kind === "invitation_staff";

export type InvitationEmailPayload = { invitationId: string };

const invitationOf = (payload: unknown) =>
  prisma.invitation.findUnique({
    where: { id: (payload as InvitationEmailPayload).invitationId ?? "" },
    include: { organization: { select: { name: true } } },
  });

// Une invitation acceptée, révoquée, expirée ou adressée ailleurs depuis ne doit plus partir.
export const isInvitationEmailRelevant = async (payload: unknown, toEmail: string, now: Date): Promise<boolean> => {
  const invitation = await invitationOf(payload);
  if (!invitation || invitation.email !== toEmail) return false;
  if (invitation.status !== "sent" && invitation.status !== "opened") return false;
  return !invitation.expiresAt || invitation.expiresAt > now;
};

export const renderInvitationEmail = async (payload: unknown) => {
  const invitation = await invitationOf(payload);
  if (!invitation) throw new Error("invitation_missing");
  const names = await namesFor([invitation.invitedBy]);
  const inviter = names.get(invitation.invitedBy) ?? invitation.organization.name;
  const url = invitationLink(invitation.id);
  if (invitation.role !== "athlete") {
    return {
      subject: m.email.subjects.invitationStaff(inviter, invitation.organization.name),
      react: createElement(StaffInvitationEmail, {
        url,
        inviter,
        organization: invitation.organization.name,
        role: invitation.role,
      }),
    };
  }
  const groups = await prisma.group.findMany({
    where: { id: { in: invitation.groupIds } },
    select: { name: true },
  });
  const target = groups[0]?.name ?? invitation.organization.name;
  return {
    subject: m.email.subjects.invitationAthlete(inviter, target),
    react: createElement(InvitationEmail, { url, inviter, target }),
  };
};
