import { afterEach, describe, expect, it, vi } from "vitest";
import * as mail from "@/lib/mail";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/server/account.service";
import { createOrganization } from "@/server/org.service";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { runRetention } from "@/server/retention.service";
import { addStaff, makeOrg, makeUser } from "./helpers";

const newSpace = { name: "Mon espace", type: "independent" as const, disciplines: [], firstGroupName: "Groupe" };
const to = (email: string) => outbox.filter((entry) => entry.to === email);

afterEach(() => vi.restoreAllMocks());

describe("messages de compte", () => {
  it("la bienvenue ne part qu'au premier espace, sans offre", async () => {
    const user = await makeUser("Accueil");
    const first = await createOrganization(user.userId, newSpace);
    await prisma.organization.update({ where: { id: first.id }, data: { plan: "coach" } });
    await createOrganization(user.userId, { ...newSpace, name: "Second" });
    const sent = to(user.email).filter((entry) => entry.subject.includes("est prêt"));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.html).not.toMatch(/€|offre/);
  });
  it("une bienvenue qui échoue n'empêche pas de créer l'espace", async () => {
    const user = await makeUser("Panne");
    vi.spyOn(mail, "sendEmail").mockRejectedValue(new Error("email_failed"));
    await expect(createOrganization(user.userId, newSpace)).resolves.toBeTruthy();
  });
  it("l'échec d'envoi ne bloque pas la suppression", async () => {
    const a = await makeOrg("Sortie");
    const sending = vi.spyOn(mail, "sendEmail").mockRejectedValue(new Error("email_failed"));
    await expect(deleteAccount(a.owner.userId)).resolves.not.toThrow();
    expect(await prisma.user.count({ where: { id: a.owner.userId } })).toBe(0);
    const row = await prisma.emailOutbox.findUniqueOrThrow({
      where: { dedupeKey: `account:${a.owner.userId}:deleted` },
    });
    expect(row.sentAt).toBeNull();
    expect(row.attempts).toBe(1);
    sending.mockRestore();
    await flushEmailOutbox(new Date(Date.now() + 6 * 60_000));
    expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).sentAt).not.toBeNull();
    expect(to(a.owner.email).filter((entry) => entry.subject.includes("a été supprimé"))).toHaveLength(1);
  });
  it("une reprise ne confirme pas un transfert devenu obsolète", async () => {
    const a = await makeOrg("Reprise différée");
    const heir = await addStaff(a.organizationId, "Repreneur", "coach");
    const next = await addStaff(a.organizationId, "Responsable suivant", "coach");
    const sending = vi.spyOn(mail, "sendEmail").mockRejectedValue(new Error("email_failed"));
    await deleteAccount(a.owner.userId);
    await prisma.organization.update({ where: { id: a.organizationId }, data: { ownerId: next.userId } });
    sending.mockRestore();
    await flushEmailOutbox(new Date(Date.now() + 6 * 60_000));
    expect(to(heir.email)).toHaveLength(0);
    expect(
      (
        await prisma.emailOutbox.findUniqueOrThrow({
          where: { dedupeKey: `account:${a.owner.userId}:transferred:${a.organizationId}` },
        })
      ).failureCode,
    ).toBe("obsolete");
  });
  it("la purge retire le destinataire et le contenu de confirmation après 30 jours", async () => {
    const a = await makeOrg("Purge du message");
    await deleteAccount(a.owner.userId);
    const key = `account:${a.owner.userId}:deleted`;
    await prisma.emailOutbox.update({
      where: { dedupeKey: key },
      data: { createdAt: new Date(Date.now() - 31 * 86400_000) },
    });
    await runRetention();
    expect(await prisma.emailOutbox.findUnique({ where: { dedupeKey: key } })).toBeNull();
  });
  it("la confirmation de suppression arrive après coup, le repreneur est prévenu", async () => {
    const a = await makeOrg("Départ");
    const heir = await addStaff(a.organizationId, "Repreneur", "coach", [a.groupId]);
    await deleteAccount(a.owner.userId);
    expect(to(a.owner.email).some((entry) => entry.subject.includes("a été supprimé"))).toBe(true);
    const handed = to(heir.email).find((entry) => entry.subject.includes("responsable"));
    expect(handed?.html).toContain("Coaching Départ");
  });
});
