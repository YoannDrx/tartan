import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { postgresConnectionString } from "./postgres-connection";

// Délais des transactions interactives. Ceux de Prisma (2 s pour obtenir une connexion, 5 s pour aboutir) font échouer
// une écriture (`P2028`) dès que la base se réveille ou que le serveur est chargé : une invitation acceptée répondait
// « Ça n'a pas marché ». Une transaction qui passe ses propres délais les garde.
export const TRANSACTION_DEFAULTS = { maxWait: 10_000, timeout: 15_000 } as const;

const create = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: postgresConnectionString(process.env.DATABASE_URL) }),
    transactionOptions: TRANSACTION_DEFAULTS,
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof create> };

// Réservé aux services de src/server : aucune page ni route n'appelle Prisma directement (§ 11.4).
export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
