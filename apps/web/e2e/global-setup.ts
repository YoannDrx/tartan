import { execFileSync } from "node:child_process";
import path from "node:path";

export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e";
  execFileSync("pnpm", ["exec", "prisma", "migrate", "reset", "--force"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: url,
      // prisma.config.ts lit d'abord cette variable : sans cela, le reset viserait la base qu'elle désigne.
      DATABASE_URL_UNPOOLED: url,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "base e2e jetable tartan_e2e",
    },
    stdio: "pipe",
  });
}
