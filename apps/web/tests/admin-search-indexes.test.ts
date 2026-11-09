import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Client séparé : seul lui journalise le SQL réellement produit par Prisma, sans toucher au singleton.
const traced = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: [{ emit: "event", level: "query" }],
});
const statements: { query: string; params: unknown[] }[] = [];
traced.$on("query", (event) => {
  statements.push({ query: event.query, params: JSON.parse(event.params) as unknown[] });
});

afterAll(() => traced.$disconnect());

// Le jeu de test est minuscule : sans ces réglages, le planificateur préfère lire la table entière ou suivre l'index
// de tri. Seul un parcours par bitmap reste possible, et il ne peut s'appuyer que sur un index qui sert le filtre.
const planOf = async (run: () => Promise<unknown>): Promise<string> => {
  statements.length = 0;
  await run();
  const statement = statements.find((row) => /ILIKE/i.test(row.query));
  if (!statement) throw new Error(`Aucun ILIKE dans : ${statements.map((row) => row.query).join(" | ")}`);
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
    await tx.$executeRawUnsafe("SET LOCAL enable_indexscan = off");
    await tx.$executeRawUnsafe("SET LOCAL enable_indexonlyscan = off");
    return tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN ${statement.query}`, ...statement.params);
  });
  return rows.map((row) => row["QUERY PLAN"]).join("\n");
};

describe("recherche de la console d'administration", () => {
  it("dispose d'un index trigrammes sur chaque colonne cherchée", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE indexname LIKE '%_trgm_idx' ORDER BY indexname`;
    expect(rows.map((row) => row.indexname)).toEqual([
      "audit_log_action_trgm_idx",
      "organizations_name_trgm_idx",
      "user_email_trgm_idx",
      "user_name_trgm_idx",
    ]);
    for (const row of rows) expect(row.indexdef).toMatch(/USING gin \(\w+ gin_trgm_ops\)/);
  });

  it("sert les requêtes contains insensibles à la casse telles que Prisma les écrit", async () => {
    const q = "tartan";
    const users = await planOf(() =>
      traced.user.findMany({
        where: {
          OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
    expect(users).toContain("user_email_trgm_idx");
    expect(users).toContain("user_name_trgm_idx");

    const spaces = await planOf(() =>
      traced.organization.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
    expect(spaces).toContain("organizations_name_trgm_idx");

    const audit = await planOf(() =>
      traced.auditLog.findMany({
        where: { action: { contains: q, mode: "insensitive" } },
        orderBy: [{ at: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
    expect(audit).toContain("audit_log_action_trgm_idx");
  });
});
