import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ATTRIBUTION_WINDOW_DAYS } from "@tartan/domain";
import { auth, rateLimitEnabled } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  recordStepUp,
  requireStepUp,
  STEP_UP_MONEY_MS,
  STEP_UP_READ_MS,
} from "@/server/admin-step-up.service";
import { GET as referral } from "../app/r/[code]/route";
import { makeUser } from "./helpers";

// T15, T16 et T17 : les gardes qui ne passent par aucun écran. Le lien de parrainage, le limiteur de connexion de
// Better Auth, et la vérification renforcée de la console d'administration, page par page et action par action.

const space = vi.hoisted(() => ({ actor: null as null | { email: string; userId: string; sessionId?: string } }));
vi.mock("@/features/shell/space", () => ({ requireSpace: async () => ({ actor: space.actor }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

afterEach(() => vi.unstubAllEnvs());

const WEB = path.join(__dirname, "..");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );

describe("lien de parrainage (T15)", () => {
  const open = (code: string, host: string) =>
    referral(new NextRequest(`http://${host}/r/${code}`, { headers: { host } }), {
      params: Promise.resolve({ code }),
    });

  it("garde le code 30 jours et mène à la connexion du même hôte, hors production", async () => {
    const response = await open("club-sprint", "localhost:3000");
    expect(response.headers.get("location")).toBe("http://localhost:3000/connexion");
    const cookie = response.cookies.get("tartan_ref");
    expect(cookie).toMatchObject({ value: "CLUB-SPRINT", httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.maxAge).toBe(ATTRIBUTION_WINDOW_DAYS * 86_400);
    expect(cookie?.domain).toBeUndefined();
  });

  it("en production, le cookie vaut pour tout le domaine et la connexion se fait sur l'application", async () => {
    for (const host of ["tartan.coach", "www.tartan.coach"]) {
      const response = await open("Coach42", host);
      expect(response.headers.get("location")).toBe("https://app.tartan.coach/connexion");
      expect(response.cookies.get("tartan_ref")).toMatchObject({
        value: "COACH42",
        domain: ".tartan.coach",
        secure: true,
      });
    }
  });

  it("un code mal formé ne pose aucun cookie, mais la redirection a lieu", async () => {
    for (const code of ["abc", "x".repeat(41), "code;inject", "é-accent"]) {
      const response = await open(encodeURIComponent(code), "localhost:3000");
      expect(response.headers.get("location")).toBe("http://localhost:3000/connexion");
      expect(response.cookies.get("tartan_ref")).toBeUndefined();
    }
  });
});

describe("limiteur de connexion (T16)", () => {
  it("est actif en production, même si un test demande de le couper ; coupé seulement hors Vercel", () => {
    expect(rateLimitEnabled({ VERCEL_ENV: "production", E2E_DISABLE_RATE_LIMIT: "true" } as never)).toBe(true);
    expect(rateLimitEnabled({ NODE_ENV: "production" } as never)).toBe(true);
    expect(rateLimitEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" } as never)).toBe(true);
    expect(rateLimitEnabled({ NODE_ENV: "production", E2E_DISABLE_RATE_LIMIT: "true" } as never)).toBe(false);
    expect(rateLimitEnabled({ NODE_ENV: "development" } as never)).toBe(false);
  });

  it("garde ses compteurs en base, et serre les routes de connexion", () => {
    const limiter = auth.options.rateLimit!;
    expect(limiter).toMatchObject({ storage: "database", modelName: "rateLimit", window: 60, max: 60 });
    expect(limiter.customRules).toMatchObject({
      "/sign-in/*": { window: 60, max: 10 },
      "/sign-up/*": { window: 60, max: 5 },
      "/magic-link/*": { window: 60, max: 5 },
    });
  });
});

describe("vérification renforcée de la console (T17)", () => {
  let admin: { email: string; userId: string; sessionId: string };
  let coach: { email: string; userId: string; sessionId: string };
  const NOW = new Date("2030-05-02T10:00:00Z");

  beforeAll(async () => {
    env().ADMIN_EMAILS = "";
    const user = await makeUser("Garde");
    await prisma.platformAdmin.create({ data: { email: user.email } });
    const other = await makeUser("PasAdmin");
    const session = (userId: string) =>
      prisma.session.create({
        data: { userId, token: `jeton-${userId}`, expiresAt: new Date("2031-01-01") },
      });
    admin = { ...user, sessionId: (await session(user.userId)).id };
    coach = { ...other, sessionId: (await session(other.userId)).id };
  });

  it("refuse un non-admin, puis un admin sans passkey vérifiée", async () => {
    await expect(requireStepUp(coach, STEP_UP_READ_MS, NOW)).rejects.toMatchObject({ status: 403 });
    await expect(requireStepUp(admin, STEP_UP_READ_MS, NOW)).rejects.toMatchObject({ code: "step_up_required" });
    await expect(requireStepUp({ ...admin, sessionId: undefined }, STEP_UP_READ_MS, NOW)).rejects.toMatchObject({
      code: "step_up_required",
    });
  });

  it("une vérification vaut 12 heures pour lire, 10 minutes pour l'argent", async () => {
    await recordStepUp(admin.sessionId, "passkey", new Date(NOW.getTime() - 11 * 60_000));
    await expect(requireStepUp(admin, STEP_UP_READ_MS, NOW)).resolves.toBeUndefined();
    await expect(requireStepUp(admin, STEP_UP_MONEY_MS, NOW)).rejects.toMatchObject({ code: "step_up_required" });
    await recordStepUp(admin.sessionId, "passkey", new Date(NOW.getTime() - STEP_UP_READ_MS - 1));
    await expect(requireStepUp(admin, STEP_UP_READ_MS, NOW)).rejects.toMatchObject({ code: "step_up_required" });
    await recordStepUp(admin.sessionId, "passkey", NOW);
    await expect(requireStepUp(admin, STEP_UP_MONEY_MS, NOW)).resolves.toBeUndefined();
  });

  it("le contournement des tests de navigateur n'agit jamais sur Vercel", async () => {
    vi.stubEnv("E2E_DISABLE_ADMIN_STEP_UP", "true");
    await expect(requireStepUp({ ...admin, sessionId: undefined }, STEP_UP_READ_MS, NOW)).resolves.toBeUndefined();
    vi.stubEnv("VERCEL", "1");
    await expect(requireStepUp({ ...admin, sessionId: undefined }, STEP_UP_READ_MS, NOW)).rejects.toMatchObject({
      code: "step_up_required",
    });
  });

  it("chaque page de la console passe par la même garde : accueil pour un coach, vérification pour un admin", async () => {
    const { default: AdminLayout } = await import("../app/(app)/admin/layout");
    const pages = walk(path.join(WEB, "app/(app)/admin")).filter((file) => file.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThan(8);
    // Une seule mise en page couvre tout le dossier : aucune page de la console n'en sort par un groupe de routes.
    for (const page of pages) expect(path.relative(path.join(WEB, "app/(app)/admin"), page)).not.toMatch(/\(/);

    space.actor = coach;
    await expect(AdminLayout({ children: null })).rejects.toThrow("redirect:/accueil");
    space.actor = { ...admin, sessionId: randomUUID() };
    await expect(AdminLayout({ children: null })).rejects.toThrow("redirect:/verification-admin");
    await recordStepUp(admin.sessionId, "passkey", new Date());
    space.actor = admin;
    await expect(AdminLayout({ children: "console" })).resolves.toBe("console");
  });

  it("chaque action et chaque route de la console exigent la vérification", () => {
    const actions = walk(path.join(WEB, "src/features/admin")).filter((file) => file.endsWith(".action.ts"));
    expect(actions.length).toBeGreaterThan(0);
    for (const file of actions) {
      const source = readFileSync(file, "utf8");
      const exported = [...source.matchAll(/^export const (\w+) = (\w+)/gm)];
      expect(exported.length, file).toBeGreaterThan(0);
      for (const [, name, client] of exported) expect(client, `${path.basename(file)} : ${name}`).toBe("adminAction");
    }
    const routes = walk(path.join(WEB, "app/(app)/admin")).filter((file) => file.endsWith("route.ts"));
    for (const file of routes) expect(readFileSync(file, "utf8"), file).toMatch(/requireStepUp\(/);
  });
});
