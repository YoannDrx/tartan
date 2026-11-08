import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendWeeklyDigests } from "@/server/digest.service";
import { makeOrg } from "./helpers";

const mocks = vi.hoisted(() => ({ email: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendEmail: mocks.email }));

// Dimanche 16 juin 2030.
const at = (hour: number) => new Date(Date.UTC(2030, 5, 16, hour - 2));

const prepare = async (name: string) => {
  const org = await makeOrg(name);
  await prisma.scheduledSession.create({
    data: {
      organizationId: org.organizationId,
      createdBy: org.owner.userId,
      date: new Date("2030-06-12T00:00:00Z"),
      title: "Séance",
      type: "strength",
      draft: {},
      publishedAt: new Date("2030-06-10T10:00:00Z"),
    },
  });
  return org;
};
const sentTo = (email: string) =>
  mocks.email.mock.calls.filter(([mail]) => mail.to === email && mail.subject.includes("Ta semaine"));

beforeEach(async () => {
  mocks.email.mockReset().mockResolvedValue(undefined);
  await prisma.sessionTemplate.deleteMany({ where: { organization: { name: { in: ["Coaching Un", "Coaching Deux", "Coaching Coupé"] } } } });
  await prisma.organization.deleteMany({ where: { name: { in: ["Coaching Un", "Coaching Deux", "Coaching Coupé"] } } });
});

describe("récapitulatif hebdomadaire", () => {
  it("part à 18 h, se rattrape à 19 h, une seule fois, avec une clé et un lien vers l'espace", async () => {
    const a = await prepare("Un");
    await sendWeeklyDigests(at(17));
    expect(sentTo(a.owner.email)).toHaveLength(0);
    await sendWeeklyDigests(at(19));
    await sendWeeklyDigests(at(20));
    const calls = sentTo(a.owner.email);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0].idempotencyKey).toBe(`digest/${a.organizationId}/2030-06-10`);
    expect(calls[0]![0].unsubscribeUrl).toContain("/api/email/desinscription/digest/");
  });
  it("un espace en échec n'arrête pas les suivants, et l'échec reste visible", async () => {
    const a = await prepare("Un");
    const b = await prepare("Deux");
    mocks.email.mockImplementation(async ({ to }: { to: string }) => {
      if (to === a.owner.email) throw new Error("email_failed");
    });
    await expect(sendWeeklyDigests(at(18))).rejects.toThrow("cron_digest_failed");
    expect(sentTo(b.owner.email)).toHaveLength(1);
    // L'espace en échec repart au passage suivant.
    mocks.email.mockResolvedValue(undefined);
    await sendWeeklyDigests(at(19));
    expect(sentTo(a.owner.email)).toHaveLength(2);
    expect(sentTo(b.owner.email)).toHaveLength(1);
  });
  it("une préférence coupée est respectée", async () => {
    const a = await prepare("Coupé");
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { emailDigest: false } });
    await sendWeeklyDigests(at(18));
    expect(sentTo(a.owner.email)).toHaveLength(0);
  });
});
