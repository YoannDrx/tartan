import { describe, expect, it, vi } from "vitest";
import { ageStatus } from "@tartan/domain";
import { prisma } from "@/lib/prisma";
import { outbox } from "@/lib/mail";
import { assertMemberAge, confirmBirthDate } from "@/server/age.service";
import { deleteAccount } from "@/server/account.service";
import { requireOrgMember } from "@/server/access";
import { getUserConsents, setConsent } from "@/server/consent.service";
import { exportMyData } from "@/server/export.service";
import { saveAthlete } from "@/server/athlete.service";
import { acceptInvitation, createInvitation, groupInvitationLink } from "@/server/invitation.service";
import { updateProfile } from "@/server/me.service";
import { createOrganization, ensureReferralCode } from "@/server/org.service";
import { attributeReferral } from "@/server/referral.service";
import { makeOrg, makeUser } from "./helpers";

const NOW = new Date("2030-06-12T10:00:00Z");
const accept = { firstName: "Noa", lastName: "Test", consents: { terms: true, health: true, video: true } };
const actorOf = (user: { userId: string; email: string }) => ({ userId: user.userId, email: user.email });
const organization = { name: "Espace", type: "independent" as const, disciplines: [], firstGroupName: "Groupe" };
const code = (status: number, value: string) => expect.objectContaining({ status, code: value });

describe("règle d'âge", () => {
  it("la veille des 18 ans reste mineur, le jour même est majeur", () => {
    expect(ageStatus("2012-06-13", NOW)).toBe("minor");
    expect(ageStatus("2012-06-12", NOW)).toBe("adult");
    expect(ageStatus(null, NOW)).toBe("unknown");
  });
  it("le jour de Paris décide, pas celui de Londres", () => {
    // 23 h 30 UTC le 11 juin = déjà le 12 juin à Paris.
    expect(() => assertMemberAge(new Date("2012-06-12T00:00:00Z"), new Date("2030-06-11T23:30:00Z"))).not.toThrow();
  });
});

describe("création d'espace", () => {
  it("refuse un coach mineur et un âge inconnu, ce qui couvre aussi l'API", async () => {
    const minor = await makeUser("Jeune", { birthDate: "2015-01-01" });
    await expect(createOrganization(minor.userId, organization)).rejects.toEqual(code(403, "age_restricted"));
    const unknown = await makeUser("Inconnu", { birthDate: null });
    await expect(createOrganization(unknown.userId, organization)).rejects.toEqual(code(400, "invalid"));
    expect(await prisma.organization.count({ where: { ownerId: { in: [minor.userId, unknown.userId] } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorId: minor.userId, action: "minor_declared" } })).toBe(1);
  });
  it("accepte une date transmise avec la demande et l'enregistre", async () => {
    const user = await makeUser("Sans", { birthDate: null });
    await createOrganization(user.userId, { ...organization, birthDate: "1990-01-01" });
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.userId } });
    expect(profile.birthDate?.toISOString().slice(0, 10)).toBe("1990-01-01");
  });
});

describe("invitations", () => {
  const prepare = async () => {
    const org = await makeOrg("Âge");
    const { link } = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
    return { ...org, token: link.split("/").at(-1)! };
  };

  it("un mineur est refusé sur un lien de groupe, sans membre ni e-mail parental", async () => {
    const a = await prepare();
    const child = await makeUser("Noa", { birthDate: null });
    const before = outbox.length;
    await expect(acceptInvitation(actorOf(child), a.token, { ...accept, birthDate: "2015-01-01" })).rejects.toEqual(
      code(403, "age_restricted"),
    );
    expect(outbox.length).toBe(before);
    expect(await prisma.organizationMember.count({ where: { userId: child.userId } })).toBe(0);
    expect(await prisma.guardian.count({ where: { guardianEmail: { contains: "noa" } } })).toBe(0);
  });
  it("la date est exigée pour tous les rôles, et l'invitation n'est pas consommée", async () => {
    const a = await prepare();
    const { link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "qr",
      role: "coach",
      groupIds: [a.groupId],
    });
    const token = link.split("/").at(-1)!;
    const none = await makeUser("Coach", { birthDate: null });
    await expect(acceptInvitation(actorOf(none), token, { ...accept, birthDate: null })).rejects.toEqual(
      code(400, "invalid"),
    );
    const row = await prisma.invitation.findFirstOrThrow({
      where: { organizationId: a.organizationId, role: "coach" },
    });
    expect(row.useCount).toBe(0);
    await expect(acceptInvitation(actorOf(none), token, { ...accept, birthDate: "1990-01-01" })).resolves.toMatchObject(
      { parentalConsentRequired: false },
    );
  });
  it("une fiche préparée à 12 ans refuse l'acceptation, même avec une date majeure saisie", async () => {
    const a = await prepare();
    const sheet = await prisma.athlete.create({
      data: {
        organizationId: a.organizationId,
        firstName: "Petit",
        lastName: "Test",
        birthDate: new Date("2018-01-01T00:00:00Z"),
      },
    });
    const { link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "qr",
      groupIds: [a.groupId],
      athleteId: sheet.id,
    });
    const token = link.split("/").at(-1)!;
    const user = await makeUser("Petit", { birthDate: null });
    await expect(acceptInvitation(actorOf(user), token, { ...accept, birthDate: "2000-01-01" })).rejects.toEqual(
      code(403, "age_restricted"),
    );
    expect(await prisma.athlete.count({ where: { id: sheet.id, userId: null } })).toBe(1);
    const state = await prisma.invitation.findFirstOrThrow({ where: { athleteId: sheet.id } });
    expect(state.useCount).toBe(0);
    expect(state.status).not.toBe("accepted");
  });
  it("un profil déjà déclaré mineur ne se corrige pas par une autre saisie", async () => {
    const a = await prepare();
    const child = await makeUser("Noa", { birthDate: "2015-01-01" });
    await expect(acceptInvitation(actorOf(child), a.token, { ...accept, birthDate: "2000-01-01" })).rejects.toEqual(
      code(403, "age_restricted"),
    );
  });
});

