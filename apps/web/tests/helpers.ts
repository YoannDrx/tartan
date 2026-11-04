import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { setConsent } from "@/server/consent.service";
import { syncEntitlements } from "@/server/billing.service";
import { createOrganization } from "@/server/org.service";

export const makeUser = async (firstName: string, opts: { birthDate?: string } = {}) => {
  const id = randomUUID();
  const slug = firstName
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();
  const email = `${slug}-${id.slice(0, 8)}@test.tartan.coach`;
  await prisma.user.create({
    data: {
      id,
      name: firstName,
      email,
      emailVerified: true,
      profile: {
        create: {
          firstName,
          lastName: "Test",
          birthDate: opts.birthDate ? new Date(`${opts.birthDate}T00:00:00Z`) : null,
        },
      },
    },
  });
  return { userId: id, email };
};

export const makeOrg = async (coachName = "Thomas") => {
  const owner = await makeUser(coachName);
  const org = await createOrganization(owner.userId, {
    name: `Coaching ${coachName}`,
    type: "independent",
    disciplines: ["high_jump"],
    firstGroupName: "Hauteur Élite",
  });
  // Les tests d'accès ne portent pas sur les offres : espace sans limite, sauf test dédié.
  await prisma.organization.update({ where: { id: org.id }, data: { plan: "pilot" } });
  await syncEntitlements(org.id, "pilot");
  return { owner, organizationId: org.id, groupId: org.firstGroupId };
};

export const addAthlete = async (
  organizationId: string,
  groupId: string | null,
  firstName: string,
  opts: { health?: boolean; video?: boolean; birthDate?: string; joinedAt?: Date } = {},
) => {
  const user = await makeUser(firstName, { birthDate: opts.birthDate });
  await prisma.organizationMember.create({
    data: { organizationId, userId: user.userId, role: "athlete", status: "active" },
  });
  const athlete = await prisma.athlete.create({
    data: {
      organizationId,
      userId: user.userId,
      firstName,
      lastName: "Test",
      birthDate: opts.birthDate ? new Date(`${opts.birthDate}T00:00:00Z`) : null,
      // Les scénarios historiques utilisent un membre déjà présent. Les tests d'arrivée fixent leur date.
      ...(groupId
        ? { groups: { create: { groupId, createdAt: opts.joinedAt ?? new Date("2020-01-01T10:00:00Z") } } }
        : {}),
    },
  });
  await setConsent(user.userId, "terms", true, athlete.id);
  await setConsent(user.userId, "health", opts.health ?? true, athlete.id);
  await setConsent(user.userId, "video", opts.video ?? true, athlete.id);
  return { ...user, athleteId: athlete.id };
};

export const addStaff = async (
  organizationId: string,
  firstName: string,
  role: "coach" | "assistant",
  groupIds: string[] = [],
) => {
  const user = await makeUser(firstName);
  await prisma.organizationMember.create({ data: { organizationId, userId: user.userId, role, status: "active" } });
  for (const groupId of groupIds) {
    await prisma.groupCoach.create({
      data: { groupId, userId: user.userId, role: role === "assistant" ? "assistant" : "lead" },
    });
  }
  return user;
};
