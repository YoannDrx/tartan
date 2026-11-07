import { isPaidPlan } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { revokeAppleToken } from "@/lib/apple";
import { log } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import {
  enqueueBillingCancellation,
  enqueueCustomerCancellation,
  processBillingCommands,
} from "./billing-command.service";
import { drainExternalDeletions, enqueueExternalDeletion } from "./external-deletion.service";
import { prisma } from "@/lib/prisma";
import { audit } from "./access";
import { deleteAthleteAssignments } from "./session-audience.service";
import { enqueueAccountEmails, flushEmailOutbox } from "./email-outbox.service";

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
export const deleteAccount = async (userId: string, options: { inactiveBefore?: Date } = {}): Promise<void> => {
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
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      plan: true,
      billingOwnerId: true,
      members: {
        where: { role: { in: ["coach", "assistant"] }, status: "active", userId: { not: userId } },
        orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
        select: { userId: true, user: { select: { email: true } } },
      },
    },
  });
  // Espace repris par le plus ancien autre coach ; sans autre coach, l'espace disparaît avec ses données.
  const orgsToDelete = owned.filter((o) => o.members.length === 0).map((o) => o.id);
  const transfers = owned.filter((o) => o.members.length > 0);
  await prisma.$transaction(async (tx) => {
    if (options.inactiveBefore) {
      await tx.$queryRaw`SELECT id FROM profiles WHERE id = ${userId}::uuid FOR UPDATE`;
      const profile = await tx.profile.findUniqueOrThrow({ where: { id: userId } });
      if (!profile.inactivityNoticeAt || (profile.lastActiveAt ?? profile.createdAt) >= options.inactiveBefore) {
        throw new AppError(409, "account_active", m.common.genericError);
      }
    }
    // Ne pas laisser un Checkout en vol facturer après la disparition du payeur.
    for (const org of owned) {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${org.id}::uuid FOR UPDATE`;
      const current = await tx.organization.findUniqueOrThrow({ where: { id: org.id } });
      if (current.ownerId !== userId) throw new AppError(409, "owner_changed", m.common.genericError);
      // Une suspension/départ concurrent ne doit pas promouvoir un ancien coach.
      await tx.$queryRaw`SELECT user_id FROM organization_members WHERE organization_id = ${org.id}::uuid FOR UPDATE`;
      const successor = await tx.organizationMember.findFirst({
        where: {
          organizationId: org.id,
          role: { in: ["coach", "assistant"] },
          status: "active",
          userId: { not: userId },
        },
        orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
        select: { userId: true },
      });
      if ((successor?.userId ?? null) !== (org.members[0]?.userId ?? null))
        throw new AppError(409, "successor_changed", m.common.genericError);
      if (
        options.inactiveBefore &&
        current.lastBusinessActivityAt &&
        current.lastBusinessActivityAt >= options.inactiveBefore &&
        !org.members.length
      ) {
        throw new AppError(409, "retention_review", m.common.genericError);
      }
      const checkout = await tx.checkoutIntent.findUnique({ where: { organizationId: org.id } });
      if (checkout?.leaseUntil && checkout.leaseUntil > new Date()) {
        throw new AppError(409, "checkout_in_progress", m.billing.checkoutInProgress);
      }
    }
    // Références lues sous le même verrou que le Checkout : un client créé juste avant
    // le transfert ne doit pas disparaître de la commande durable.
    const billing = await tx.organization.findMany({
      where: { id: { in: owned.map((org) => org.id) } },
      select: {
        id: true,
        billingOwnerId: true,
        stripeCustomerId: true,
        subscriptions: { where: { provider: "stripe", status: { not: "canceled" } }, select: { providerRef: true } },
      },
    });
    const transferredBilling = billing.filter((org) => !orgsToDelete.includes(org.id));
    const deletedBilling = billing.filter((org) => orgsToDelete.includes(org.id));
    for (const org of transfers) {
      const next = org.members[0]?.userId as string;
      await tx.organization.update({
        where: { id: org.id },
        data: { ownerId: next, billingOwnerId: billing.find((row) => row.id === org.id)?.billingOwnerId ?? userId },
      });
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId: next } },
        data: { role: "owner" },
      });
    }
    for (const org of transferredBilling) {
      if (org.stripeCustomerId) await enqueueCustomerCancellation(tx, org.id, org.stripeCustomerId);
      for (const subscription of org.subscriptions) {
        if (subscription.providerRef) await enqueueBillingCancellation(tx, org.id, subscription.providerRef);
      }
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
    if (leaving) {
      await enqueueAccountEmails(tx, {
        userId,
        to: leaving.email,
        hadSubscription: owned.some((org) => isPaidPlan(org.plan)),
        transfers: transfers.map((org) => ({
          organizationId: org.id,
          to: org.members[0]!.user.email,
          userId: org.members[0]!.userId,
          previous: leaving.name ?? org.name,
          space: org.name,
        })),
      });
    }
  });

  await drainExternalDeletions();
  await audit({ action: "account_deleted", entity: "user" });
  await processBillingCommands().catch(() => log.error("billing_commands_drain_failed"));
  await flushEmailOutbox().catch(() => log.warn("account_email_flush_failed"));
  log.info("account_deleted");
};
