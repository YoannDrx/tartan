import { prisma } from "@/lib/prisma";

export const blockedUserIds = async (userId: string): Promise<string[]> => {
  const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  return rows.map((r) => r.blockedId);
};
