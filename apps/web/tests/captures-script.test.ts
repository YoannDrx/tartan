import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "../../../scripts/captures.mjs");

const run = (args: string[], env: Record<string, string>) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH, ...env },
  });

describe("pnpm captures", () => {
  it.each([
    "postgresql://u:secret@ep-exemple.eu-central-1.aws.neon.tech/neondb",
    "postgresql://u:secret@localhost.exemple.com/tartan",
    "postgresql://u:secret@localhost:54329/tartan?host=ep-exemple.neon.tech",
    "postgresql://u:secret@localhost:54329/tartan?hostaddr=10.0.0.1",
    "mysql://u:secret@localhost/tartan",
    "pas-une-adresse",
  ])("refuse la base %s, sans exposer le mot de passe", (databaseUrl) => {
    const result = run(["--dry-run"], { DATABASE_URL: databaseUrl });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("refuse");
    expect(result.stdout + result.stderr).not.toContain("secret");
    expect(result.stdout).not.toContain("simctl");
  });

  it("refuse un serveur web distant", () => {
    const result = run(["--dry-run", "--only=web"], {
      DATABASE_URL: "postgresql://tartan@localhost:54329/tartan",
      CAPTURE_BASE_URL: "https://app.tartan.coach",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("refuse tout serveur");
  });

  it("refuse une option inconnue", () => {
    const result = run(["--vite"], { DATABASE_URL: "postgresql://tartan@localhost:54329/tartan" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("option inconnue");
  });

  it("à sec, annonce Playwright sans rien lancer ni écrire", () => {
    const result = run(["--dry-run", "--only=web"], { DATABASE_URL: "postgresql://tartan@localhost:54329/tartan" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[à sec] CAPTURE_BASE_URL=http://localhost:3000 corepack pnpm");
    expect(result.stdout).toContain("e2e/captures.spec.ts --project=desktop");
    expect(result.stdout).toContain("rien n'a été écrit");
  });
});
