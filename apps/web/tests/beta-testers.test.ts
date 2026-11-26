import { createHash, randomUUID } from "node:crypto";
import { currentApk, publishApk } from "@/server/beta-apk.service";
import { recordBetaUse, recordBetaEvent } from "@/server/beta-testers.service";
import { getActorFrom } from "@/lib/session";
import { sessionCookie } from "./personas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deriveToken } from "@/lib/tokens";
import { betaAccess, changeBeta, dispatchBeta, inviteBeta, listBeta } from "@/server/beta-testers.service";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { recordStepUp } from "@/server/admin-step-up.service";
import { makeUser } from "./helpers";
const blobRead = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  get: blobRead,
}));
const remote = vi.hoisted(() => vi.fn(async (_email: string, _wanted: boolean) => true));
vi.mock("@/server/beta-apple", () => ({ syncAppleBeta: remote }));
async function operator() {
  const u = await makeUser("Bêta");
  await prisma.platformAdmin.create({ data: { email: u.email } });
  const sessionId = (await getActorFrom(new Headers({ cookie: await sessionCookie(u.email) })))!.sessionId!;
  await recordStepUp(sessionId, "passkey");
  return { ...u, sessionId };
}
beforeEach(() => {
  outbox.length = 0;
  remote.mockReset();
  remote.mockResolvedValue(true);
});
afterEach(() => {
  Object.assign(env(), {
    BETA_INVITES_ENABLED: "false",
    BETA_APK_PATH: undefined,
    BETA_APK_READ_WRITE_TOKEN: undefined,
    BETA_APK_VERSION: undefined,
    BETA_APK_BASE_BUILD: undefined,
    BETA_APK_CERT_SHA256: undefined,
  });
});
describe("invitations de bêta", () => {
  it("vérifie la passkey et refuse un utilisateur ordinaire", async () => {
    const u = await makeUser("Visiteur");
    await expect(listBeta(u)).rejects.toMatchObject({ status: 403 });
    const admin = await operator();
    await expect(inviteBeta({ ...admin, sessionId: undefined }, u.email, "both")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("envoie le lien APK disponible si Apple tombe en panne, puis reprend uniquement iOS", async () => {
    const admin = await operator();
    const email = (await makeUser("Les deux plateformes")).email;
    Object.assign(env(), {
      BETA_INVITES_ENABLED: "true",
      BETA_APK_PATH: "test/app.apk",
      BETA_APK_READ_WRITE_TOKEN: "fake",
      BETA_APK_VERSION: "1.1.0",
    });
    const now = new Date();
    const row = await inviteBeta(admin, email, "both", now);
    remote.mockRejectedValueOnce(new Error("provider unavailable"));
    await dispatchBeta(now);
    await flushEmailOutbox(new Date(+now + 1000));
    expect((await listBeta(admin, now)).find((r) => r.id === row.id)).toMatchObject({
      ios: "Échec à reprendre",
      android: "Invitation envoyée",
    });
    await dispatchBeta(new Date(+now + 300001));
    await flushEmailOutbox(new Date(+now + 300001));
    expect(await prisma.emailOutbox.count({ where: { toEmail: email, kind: "beta_install" } })).toBe(1);
    expect((await listBeta(admin)).find((r) => r.id === row.id)).toMatchObject({
      ios: "Invitation envoyée",
      android: "Invitation envoyée",
    });
  });
  it("un double clic conserve le lien, un retrait le coupe et le canal Apple est retiré", async () => {
    const admin = await operator(),
      email = (await makeUser("Testeur")).email;
    const [a, b] = await Promise.all([
      inviteBeta(admin, email, "both"),
      inviteBeta(admin, email.toUpperCase(), "both"),
    ]);
    expect(a.id).toBe(b.id);
    const token = deriveToken("beta-install-v1", a.tokenId);
    const now = new Date();
    await dispatchBeta(now);
    expect(remote).not.toHaveBeenCalled();
    expect(await prisma.emailOutbox.count({ where: { toEmail: email } })).toBe(0);
    Object.assign(env(), {
      BETA_INVITES_ENABLED: "true",
      BETA_APK_PATH: "tests/terrain.apk",
      BETA_APK_READ_WRITE_TOKEN: "test",
      BETA_APK_VERSION: "1.0",
    });
    const later = new Date(+now + 3600010);
    await dispatchBeta(later);
    await dispatchBeta(later);
    expect(await betaAccess(token, later)).toMatchObject({ ios: true, android: true, play: false });
    await flushEmailOutbox(later);
    expect(outbox.filter((e) => e.to === email).every((e) => e.html.includes(token))).toBe(true);
    expect((await listBeta(admin, later)).find((r) => r.id === a.id)?.ios).toBe("Invitation envoyée");
    await changeBeta(admin, a.id, a.version, "revoke", later);
    expect(await betaAccess(token, later)).toBeNull();
    await dispatchBeta(later);
    expect(remote).toHaveBeenCalledWith(email, false);
    const next = await inviteBeta(admin, email, "android", later);
    expect(next.tokenId).not.toBe(a.tokenId);
    expect(await betaAccess(token, later)).toBeNull();
    expect(await betaAccess(deriveToken("beta-install-v1", next.tokenId), new Date(+later + 31 * 86400000))).toBeNull();
  });
});

it("vérifie le candidat et distingue lien, téléchargement et utilisation pour chaque téléphone", async () => {
  const admin = await operator(),
    user = await makeUser("Bêta Android"),
    stranger = await makeUser("Autre compte");
  const now = new Date(),
    tester = await inviteBeta(admin, user.email, "android", now);
  const token = deriveToken("beta-install-v1", tester.tokenId);
  const file = "apk de recette";
  const digest = createHash("sha256").update(file).digest("hex"),
    cert = "a".repeat(64);
  const candidate = { build: 26, version: "1.2", cert, digest };
  Object.assign(env(), {
    BETA_APK_BASE_BUILD: "25",
    BETA_APK_PATH: "old.apk",
    BETA_APK_VERSION: "1.0",
    BETA_APK_CERT_SHA256: cert,
    BETA_APK_READ_WRITE_TOKEN: "test",
  });
  let bytes = "incomplet";
  blobRead.mockImplementation(async (path: string) => {
    const value = path === "beta/staged.json" ? JSON.stringify(candidate) : bytes;
    return { statusCode: 200, blob: { size: value.length }, stream: new Response(value).body };
  });
  await expect(publishApk(admin, digest, now)).rejects.toMatchObject({ status: 400 });
  bytes = file;
  try {
    await Promise.all([publishApk(admin, digest, now), publishApk(admin, digest, now)]);
    expect((await currentApk())?.build).toBe(26);
    expect(await prisma.emailOutbox.count({ where: { dedupeKey: `beta-apk:${tester.id}:26` } })).toBe(1);
    expect((await listBeta(admin)).find((r) => r.id === tester.id)?.openedAt).toBeNull();
    await recordBetaEvent(token, "openedAt", now);
    await recordBetaEvent(token, "apkAt", now);
    expect(await prisma.betaInstallation.count({ where: { testerId: tester.id } })).toBe(0);
    const check = {
      appVersion: "1.1",
      installationId: randomUUID(),
      platform: "android" as const,
      beta: { build: "25", model: "Téléphone de test", os: "16" },
    };
    expect(await recordBetaUse(stranger.userId, check, now)).toBeUndefined();
    expect(await recordBetaUse(user.userId, check, now)).toMatchObject({ build: 26 });
    const later = new Date(+now + 5000);
    expect(await recordBetaUse(user.userId, { ...check, beta: { ...check.beta, build: "26" } }, later)).toBeUndefined();
    const installs = await prisma.betaInstallation.findMany({ where: { testerId: tester.id } });
    expect(installs).toHaveLength(1);
    expect(installs[0]).toMatchObject({ firstSeenAt: now, lastSeenAt: later, build: "26", model: check.beta.model });
    await changeBeta(admin, tester.id, tester.version, "revoke", later);
    expect(await recordBetaEvent(token, "openedAt", later)).toBe(false);
    expect(await recordBetaUse(user.userId, check, later)).toBeUndefined();
  } finally {
    await prisma.betaApkRelease.deleteMany({ where: { digest } });
  }
});
