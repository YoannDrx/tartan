import { expect, it } from "vitest";
import { prisma, TRANSACTION_DEFAULTS } from "@/lib/prisma";

it("une transaction plus lente que le défaut de Prisma (5 s) aboutit", async () => {
  expect(TRANSACTION_DEFAULTS.timeout).toBeGreaterThan(5_000);
  const value = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_sleep(6)`;
    return tx.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  });
  expect(value[0]?.ok).toBe(1);
}, 20_000);

it("quand toutes les connexions sont prises, une transaction attend son tour plus de 2 s au lieu d'échouer", async () => {
  expect(TRANSACTION_DEFAULTS.maxWait).toBeGreaterThan(2_000);
  // Le pool de pg compte 10 connexions : les deux dernières transactions attendent qu'une se libère (2,5 s).
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_sleep(2.5)`;
        return i;
      }),
    ),
  );
  expect(results).toHaveLength(12);
}, 30_000);
