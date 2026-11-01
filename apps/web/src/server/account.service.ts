import { revokeAppleToken } from "@/lib/apple";
import { log } from "@/lib/logger";
import { deleteAsset, videoEnabled } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { audit } from "./access";

// Suppression réelle du compte et de ses données, contenus créés compris (Apple 5.1.1(v), § 15.4).
export const deleteAccount = async (userId: string): Promise<void> => {
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
      members: {
        where: { role: { in: ["coach", "assistant"] }, userId: { not: userId } },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      },
    },
  });
  // Espace repris par le plus ancien autre coach ; sans autre coach, l'espace disparaît avec ses données.
  const orgsToDelete = owned.filter((o) => o.members.length === 0).map((o) => o.id);
  const transfers = owned.filter((o) => o.members.length > 0);

  const assets = await prisma.video.findMany({
    where: {
      OR: [{ athleteId: { in: athleteIds } }, { organizationId: { in: orgsToDelete } }],
      muxAssetId: { not: null },
    },
    select: { muxAssetId: true },
  });

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

  if (videoEnabled()) {
    for (const asset of assets) {
      await deleteAsset(asset.muxAssetId as string).catch(() => log.warn("mux_asset_delete_failed"));
    }
  }
  await audit({ action: "account_deleted", entity: "user" });
  log.info("account_deleted");
};
