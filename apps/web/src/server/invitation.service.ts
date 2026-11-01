import {
  type AcceptInvitationInput,
  createInvitationInput,
  type CreateInvitationInput,
  type InvitationPreview,
} from "@tartan/contracts";
import { invitationDefaults, invitationStateOf, requiresParentalConsent } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { createElement } from "react";
import { InvitationEmail } from "@email/auth";
import { toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { deriveToken, sha256, tokenMatches } from "@/lib/tokens";
import { audit, requireGroupInScope, requireOrgMember, requireVisibleAthlete } from "./access";
import { assertWithinPlan } from "./billing.service";
import { setConsent, startParentalConsent } from "./consent.service";
import { displayName, namesFor } from "./me.service";
import { ensureReferralCode } from "./org.service";
import { attributeReferral } from "./referral.service";

const PURPOSE = "invitation";

export const invitationLink = (invitationId: string): string =>
  `${env().NEXT_PUBLIC_APP_URL}/i/${deriveToken(PURPOSE, invitationId)}`;

export const createInvitation = async (userId: string, organizationId: string, rawInput: CreateInvitationInput) => {
  const input = createInvitationInput.parse(rawInput);
  const permission = input.role === "athlete" ? "inviteAthlete" : "inviteCoach";
  const access = await requireOrgMember(userId, organizationId, permission);
  await enforceRateLimit(`invite:${userId}`, 60, 3600);
  if (input.role !== "athlete") await assertWithinPlan(organizationId, "maxCoaches");
  await requireGroupInScope(access, input.groupIds);
  if (input.athleteId) await requireVisibleAthlete(access, input.athleteId);

  const defaults = invitationDefaults(input.kind);
  const id = crypto.randomUUID();
  const token = deriveToken(PURPOSE, id);
  const invitation = await prisma.invitation.create({
    data: {
      id,
      organizationId,
      kind: input.kind,
      role: input.role,
      groupIds: input.groupIds,
      email: input.email?.toLowerCase() ?? null,
      phone: input.phone ?? null,
      athleteId: input.athleteId ?? null,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + (input.expiresInDays ?? defaults.days) * 86400 * 1000),
      maxUses: defaults.maxUses,
      invitedBy: userId,
    },
  });
  if (invitation.kind === "personal_email" && invitation.email) await sendInvitationEmail(invitation.id);
  log.info("invitation_created", { organizationId, entityId: invitation.id });
  return { id: invitation.id, link: invitationLink(invitation.id) };
};

const sendInvitationEmail = async (invitationId: string): Promise<void> => {
  const inv = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { organization: { select: { name: true } } },
  });
  if (!inv?.email) return;
  const names = await namesFor([inv.invitedBy]);
  const groups = await prisma.group.findMany({ where: { id: { in: inv.groupIds } }, select: { name: true } });
  const target = groups[0]?.name ?? inv.organization.name;
  const inviter = names.get(inv.invitedBy) ?? inv.organization.name;
  await sendEmail({
    to: inv.email,
    subject: `${inviter} t'invite à rejoindre ${target}`,
    react: createElement(InvitationEmail, { url: invitationLink(inv.id), inviter, target }),
  });
};

