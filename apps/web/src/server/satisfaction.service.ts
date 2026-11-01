import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "./access";

const DAY_MS = 86400 * 1000;
const ASK_AFTER_DAYS = 14;
const ASK_EVERY_DAYS = 30;

// Question mensuelle (§ 18) : pas avant deux semaines d'usage, jamais deux fois en un mois.
export const shouldAskSatisfaction = async (userId: string, now: Date = new Date()): Promise<boolean> => {
  const [user, last] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.satisfactionAnswer.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  if (!user || now.getTime() - user.createdAt.getTime() < ASK_AFTER_DAYS * DAY_MS) return false;
  return !last || now.getTime() - last.createdAt.getTime() >= ASK_EVERY_DAYS * DAY_MS;
};

export const answerSatisfaction = async (
  userId: string,
  organizationId: string,
  input: { recommend: boolean; comment?: string | null },
): Promise<void> => {
  await requireOrgMember(userId, organizationId);
  await prisma.satisfactionAnswer.create({
    data: { userId, organizationId, recommend: input.recommend, comment: input.comment?.trim() || null },
  });
};
