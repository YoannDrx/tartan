import { createElement } from "react";
import { isPaidPlan } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { AccountDeletedEmail, SpaceTransferredEmail } from "@email/auth";
import { revokeAppleToken } from "@/lib/apple";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { log } from "@/lib/logger";
import { billingEnabled, stripe } from "@/lib/stripe";
import { drainExternalDeletions, enqueueExternalDeletion } from "./external-deletion.service";
import { prisma } from "@/lib/prisma";
import { audit } from "./access";
import { deleteAthleteAssignments } from "./session-audience.service";

const revokeWithRetries = async (refreshToken: string): Promise<void> => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await revokeAppleToken(refreshToken);
      return;
    } catch {
      if (attempt === 3) log.error("apple_revoke_failed");
    }
  }
};

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
      await revokeWithRetries(account.refreshToken);
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
  // Le paiement ne doit jamais bloquer une suppression : la file reprendra si Stripe est en panne.
  const [deletedBilling, transferredBilling] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: orgsToDelete } },
      select: {
        stripeCustomerId: true,
        subscriptions: { where: { provider: "stripe", status: { not: "canceled" } }, select: { providerRef: true } },
      },
    }),
    prisma.organization.findMany({
      where: { id: { in: transfers.map((org) => org.id) } },
      select: {
        id: true,
        stripeCustomerId: true,
        subscriptions: {
          where: { provider: "stripe", status: { not: "canceled" } },
          select: { providerRef: true, currentPeriodEnd: true },
        },
      },
    }),
  ]);

  await prisma.$transaction(async (tx) => {
    for (const org of transfers) {
      const next = org.members[0]?.userId as string;
      await tx.organization.update({ where: { id: org.id }, data: { ownerId: next } });
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId: next } },
        data: { role: "owner" },
      });
    }
    for (const org of deletedBilling) {
      for (const { providerRef } of org.subscriptions) {
        if (providerRef) {
          await enqueueExternalDeletion(
            { provider: "stripe_subscription", ref: providerRef, reason: "account_deleted" },
            tx,
          );
        }
      }
      if (org.stripeCustomerId) {
        await enqueueExternalDeletion(
          { provider: "stripe_customer", ref: org.stripeCustomerId, reason: "account_deleted" },
          tx,
        );
      }
    }
    await tx.organization.deleteMany({ where: { id: { in: orgsToDelete } } });
    // Coordonnées laissées dans les invitations reçues ou acceptées, et réponses de satisfaction.
    await tx.invitation.updateMany({
      where: { OR: [{ acceptedBy: userId }, ...(leaving ? [{ email: leaving.email.toLowerCase() }] : [])] },
      data: { email: null, phone: null },
    });
    await tx.satisfactionAnswer.deleteMany({ where: { userId } });
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
  // Espace repris : l'abonnement du partant s'arrête à l'échéance, et les messages de Stripe vont au repreneur.
  const endsByOrg = new Map<string, string>();
  for (const org of transferredBilling) {
    const heir = transfers.find((transfer) => transfer.id === org.id)?.members[0]?.user.email;
    for (const subscription of org.subscriptions) {
      if (!subscription.providerRef || !billingEnabled()) continue;
      try {
        await stripe().subscriptions.update(subscription.providerRef, { cancel_at_period_end: true });
        if (org.stripeCustomerId && heir) await stripe().customers.update(org.stripeCustomerId, { email: heir });
        if (subscription.currentPeriodEnd) {
          endsByOrg.set(
            org.id,
            new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(
              subscription.currentPeriodEnd,
            ),
          );
        }
      } catch {
        log.error("transfer_subscription_update_failed", { organizationId: org.id });
      }
    }
  }
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
        subscriptionEnds: endsByOrg.get(org.id) ?? null,
        url: `${appUrl}/reglages?espace=${org.id}`,
      }),
    }).catch(() => log.warn("space_transferred_email_failed"));
  }
  log.info("account_deleted");
};
