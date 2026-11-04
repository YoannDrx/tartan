import { afterEach, describe, expect, it, vi } from "vitest";
import * as mail from "@/lib/mail";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/server/account.service";
import { createOrganization } from "@/server/org.service";
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
    vi.spyOn(mail, "sendEmail").mockRejectedValue(new Error("email_failed"));
    await expect(deleteAccount(a.owner.userId)).resolves.not.toThrow();
    expect(await prisma.user.count({ where: { id: a.owner.userId } })).toBe(0);
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
