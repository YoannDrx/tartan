import { execFileSync } from "node:child_process";
import path from "node:path";

// Base Postgres jetable : schéma remis à zéro à chaque exécution (§ 14).
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_test";
  const cwd = path.resolve(import.meta.dirname, "..");
  execFileSync("corepack", ["pnpm", "exec", "prisma", "migrate", "reset", "--force"], {
    cwd,
    env: {
      ...process.env,
      DATABASE_URL: url,
      // prisma.config.ts lit d'abord cette variable : sans cela, le reset viserait la base qu'elle désigne.
      DATABASE_URL_UNPOOLED: url,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "base de test jetable tartan_test",
    },
    stdio: "pipe",
  });
}
