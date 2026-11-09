import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { emailCatalog } from "../emails/catalog";
import { prisma } from "@/lib/prisma";
import { hasAiConsent, requireAiConsent } from "@/server/ai/consent.service";
import { isAdmin } from "@/server/admin.service";
import { adminCanEnroll, addPlatformAdmin, removePlatformAdmin } from "@/server/production-status.service";
import { platformSettings, updatePlatformSettings } from "@/server/platform-settings.service";
import { updatePreferences } from "@/server/me.service";
import { makeOrg } from "./helpers";

const root = { email: process.env.ADMIN_EMAILS?.split(",")[0] ?? "", userId: randomUUID() };

describe("accord IA", () => {
  it("rien ne part sans accord, et l'accord se retire", async () => {
    const { owner } = await makeOrg("Accord IA");
    await expect(requireAiConsent(owner.userId)).rejects.toMatchObject({ status: 409, code: "ai_consent_required" });
    await updatePreferences(owner.userId, { aiConsent: true });
    expect(await hasAiConsent(owner.userId)).toBe(true);
    await updatePreferences(owner.userId, { aiConsent: false });
    expect(await hasAiConsent(owner.userId)).toBe(false);
  });
});

describe("console de la plateforme", () => {
  it("les réglages valent sans redéploiement et restent tracés", async () => {
    const admin = { ...root, email: root.email || "racine@test.local" };
    await prisma.platformAdmin.upsert({
      where: { email: admin.email },
      create: { email: admin.email },
      update: {},
    });
    await updatePlatformSettings(admin, { signupMode: "closed", checkoutEnabled: false, muxVideoLimit: 12 });
    expect(await platformSettings()).toEqual({ signupMode: "closed", checkoutEnabled: false, muxVideoLimit: 12 });
    expect(await prisma.auditLog.count({ where: { action: "platform_settings_updated" } })).toBeGreaterThan(0);
    await prisma.platformSetting.deleteMany();
    await prisma.platformAdmin.deleteMany({ where: { email: admin.email } });
  });

  it("une adresse hors de la racine ne nomme personne", async () => {
    const intruder = { email: "intrus@test.local", userId: randomUUID() };
    await expect(addPlatformAdmin(intruder, "autre@test.local")).rejects.toMatchObject({ status: 403 });
    await expect(removePlatformAdmin(intruder, "autre@test.local")).rejects.toMatchObject({ status: 403 });
    expect(await isAdmin("autre@test.local")).toBe(false);
  });

  it("un administrateur ajouté accède à la console et dispose de 24 h pour sa passkey", async () => {
    const email = `invite-${randomUUID()}@test.local`;
    await prisma.platformAdmin.create({ data: { email, enrollUntil: new Date(Date.now() + 3_600_000) } });
    expect(await isAdmin(email.toUpperCase())).toBe(true);
    expect(await adminCanEnroll(email)).toBe(true);
    await prisma.platformAdmin.update({ where: { email }, data: { enrollUntil: new Date(Date.now() - 1000) } });
    expect(await adminCanEnroll(email)).toBe(false);
    await prisma.platformAdmin.delete({ where: { email } });
    expect(await isAdmin(email)).toBe(false);
  });
});

describe("catalogue d'e-mails", () => {
  it("chaque gabarit se rend, avec un objet et un lien", async () => {
    const samples = emailCatalog("https://app.tartan.coach");
    expect(new Set(samples.map((sample) => sample.key)).size).toBe(samples.length);
    for (const sample of samples) {
      expect(sample.subject.length, sample.key).toBeGreaterThan(5);
      const html = await render(sample.react);
      if (sample.key !== "account_deleted") expect(html, sample.key).toContain("https://app.tartan.coach");
      expect(html, sample.key).not.toContain("undefined");
    }
  });
});
