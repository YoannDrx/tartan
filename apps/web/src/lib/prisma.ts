import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { postgresConnectionString } from "./postgres-connection";

const create = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: postgresConnectionString(process.env.DATABASE_URL) }),
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof create> };

// Réservé aux services de src/server : aucune page ni route n'appelle Prisma directement (§ 11.4).
export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
