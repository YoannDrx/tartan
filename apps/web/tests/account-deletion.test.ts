import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/server/account.service";
import { answerSatisfaction } from "@/server/satisfaction.service";
import { createInvitation } from "@/server/invitation.service";
import { addAthlete, makeOrg } from "./helpers";

describe("suppression de compte", () => {
  it("ne laisse ni coordonnées d'invitation ni réponse de satisfaction, et coupe les sessions", async () => {
    const a = await makeOrg("Purge");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    await createInvitation(a.owner.userId, a.organizationId, {
      kind: "personal_email",
      email: athlete.email,
      groupIds: [a.groupId],
    });
    await answerSatisfaction(athlete.userId, a.organizationId, { recommend: true, comment: "Bien" });
    await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        userId: athlete.userId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await deleteAccount(athlete.userId);
    expect(await prisma.invitation.count({ where: { email: athlete.email } })).toBe(0);
    expect(await prisma.satisfactionAnswer.count({ where: { userId: athlete.userId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: athlete.userId } })).toBe(0);
    expect(await prisma.user.count({ where: { id: athlete.userId } })).toBe(0);
    // L'espace du coach reste en place.
    expect(await prisma.organization.count({ where: { id: a.organizationId } })).toBe(1);
  });
});
