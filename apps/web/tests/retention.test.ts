import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { RETENTION_DAYS, runRetention } from "@/server/retention.service";
import { makeOrg, makeUser } from "./helpers";

const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("durées de conservation", () => {
  it("journal d'audit : la veille de l'échéance reste, le lendemain part", async () => {
    const stay = randomUUID();
    const gone = randomUUID();
    await prisma.auditLog.createMany({
      data: [
        { action: "test", entity: stay, at: daysAgo(RETENTION_DAYS.auditLog - 1) },
        { action: "test", entity: gone, at: daysAgo(RETENTION_DAYS.auditLog + 1) },
      ],
    });
    await runRetention(NOW);
    expect(await prisma.auditLog.count({ where: { entity: stay } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: gone } })).toBe(0);
  });
  it("notifications à 90 jours", async () => {
    const user = await makeUser("Notif");
    const row = (days: number) =>
      prisma.notification.create({
        data: {
          userId: user.userId,
          type: "comment",
          payload: {},
          createdAt: daysAgo(days),
          deliverAfter: daysAgo(days),
        },
      });
    const stay = await row(RETENTION_DAYS.notification - 1);
    const gone = await row(RETENTION_DAYS.notification + 1);
    await runRetention(NOW);
    expect(await prisma.notification.count({ where: { id: stay.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { id: gone.id } })).toBe(0);
  });
  it("coordonnées d'invitation effacées 30 jours après l'expiration, l'invitation reste", async () => {
    const a = await makeOrg("Invit");
    const row = (days: number, email: string) =>
      prisma.invitation.create({
        data: {
          organizationId: a.organizationId,
          kind: "personal_email",
          email,
          tokenHash: randomUUID(),
          expiresAt: daysAgo(days),
          invitedBy: a.owner.userId,
        },
      });
    const stay = await row(29, "reste@test.tartan.coach");
    const gone = await row(31, "part@test.tartan.coach");
    await runRetention(NOW);
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: stay.id } })).email).not.toBeNull();
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: gone.id } })).email).toBeNull();
  });
  it("une fiche sans compte part après 12 mois sans activité", async () => {
    const a = await makeOrg("Fiche");
    const old = await prisma.athlete.create({
      data: { organizationId: a.organizationId, firstName: "Ancien", lastName: "Test", updatedAt: daysAgo(400) },
    });
    const recent = await prisma.athlete.create({
      data: { organizationId: a.organizationId, firstName: "Récent", lastName: "Test", updatedAt: daysAgo(300) },
    });
    await runRetention(NOW);
    expect(await prisma.athlete.count({ where: { id: old.id } })).toBe(0);
    expect(await prisma.athlete.count({ where: { id: recent.id } })).toBe(1);
  });
  it("une fiche ancienne encore suivie par le coach reste", async () => {
    const a = await makeOrg("Suivie");
    const followed = await prisma.athlete.create({
      data: { organizationId: a.organizationId, firstName: "Suivi", lastName: "Test", updatedAt: daysAgo(400) },
    });
    await prisma.coachNote.create({
      data: {
        organizationId: a.organizationId,
        athleteId: followed.id,
        authorId: a.owner.userId,
        body: "Note récente",
        updatedAt: daysAgo(10),
      },
    });
    await runRetention(NOW);
    expect(await prisma.athlete.count({ where: { id: followed.id } })).toBe(1);
  });
  it("un compte inactif reçoit d'abord un préavis, puis disparaît 30 jours plus tard", async () => {
    const user = await makeUser("Inactif");
    await prisma.profile.update({ where: { id: user.userId }, data: { lastActiveAt: daysAgo(731) } });
    await runRetention(NOW);
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(1);
    expect(outbox.some((mail) => mail.to === user.email && mail.subject.includes("va être supprimé"))).toBe(true);
    // À J+29 : toujours là.
    await runRetention(new Date(NOW.getTime() + 29 * DAY));
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(1);
    await runRetention(new Date(NOW.getTime() + 31 * DAY));
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(0);
  });
  it("se reconnecter lève le préavis", async () => {
    const user = await makeUser("Retour");
    await prisma.profile.update({ where: { id: user.userId }, data: { lastActiveAt: daysAgo(731) } });
    await runRetention(NOW);
    await prisma.profile.update({
      where: { id: user.userId },
      data: { lastActiveAt: NOW, inactivityNoticeAt: null },
    });
    await runRetention(new Date(NOW.getTime() + 31 * DAY));
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(1);
  });
  it("un compte actif ne reçoit rien", async () => {
    const user = await makeUser("Actif");
    await prisma.profile.update({ where: { id: user.userId }, data: { lastActiveAt: daysAgo(100) } });
    await runRetention(NOW);
    expect(outbox.some((mail) => mail.to === user.email && mail.subject.includes("va être supprimé"))).toBe(false);
  });
});
