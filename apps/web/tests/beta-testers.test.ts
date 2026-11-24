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
    BETA_BLOB_TOKEN: undefined,
    BETA_APK_VERSION: undefined,
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
      BETA_BLOB_TOKEN: "test",
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
