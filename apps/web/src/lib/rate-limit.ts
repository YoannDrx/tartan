import { prisma } from "./prisma";
import { AppError } from "./errors";
import { m } from "@tartan/i18n";

// Limitation de débit sur les routes sensibles (invitations), partagée entre instances.
export const enforceRateLimit = async (key: string, max: number, windowSeconds: number): Promise<void> => {
  const now = BigInt(Date.now());
  const windowStart = now - BigInt(windowSeconds * 1000);
  const current = await prisma.rateLimit.findUnique({ where: { key } });
  if (!current || current.lastRequest < windowStart) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, lastRequest: now },
      update: { count: 1, lastRequest: now },
    });
    return;
  }
  if (current.count >= max) throw new AppError(429, "rate_limited", m.errors.rateLimited);
  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
};
