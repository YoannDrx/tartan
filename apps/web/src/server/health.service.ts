import { prisma } from "@/lib/prisma";

export const isDatabaseHealthy = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`select 1`;
    return true;
  } catch {
    return false;
  }
};
