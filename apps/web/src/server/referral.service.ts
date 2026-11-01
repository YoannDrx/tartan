import { isSelfReferral, requiresParentalConsent } from "@tartan/domain";
import { fromDbDateOrNull } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

// Attribution figée à l'inscription : ne change plus ensuite (§ 17.4). Pas de récompense en V1.
export const attributeReferral = async (input: {
  userId: string;
  code: string;
  organizationId?: string | null;
}): Promise<boolean> => {
  const code = await prisma.referralCode.findUnique({ where: { code: input.code.toUpperCase() } });
  if (!code) return false;
  const existing = await prisma.referral.findUnique({ where: { referredUserId: input.userId } });
  if (existing) return false;
  const profile = await prisma.profile.findUnique({ where: { id: input.userId }, select: { birthDate: true } });
  // Les athlètes mineurs ne participent à aucune mécanique de récompense.
  if (requiresParentalConsent(fromDbDateOrNull(profile?.birthDate), new Date())) return false;
  const orgs = await prisma.organizationMember.findMany({
    where: { userId: input.userId },
    select: { organizationId: true },
  });
  const self = isSelfReferral({
    codeOwnerUserId: code.ownerType === "user" ? code.ownerId : null,
    codeOwnerOrgId: code.ownerType === "organization" ? code.ownerId : null,
    referredUserId: input.userId,
    referredOrgIds: orgs.map((o) => o.organizationId),
  });
  if (self) return false;
  await prisma.referral.create({
    data: { codeId: code.id, referredUserId: input.userId, referredOrgId: input.organizationId ?? null },
  });
  await prisma.auditLog.create({
    data: { actorId: input.userId, action: "referral_attributed", entity: "referral", entityId: code.id },
  });
  return true;
};

export const referralStats = async (userId: string) => {
  const code = await prisma.referralCode.findUnique({
    where: { ownerType_ownerId: { ownerType: "user", ownerId: userId } },
    include: { _count: { select: { referrals: true } } },
  });
  return code ? { code: code.code, signups: code._count.referrals } : null;
};
