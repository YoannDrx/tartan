import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CARD, recordCardImage } from "@/features/progress/record-card";
import { addPerformance, performanceCard } from "@/server/performance.service";
import { addAthlete, makeOrg } from "./helpers";

const mark = (athleteId: string, value: number) => ({
  athleteId,
  discipline: "Saut en hauteur",
  mark: value,
  unit: "m" as const,
  date: "2030-06-10",
  location: "Stade de la Plaine",
  wind: 1.2,
  clientId: randomUUID(),
});

describe("carte de record", () => {
  it("seul un record battu a sa carte, qui ne montre ni lieu ni vent", async () => {
    const org = await makeOrg("Carte");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Inès");
    const first = await addPerformance(org.owner.userId, org.organizationId, mark(athlete.athleteId, 1.7));
    // La première marque est la référence : pas encore un record battu.
    await expect(performanceCard(athlete.userId, org.organizationId, athlete.athleteId, first.id)).rejects.toThrow();
    const record = await addPerformance(org.owner.userId, org.organizationId, mark(athlete.athleteId, 1.78));
    const card = await performanceCard(athlete.userId, org.organizationId, athlete.athleteId, record.id);
    expect(card).toEqual({
      firstName: "Inès",
      discipline: "Saut en hauteur",
      mark: 1.78,
      unit: "m",
      date: "2030-06-10",
    });
    // Le coach lit la carte de son athlète.
    await expect(
      performanceCard(org.owner.userId, org.organizationId, athlete.athleteId, record.id),
    ).resolves.toMatchObject({ mark: 1.78 });
  });

  it("un autre athlète, ou un autre espace, n'y a pas accès", async () => {
    const org = await makeOrg("Carte A");
    const other = await makeOrg("Carte B");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Inès");
    const teammate = await addAthlete(org.organizationId, org.groupId, "Noé");
    await addPerformance(org.owner.userId, org.organizationId, mark(athlete.athleteId, 1.7));
    const record = await addPerformance(org.owner.userId, org.organizationId, mark(athlete.athleteId, 1.8));
    await expect(performanceCard(teammate.userId, org.organizationId, athlete.athleteId, record.id)).rejects.toThrow();
    await expect(
      performanceCard(other.owner.userId, org.organizationId, athlete.athleteId, record.id),
    ).rejects.toThrow();
  });

  it("l'image est un PNG portrait, au format des stories", async () => {
    const image = await recordCardImage({
      firstName: "Inès",
      discipline: "Lancer du disque 1,5 kg en salle",
      mark: 38.42,
      unit: "m",
      date: "2030-06-10",
    });
    expect(image.headers.get("content-type")).toBe("image/png");
    const { width, height } = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    expect({ width, height }).toEqual(CARD);
  });
});