describe("fiche et profil", () => {
  it("la fiche du coach exige une date majeure", async () => {
    const a = await makeOrg("Fiche");
    const base = { firstName: "Léa", lastName: "Test", groupIds: [a.groupId] };
    await expect(saveAthlete(a.owner.userId, a.organizationId, base)).rejects.toEqual(code(400, "invalid"));
    await expect(saveAthlete(a.owner.userId, a.organizationId, { ...base, birthDate: "2015-01-01" })).rejects.toEqual(
      code(403, "age_restricted"),
    );
    await expect(
      saveAthlete(a.owner.userId, a.organizationId, { ...base, birthDate: "2000-01-01" }),
    ).resolves.toMatchObject({ stillVisible: true });
  });
  it("le profil n'accepte ni effacement ni date mineure", async () => {
    const user = await makeUser("Profil");
    await updateProfile(user.userId, { firstName: "Profil", lastName: "Test", birthDate: null });
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.userId } });
    expect(profile.birthDate).not.toBeNull();
    await expect(
      updateProfile(user.userId, { firstName: "Profil", lastName: "Test", birthDate: "2015-01-01" }),
    ).rejects.toEqual(code(403, "age_restricted"));
  });
  it("un mineur ne participe pas au parrainage", async () => {
    const a = await makeOrg("Parrain");
    const referralCode = await ensureReferralCode(a.owner.userId);
    const child = await makeUser("Noa", { birthDate: "2015-01-01" });
    expect(await attributeReferral({ userId: child.userId, code: referralCode })).toBe(false);
  });
});

describe("compte sans date ou mineur", () => {
  it("un compte sans date est bloqué, puis passe après confirmation, fiches comprises", async () => {
    const a = await makeOrg("Sans date");
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { birthDate: null } });
    await expect(requireOrgMember(a.owner.userId, a.organizationId)).rejects.toEqual(code(403, "age_required"));
    const sheet = await prisma.athlete.create({
      data: { organizationId: a.organizationId, userId: a.owner.userId, firstName: "A", lastName: "B" },
    });
    await confirmBirthDate(a.owner.userId, "1990-05-05");
    await expect(requireOrgMember(a.owner.userId, a.organizationId)).resolves.toMatchObject({ role: "owner" });
    const copied = await prisma.athlete.findUniqueOrThrow({ where: { id: sheet.id } });
    expect(copied.birthDate?.toISOString().slice(0, 10)).toBe("1990-05-05");
  });
  it("une seconde écriture est refusée", async () => {
    const user = await makeUser("Double", { birthDate: null });
    await confirmBirthDate(user.userId, "1990-05-05");
    await expect(confirmBirthDate(user.userId, "1980-05-05")).rejects.toEqual(code(409, "age_already_set"));
  });
  it("une date mineure est enregistrée, refusée, et l'accès se ferme", async () => {
    const a = await makeOrg("Mineur");
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { birthDate: null } });
    await expect(confirmBirthDate(a.owner.userId, "2015-05-05")).rejects.toEqual(code(403, "age_restricted"));
    await expect(requireOrgMember(a.owner.userId, a.organizationId)).rejects.toEqual(code(403, "age_restricted"));
    await expect(confirmBirthDate(a.owner.userId, "1990-05-05")).rejects.toEqual(code(409, "age_already_set"));
  });
  it("export, consentements et suppression restent ouverts", async () => {
    const user = await makeUser("Sortie", { birthDate: "2015-01-01" });
    await expect(exportMyData(user.userId)).resolves.toBeTruthy();
    await setConsent(user.userId, "health", false);
    expect((await getUserConsents(user.userId)).health).toBe(false);
    await expect(deleteAccount(user.userId)).resolves.not.toThrow();
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(0);
  });
  it("le parcours parental reste possible s'il est réactivé", async () => {
    vi.stubEnv("PARENTAL_FLOW_ENABLED", "true");
    try {
      const user = await makeUser("Dormant", { birthDate: "2015-01-01" });
      expect(() => assertMemberAge(new Date("2015-01-01T00:00:00Z"))).not.toThrow();
      await expect(createOrganization(user.userId, organization)).resolves.toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
