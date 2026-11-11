import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";

// La base de test vient d'être reconstruite depuis les migrations : si le schéma Prisma décrit autre chose,
// `prisma migrate dev` s'arrête pour demander une migration, et le code lit une base qu'il ne connaît pas.
it("le schéma Prisma décrit exactement la base que produisent les migrations", () => {
  const url = process.env.DATABASE_URL!;
  const diff = spawnSync(
    "corepack",
    [
      "pnpm",
      "exec",
      "prisma",
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--script",
      "--exit-code",
    ],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      // prisma.config.ts lit d'abord cette variable : sans elle, la comparaison viserait une autre base.
      env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
      encoding: "utf8",
    },
  );
  // 0 : aucun écart. 2 : le script affiché est la migration qui manque, ou le schéma à corriger.
  expect(diff.status, diff.stdout || diff.stderr).toBe(0);
}, 60_000);
