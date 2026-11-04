import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { m } from "@tartan/i18n";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deleteGroup } from "@/server/org.service";
import {
  acceptInvitation,
  createInvitation,
  groupInvitationLink,
  invitationConflictMessage,
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
  it("un lien vers un groupe supprimé donne un message clair, sans fiche", async () => {
    await deleteGroup(org.owner.userId, org.organizationId, org.groupId);
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.status).toBe("revoked");
    expect(row.groupIds).toEqual([]);
    const user = await makeUser("Perdu");
    await expect(acceptInvitation(actorOf(user), tokenOf(link.link), accept)).rejects.toMatchObject({
      message: m.invite.revoked,
    });
    expect(await prisma.athlete.count({ where: { userId: user.userId } })).toBe(0);
  });
  it("un lien de plusieurs groupes survit à la suppression de l'un d'eux", async () => {
    const other = await prisma.group.create({ data: { organizationId: org.organizationId, name: "Autre" } });
    await prisma.invitation.update({ where: { id: link.id }, data: { groupIds: [org.groupId, other.id] } });
    await deleteGroup(org.owner.userId, org.organizationId, org.groupId);
    const user = await makeUser("Reste");
    await acceptInvitation(actorOf(user), tokenOf(link.link), accept);
    const groups = await prisma.groupMember.findMany({ where: { athlete: { userId: user.userId } } });
    expect(groups.map((g) => g.groupId)).toEqual([other.id]);
  });
  it("un groupe disparu d'une ancienne invitation n'empêche pas d'arriver", async () => {
    const other = await prisma.group.create({ data: { organizationId: org.organizationId, name: "Autre" } });
    await prisma.invitation.update({
      where: { id: link.id },
      data: { groupIds: [other.id, randomUUID()] },
    });
    const user = await makeUser("Ancien");
    await expect(acceptInvitation(actorOf(user), tokenOf(link.link), accept)).resolves.toBeTruthy();
  });
  it("un coach sur son propre lien ne devient pas athlète", async () => {
    await expect(acceptInvitation(actorOf(org.owner), tokenOf(link.link), accept)).rejects.toMatchObject({
      status: 409,
      code: "already_staff",
    });
    expect(await prisma.athlete.count({ where: { userId: org.owner.userId } })).toBe(0);
    await expect(invitationConflictMessage(tokenOf(link.link), org.owner.userId)).resolves.toBe(m.invite.alreadyStaff);
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.useCount).toBe(0);
  });
  it("une invitation de coach parle à un coach, pas à un athlète", async () => {
    const email = `coach-${Date.now()}@test.tartan.coach`;
    await createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      role: "coach",
      email,
      groupIds: [org.groupId],
    });
    const mail = outbox.find((entry) => entry.to === email)!;
    expect(mail.subject).toContain("dans l'espace");
    expect(mail.html).not.toContain("séances arriveront");
    expect(mail.html).toContain("Rejoindre l&#x27;espace");
  });
  it("un athlète invité comme coach est refusé", async () => {
    const user = await makeUser("Athlète");
    await acceptInvitation(actorOf(user), tokenOf(link.link), accept);
    const invite = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "qr",
      role: "coach",
      groupIds: [org.groupId],
    });
    await expect(acceptInvitation(actorOf(user), tokenOf(invite.link), accept)).rejects.toMatchObject({
      status: 409,
      code: "role_conflict",
    });
    const member = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: org.organizationId, userId: user.userId } },
    });
    expect(member.role).toBe("athlete");
  });
});
