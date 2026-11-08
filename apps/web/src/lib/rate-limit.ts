import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { AppError } from "./errors";
import { m } from "@tartan/i18n";

// Limitation de débit sur les routes sensibles, partagée entre instances.
// Une seule instruction SQL : deux requêtes simultanées ne peuvent pas lire le même compteur.
export const enforceRateLimit = async (key: string, max: number, windowSeconds: number): Promise<void> => {
  const now = BigInt(Date.now());
  const windowStart = now - BigInt(windowSeconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit (id, key, count, last_request)
    VALUES (${randomUUID()}::uuid, ${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit.last_request < ${windowStart} THEN 1 ELSE rate_limit.count + 1 END,
      last_request = CASE WHEN rate_limit.last_request < ${windowStart} THEN ${now} ELSE rate_limit.last_request END
    RETURNING count`;
  if (Number(rows[0]?.count ?? 0) > max) throw new AppError(429, "rate_limited", m.errors.rateLimited);
};
