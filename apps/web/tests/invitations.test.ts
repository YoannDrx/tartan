import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  groupInvitationLink,
  regenerateInvitationLink,
  revokeInvitation,
} from "@/server/invitation.service";
import { makeOrg, makeUser } from "./helpers";

const accept = {
  firstName: "Arrivant",
  lastName: "Test",
  birthDate: "2000-01-01",
  consents: { terms: true, health: false, video: false },
};
const actorOf = (user: { userId: string; email: string }) => ({ userId: user.userId, email: user.email });
const tokenOf = (link: string) => link.split("/").at(-1)!;

describe("lien de groupe", () => {
  let org: Awaited<ReturnType<typeof makeOrg>>;
  let link: { id: string; link: string };
  beforeEach(async () => {
    org = await makeOrg("Lien");
    link = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
  });

  it("dure 14 jours par défaut", async () => {
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: link.id } });
    const days = (row.expiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  });
  it("un lien expiré est refusé", async () => {
    await prisma.invitation.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const user = await makeUser("Tard");
    await expect(acceptInvitation(actorOf(user), tokenOf(link.link), accept)).rejects.toThrow();
    expect(await prisma.organizationMember.count({ where: { userId: user.userId } })).toBe(0);
  });
  it("le propriétaire est prévenu de chaque arrivée, sans donnée de santé", async () => {
    const user = await makeUser("Arrivant");
    await acceptInvitation(actorOf(user), tokenOf(link.link), accept);
    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: org.owner.userId, type: "member_joined" },
    });
    expect(notification.payload).toMatchObject({ athlete: "Arrivant", organizationId: org.organizationId });
    expect(String((notification.payload as { link: string }).link)).toMatch(/^\/athletes\//);
  });
  it("un lien révoqué est refusé", async () => {
    await revokeInvitation(org.owner.userId, org.organizationId, link.id);
    const user = await makeUser("Coupe");
    await expect(acceptInvitation(actorOf(user), tokenOf(link.link), accept)).rejects.toThrow();
  });
  it("changer le lien coupe l'ancien et ouvre le nouveau", async () => {
    const fresh = await regenerateInvitationLink(org.owner.userId, org.organizationId, link.id);
    const late = await makeUser("Ancien");
    await expect(acceptInvitation(actorOf(late), tokenOf(link.link), accept)).rejects.toThrow();
    const user = await makeUser("Nouveau");
    await expect(acceptInvitation(actorOf(user), tokenOf(fresh.link), accept)).resolves.toMatchObject({
      organizationId: org.organizationId,
    });
  });
});
