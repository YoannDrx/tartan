import { athleteWelcomeResponse } from "@tartan/contracts";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../app/api/v1/orgs/[orgId]/athlete/welcome/route";
import { prisma } from "@/lib/prisma";
import { addAthlete, makeOrg } from "./helpers";
import { sessionCookie } from "./personas";

// L'accueil de l'athlète lu par l'app native : le contrat, et ce qu'il dit à l'arrivée puis après une semaine.
const read = async (cookie: string, orgId: string) => {
  const response = await GET(
    new NextRequest(`http://localhost:3000/api/v1/orgs/${orgId}/athlete/welcome`, { headers: { cookie } }),
    { params: Promise.resolve({ orgId }) },
  );
  return { status: response.status, body: await response.json() };
};

describe("GET /api/v1/orgs/[orgId]/athlete/welcome", () => {
  it("nomme le groupe et le coach à l'arrivée, puis plus rien après une semaine", async () => {
    const a = await makeOrg("Accueil");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Lila");
    const cookie = await sessionCookie(athlete.email);

    const first = await read(cookie, a.organizationId);
    expect(first.status).toBe(200);
    const parsed = athleteWelcomeResponse.parse(first.body);
    expect(parsed.welcome).toEqual({ group: "Hauteur Élite", coach: "Accueil" });

    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: a.organizationId, userId: athlete.userId } },
      data: { createdAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    expect((await read(cookie, a.organizationId)).body).toEqual({ welcome: null });
  });
});