export const listInvitations = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "inviteAthlete");
  const rows = await prisma.invitation.findMany({
    where: { organizationId, ...(access.role === "owner" ? {} : { invitedBy: userId }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const now = new Date();
  return rows.map((r) => {
    const state = invitationStateOf(r, now);
    return {
      id: r.id,
      kind: r.kind,
      role: r.role,
      email: r.email,
      phone: r.phone,
      groupIds: r.groupIds,
      expiresAt: r.expiresAt,
      useCount: r.useCount,
      status: state === "expired" ? ("expired" as const) : r.status,
      link: state === "valid" ? invitationLink(r.id) : null,
    };
  });
};

export const groupInvitationLink = async (userId: string, organizationId: string, groupId: string) => {
  const access = await requireOrgMember(userId, organizationId, "inviteAthlete");
  await requireGroupInScope(access, [groupId]);
  const existing = await prisma.invitation.findFirst({
    where: {
      organizationId,
      kind: "group_link",
      groupIds: { has: groupId },
      status: { notIn: ["revoked"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id, link: invitationLink(existing.id), expiresAt: existing.expiresAt };
  const created = await createInvitation(userId, organizationId, { kind: "group_link", groupIds: [groupId] });
  const row = await prisma.invitation.findUnique({ where: { id: created.id } });
  return { id: created.id, link: created.link, expiresAt: row?.expiresAt ?? null };
};

export const revokeInvitation = async (userId: string, organizationId: string, invitationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "inviteAthlete");
  const inv = await prisma.invitation.findFirst({ where: { id: invitationId, organizationId } });
  if (!inv) throw notFound();
  if (access.role !== "owner" && inv.invitedBy !== userId) throw forbidden();
  await prisma.invitation.update({ where: { id: inv.id }, data: { status: "revoked" } });
  await audit({
    organizationId,
    actorId: userId,
    action: "invitation_revoked",
    entity: "invitation",
    entityId: inv.id,
  });
};

export const resendInvitation = async (userId: string, organizationId: string, invitationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "inviteAthlete");
  const inv = await prisma.invitation.findFirst({ where: { id: invitationId, organizationId } });
  if (!inv) throw notFound();
  if (access.role !== "owner" && inv.invitedBy !== userId) throw forbidden();
  await enforceRateLimit(`invite:${userId}`, 60, 3600);
  await prisma.invitation.update({
    where: { id: inv.id },
    data: { expiresAt: new Date(Date.now() + invitationDefaults(inv.kind).days * 86400 * 1000), status: "sent" },
  });
  if (inv.email) await sendInvitationEmail(inv.id);
  return { link: invitationLink(inv.id) };
};

const findByToken = async (token: string) => {
  if (!tokenMatches(PURPOSE, token)) return null;
  return prisma.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { organization: { select: { name: true } } },
  });
};

export const previewInvitation = async (token: string): Promise<InvitationPreview> => {
  const inv = await findByToken(token);
  if (!inv) throw notFound();
  if (inv.status === "sent") {
    await prisma.invitation.update({ where: { id: inv.id }, data: { status: "opened" } });
  }
  const [inviter, groups] = await Promise.all([
    prisma.user.findUnique({
      where: { id: inv.invitedBy },
      select: { name: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
    prisma.group.findMany({ where: { id: { in: inv.groupIds } }, select: { name: true } }),
  ]);
  return {
    organizationName: inv.organization.name,
    inviterName: displayName(inviter?.profile) || inviter?.name || inv.organization.name,
    inviterAvatarUrl: inviter?.profile?.avatarUrl ?? null,
    groupNames: groups.map((g) => g.name),
    role: inv.role,
    email: inv.email,
    state: invitationStateOf(inv, new Date()),
  };
};

export const acceptInvitation = async (
  actor: { userId: string; email: string },
  token: string,
  input: AcceptInvitationInput,
) => {
  await enforceRateLimit(`accept:${actor.userId}`, 20, 3600);
  const inv = await findByToken(token);
  if (!inv) throw notFound();
  const state = invitationStateOf(inv, new Date());
  if (state === "expired") throw invalid(m.invite.expired);
  if (state === "revoked") throw invalid(m.invite.revoked);
  if (state === "used") throw invalid(m.invite.used);
  if (inv.email && inv.email !== actor.email.toLowerCase()) {
    throw new AppError(403, "wrong_account", "Cette invitation est destinée à une autre adresse e-mail.");
  }
  if (!input.consents.terms) throw invalid(m.invite.termsRequired);

  const isAthlete = inv.role === "athlete";
  const minor = isAthlete && requiresParentalConsent(input.birthDate, new Date());
  if (minor && !input.guardianEmail) throw invalid(m.invite.guardianHint);

  // Une fiche préparée ou un retour dans l'espace ne compte pas comme un athlète de plus.
  const alreadyCounted =
    Boolean(inv.athleteId) ||
    Boolean(await prisma.athlete.findUnique({ where: { organizationId_userId: { organizationId: inv.organizationId, userId: actor.userId } }, select: { id: true } }));
  if (isAthlete && !alreadyCounted) {
    await assertWithinPlan(inv.organizationId, "maxAthletes").catch((error) => {
      throw error instanceof AppError && error.code === "plan_limit" ? new AppError(402, "plan_limit", m.billing.limitJoinAthlete) : error;
    });
  }
  const birthDate = input.birthDate ? toDbDate(input.birthDate) : null;
  const athleteId = await prisma.$transaction(async (tx) => {
    // Réservation atomique : un lien nominatif à usage unique ne sert qu'une fois, même en concurrence.
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, ...(inv.maxUses !== null ? { useCount: { lt: inv.maxUses } } : {}) },
      data: { useCount: { increment: 1 }, status: "accepted", acceptedBy: actor.userId },
    });
    if (claimed.count === 0) throw invalid(m.invite.used);

    await tx.profile.upsert({
      where: { id: actor.userId },
      create: { id: actor.userId, firstName: input.firstName, lastName: input.lastName, birthDate },
      update: { firstName: input.firstName, lastName: input.lastName, birthDate },
    });
    await tx.user.update({
      where: { id: actor.userId },
      data: { name: `${input.firstName} ${input.lastName}`.trim() },
    });

    const member = await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: inv.organizationId, userId: actor.userId } },
    });
    if (!member) {
      await tx.organizationMember.create({
        data: { organizationId: inv.organizationId, userId: actor.userId, role: inv.role, status: "active" },
      });
    }

    if (!isAthlete) {
      await tx.groupCoach.createMany({
        data: inv.groupIds.map((groupId) => ({
          groupId,
          userId: actor.userId,
          role: inv.role === "assistant" ? ("assistant" as const) : ("lead" as const),
        })),
        skipDuplicates: true,
      });
      return null;
    }

    const existing = await tx.athlete.findUnique({
      where: { organizationId_userId: { organizationId: inv.organizationId, userId: actor.userId } },
    });
    const prepared =
      !existing && inv.athleteId
        ? await tx.athlete.findFirst({ where: { id: inv.athleteId, organizationId: inv.organizationId, userId: null } })
        : null;
    const profile = { firstName: input.firstName, lastName: input.lastName, birthDate };
    const athlete = existing
      ? await tx.athlete.update({ where: { id: existing.id }, data: profile })
      : prepared
        ? await tx.athlete.update({ where: { id: prepared.id }, data: { ...profile, userId: actor.userId } })
        : await tx.athlete.create({ data: { ...profile, organizationId: inv.organizationId, userId: actor.userId } });
    await tx.groupMember.createMany({
      data: inv.groupIds.map((groupId) => ({ groupId, athleteId: athlete.id })),
      skipDuplicates: true,
    });
    return athlete.id;
  });

  await setConsent(actor.userId, "terms", true, athleteId);
  if (isAthlete) {
    await setConsent(actor.userId, "health", input.consents.health, athleteId);
    await setConsent(actor.userId, "video", input.consents.video, athleteId);
  }
  if (minor && athleteId && input.guardianEmail) {
    const names = await namesFor([inv.invitedBy]);
    await startParentalConsent({
      organizationId: inv.organizationId,
      athleteId,
      guardianEmail: input.guardianEmail,
      athleteName: input.firstName,
      coachName: names.get(inv.invitedBy) ?? inv.organization.name,
    });
  }
  if (!isAthlete) await ensureReferralCode(actor.userId);
  if (input.referralCode)
    await attributeReferral({ userId: actor.userId, code: input.referralCode, organizationId: inv.organizationId });

  await audit({
    organizationId: inv.organizationId,
    actorId: actor.userId,
    action: "invitation_accepted",
    entity: "invitation",
    entityId: inv.id,
  });
  log.info("invitation_accepted", { organizationId: inv.organizationId });
  return { organizationId: inv.organizationId, athleteId, parentalConsentRequired: minor };
};
