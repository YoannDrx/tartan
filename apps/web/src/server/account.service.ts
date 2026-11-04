import { createElement } from "react";
import { isPaidPlan } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { AccountDeletedEmail, SpaceTransferredEmail } from "@email/auth";
import { revokeAppleToken } from "@/lib/apple";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { log } from "@/lib/logger";
import { drainExternalDeletions } from "./external-deletion.service";
import { prisma } from "@/lib/prisma";
import { cancelStripeSubscriptions } from "./billing.service";
import { audit } from "./access";
import { deleteAthleteAssignments } from "./session-audience.service";

// Suppression réelle du compte et de ses données, contenus créés compris (Apple 5.1.1(v), § 15.4).
export const deleteAccount = async (userId: string): Promise<void> => {
  // Lue avant la suppression : c'est la seule trace de l'adresse à prévenir.
  const leaving = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { providerId: true, refreshToken: true },
  });
  for (const account of accounts) {
    if (account.providerId === "apple" && account.refreshToken) {
      await revokeAppleToken(account.refreshToken).catch(() => log.warn("apple_revoke_failed"));
    }
  }

  const athletes = await prisma.athlete.findMany({ where: { userId }, select: { id: true } });
  const athleteIds = athletes.map((a) => a.id);
  const owned = await prisma.organization.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      plan: true,
      members: {
        where: { role: { in: ["coach", "assistant"] }, userId: { not: userId } },
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { email: true } } },
      },
    },
  });
  // Espace repris par le plus ancien autre coach ; sans autre coach, l'espace disparaît avec ses données.
  const orgsToDelete = owned.filter((o) => o.members.length === 0).map((o) => o.id);
  const transfers = owned.filter((o) => o.members.length > 0);
  await cancelStripeSubscriptions(orgsToDelete);

  await prisma.$transaction(async (tx) => {
    for (const org of transfers) {
      const next = org.members[0]?.userId as string;
      await tx.organization.update({ where: { id: org.id }, data: { ownerId: next } });
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId: next } },
        data: { role: "owner" },
      });
    }
    await tx.organization.deleteMany({ where: { id: { in: orgsToDelete } } });
    await deleteAthleteAssignments(tx, athleteIds);
    await tx.athlete.deleteMany({ where: { id: { in: athleteIds } } });
    await tx.comment.deleteMany({ where: { authorId: userId } });
    await tx.videoAnnotation.deleteMany({ where: { authorId: userId } });
    await tx.announcement.deleteMany({ where: { authorId: userId } });
    await tx.coachNote.deleteMany({ where: { authorId: userId } });
    await tx.contentReport.deleteMany({ where: { reporterId: userId } });
    await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.groupCoach.deleteMany({ where: { userId } });
    await tx.guardian.deleteMany({ where: { guardianUserId: userId } });
    await tx.referralCode.deleteMany({ where: { ownerType: "user", ownerId: userId } });
    await tx.referral.deleteMany({ where: { referredUserId: userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await drainExternalDeletions();
  await audit({ action: "account_deleted", entity: "user" });
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  // Un message qui échoue n'empêche jamais une suppression déjà faite.
  if (leaving) {
    await sendEmail({
      to: leaving.email,
      subject: m.email.accountDeleted.subject,
      react: createElement(AccountDeletedEmail, {
        hadSubscription: owned.some((org) => isPaidPlan(org.plan)),
      }),
    }).catch(() => log.warn("account_deleted_email_failed"));
  }
  for (const org of transfers) {
    const heir = org.members[0]?.user.email;
    if (!heir) continue;
    await sendEmail({
      to: heir,
      subject: m.email.spaceTransferred.subject(org.name),
      react: createElement(SpaceTransferredEmail, {
        previous: leaving?.name ?? org.name,
        space: org.name,
        subscriptionEnds: null,
        url: `${appUrl}/reglages?espace=${org.id}`,
      }),
    }).catch(() => log.warn("space_transferred_email_failed"));
  }
  log.info("account_deleted");
};
