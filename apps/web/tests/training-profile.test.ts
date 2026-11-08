import { describe, expect, it } from "vitest";
import { createOrganizationInput, organizationUpdateInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { createOrganization, getOrganization, updateOrganization } from "@/server/org.service";
import { addAthlete, makeOrg, makeUser } from "./helpers";

const selected = {
  disciplines: ["sprint", "hurdles"],
  trainingObjectives: ["speed", "strength"] as const,
  availableEquipment: ["barbell", "track"] as const,
};
const update = () => organizationUpdateInput.parse({ name: "Préparation athlé", overdueReminders: false, ...selected });

describe("profil sportif de l’espace", () => {
  it("ne choisit aucune discipline ou matériel pour un ancien client", async () => {
    const owner = await makeUser("Découverte");
    const parsed = createOrganizationInput.parse({ name: "Athlé", type: "club", firstGroupName: "U18" });
    expect(parsed).toMatchObject({ disciplines: [], trainingObjectives: [], availableEquipment: [] });
    const org = await createOrganization(owner.userId, parsed);
    expect(await getOrganization(owner.userId, org.id)).toMatchObject({
      disciplines: [],
      trainingObjectives: [],
      availableEquipment: [],
    });
  });

  it("conserve les choix dédupliqués et l’objectif distinct du groupe", async () => {
    const owner = await makeUser("Préparation");
    const input = createOrganizationInput.parse({
      name: "Athlé",
      type: "independent",
      firstGroupName: "Sprint",
      firstGroupGoal: "  Préparer la saison  ",
      ...selected,
      trainingObjectives: ["speed", "strength", "speed"],
    });
    const org = await createOrganization(owner.userId, input);
    expect(await getOrganization(owner.userId, org.id)).toMatchObject(selected);
    expect(await prisma.group.findUnique({ where: { id: org.firstGroupId } })).toMatchObject({
      goal: "Préparer la saison",
    });
  });

  it("une mise à jour ancienne préserve les champs nouveaux et les clés historiques", async () => {
    const org = await makeOrg();
    await updateOrganization(org.owner.userId, org.organizationId, { ...update(), disciplines: ["legacy_custom"] });
    await updateOrganization(org.owner.userId, org.organizationId, { name: "Autre nom", overdueReminders: true });
    expect(await getOrganization(org.owner.userId, org.organizationId)).toMatchObject({
      ...selected,
      name: "Autre nom",
      disciplines: ["legacy_custom"],
    });
    await updateOrganization(org.owner.userId, org.organizationId, {
      name: "Autre nom",
      overdueReminders: true,
      trainingObjectives: [],
    });
    expect(await getOrganization(org.owner.userId, org.organizationId)).toMatchObject({
      trainingObjectives: [],
      availableEquipment: selected.availableEquipment,
      disciplines: ["legacy_custom"],
    });
  });

  it("interdit l’écriture à un athlète et à un autre espace", async () => {
    const org = await makeOrg();
    const other = await makeOrg("Autre");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Athlète");
    for (const actor of [athlete.userId, other.owner.userId]) {
      await expect(updateOrganization(actor, org.organizationId, update())).rejects.toMatchObject({ status: 403 });
    }
    await expect(getOrganization(other.owner.userId, org.organizationId)).rejects.toMatchObject({ status: 403 });
    expect(await getOrganization(org.owner.userId, org.organizationId)).toMatchObject({
      trainingObjectives: [],
      availableEquipment: [],
    });
  });

  it("refuse les objectifs, matériels et longueurs invalides sans écrire", async () => {
    const org = await makeOrg();
    expect(
      createOrganizationInput.safeParse({
        name: "Athlé",
        type: "club",
        firstGroupName: "U18",
        firstGroupGoal: "x".repeat(281),
      }).success,
    ).toBe(false);
    for (const field of ["trainingObjectives", "availableEquipment"]) {
      const invalid = { ...update(), [field]: ["unknown"] };
      expect(organizationUpdateInput.safeParse(invalid).success).toBe(false);
      await expect(updateOrganization(org.owner.userId, org.organizationId, invalid)).rejects.toBeTruthy();
    }
    expect(await getOrganization(org.owner.userId, org.organizationId)).toMatchObject({
      trainingObjectives: [],
      availableEquipment: [],
    });
  });
});
