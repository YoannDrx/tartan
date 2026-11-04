import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addCoachNote } from "@/server/athlete.service";
import { exportMyData } from "@/server/export.service";
import { addAthlete, makeOrg } from "./helpers";

const prepare = async () => {
  const a = await makeOrg("Export");
  const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
  const other = await addAthlete(a.organizationId, a.groupId, "Autre");
  return { a, athlete, other };
};

describe("export des données", () => {
  it("contient une vidéo non partagée, sans jeton de session ni d'appareil", async () => {
    const { a, athlete } = await prepare();
    await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: athlete.athleteId,
        uploadedBy: a.owner.userId,
        sharedWithAthlete: false,
        recordedAt: new Date("2030-06-10T10:00:00Z"),
      },
    });
    await prisma.device.create({
      data: { userId: athlete.userId, platform: "ios", pushToken: "ExponentPushToken[secret-appareil]" },
    });
    await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        token: "secret-session",
        userId: athlete.userId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const data = await exportMyData(athlete.userId);
    expect(data.athletes[0]!.videos).toHaveLength(1);
    expect(data.athletes[0]!.videos[0]).toMatchObject({ sharedWithAthlete: false });
    expect(data.athletes[0]!.athleteConsents.map((c) => c.kind).sort()).toEqual(["health", "video"]);
    expect(data.devices).toHaveLength(1);
    expect(data.sessions).toHaveLength(1);
    const text = JSON.stringify(data);
    expect(text).not.toContain("secret-appareil");
    expect(text).not.toContain("secret-session");
  });
  it("ne contient ni note du coach, ni donnée d'un autre athlète", async () => {
    const { a, athlete, other } = await prepare();
    await addCoachNote(a.owner.userId, a.organizationId, athlete.athleteId, "Note privée du coach");
    await prisma.strengthTest.create({
      data: {
        organizationId: a.organizationId,
        athleteId: other.athleteId,
        exerciseKey: "back_squat",
        value: 199,
        kind: "one_rm",
        date: new Date("2030-06-10T00:00:00Z"),
      },
    });
    const text = JSON.stringify(await exportMyData(athlete.userId));
    expect(text).not.toContain("Note privée");
    expect(text).not.toContain("199");
    expect(text).not.toContain(other.email);
  });
  it("limite le nombre d'exports", async () => {
    const { athlete } = await prepare();
    for (let i = 0; i < 5; i += 1) await exportMyData(athlete.userId);
    await expect(exportMyData(athlete.userId)).rejects.toMatchObject({ status: 429 });
  });
});
