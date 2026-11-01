import { type CreateOrganizationInput, type GroupInput } from "@tartan/contracts";
import { referralCodeFor } from "@tartan/domain";
import { randomId } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { coachGroupIds, requireOrgMember, requireGroupInScope, type Access } from "./access";
import { firstNameOf } from "./me.service";
import { attributeReferral } from "./referral.service";

const PILOT_ENTITLEMENTS = { max_athletes: null, video_retention_days: null };

export const ensurePlans = async (): Promise<void> => {
  const plans = [
    { key: "pilot", name: "Pilote", limits: {} },
    { key: "discovery", name: "Découverte", limits: {} },
    { key: "coach", name: "Coach", limits: {} },
    { key: "club", name: "Club", limits: {} },
  ];
  await prisma.plan.createMany({ data: plans, skipDuplicates: true });
};

export const ensureReferralCode = async (userId: string): Promise<string> => {
  const existing = await prisma.referralCode.findUnique({
    where: { ownerType_ownerId: { ownerType: "user", ownerId: userId } },
  });
  if (existing) return existing.code;
  const firstName = await firstNameOf(userId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = referralCodeFor(firstName, randomId());
    const taken = await prisma.referralCode.findUnique({ where: { code } });
    if (!taken) {
      await prisma.referralCode.create({ data: { ownerType: "user", ownerId: userId, code } });
      return code;
    }
  }
  throw new Error("referral_code_collision");
};

export const createOrganization = async (userId: string, input: CreateOrganizationInput) => {
  await ensurePlans();
  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        type: input.type,
        disciplines: input.disciplines,
        ownerId: userId,
        plan: "pilot",
        members: { create: { userId, role: "owner", status: "active" } },
        subscriptions: { create: { planKey: "pilot", status: "active", provider: "manual" } },
        entitlements: {
          create: Object.entries(PILOT_ENTITLEMENTS).map(([key, value]) => ({
            key,
            value: value === null ? { unlimited: true } : value,
            source: "plan" as const,
          })),
        },
      },
    });
    const group = await tx.group.create({ data: { organizationId: org.id, name: input.firstGroupName } });
    await tx.groupCoach.create({ data: { groupId: group.id, userId, role: "lead" } });
    return { ...org, firstGroupId: group.id };
  });
  await ensureReferralCode(userId);
  if (input.referralCode)
    await attributeReferral({ userId, code: input.referralCode, organizationId: organization.id });
  return organization;
};

export const listGroups = async (access: Access) => {
  const mine = access.role === "owner" ? null : await coachGroupIds(access);
  const groups = await prisma.group.findMany({
    where: { organizationId: access.organizationId, ...(mine ? { id: { in: mine } } : {}) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      level: true,
      goal: true,
      _count: { select: { members: true } },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    level: g.level,
    goal: g.goal,
    athleteCount: g._count.members,
  }));
};

export const getOrganization = async (userId: string, organizationId: string) => {
  await requireOrgMember(userId, organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, type: true, plan: true, logoUrl: true, disciplines: true, overdueReminders: true },
  });
  if (!org) throw notFound();
  return org;
};

export const updateOrganization = async (
  userId: string,
  organizationId: string,
  input: { name: string; overdueReminders: boolean },
) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  await prisma.organization.update({ where: { id: organizationId }, data: input });
};

export const saveGroup = async (userId: string, organizationId: string, input: GroupInput) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  const data = { name: input.name, color: input.color ?? null, level: input.level ?? null, goal: input.goal ?? null };
  if (input.id) {
    await requireGroupInScope(access, [input.id]);
    return prisma.group.update({ where: { id: input.id }, data });
  }
  return prisma.group.create({
    data: { ...data, organizationId, coaches: { create: { userId, role: "lead" } } },
  });
};

export const deleteGroup = async (userId: string, organizationId: string, groupId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageOrganization");
  await requireGroupInScope(access, [groupId]);
  await prisma.group.delete({ where: { id: groupId } });
};

export const listStaff = async (userId: string, organizationId: string) => {
  await requireOrgMember(userId, organizationId, "viewTracking");
  const rows = await prisma.organizationMember.findMany({
    where: { organizationId, role: { in: ["owner", "coach", "assistant"] } },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => ({ userId: r.user.id, name: r.user.name, email: r.user.email, role: r.role }));
};

export const coachesOfAthlete = async (organizationId: string, athleteId: string): Promise<string[]> => {
  const rows = await prisma.groupCoach.findMany({
    where: { group: { organizationId, members: { some: { athleteId } } } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const owner = await prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } });
  return [...new Set([...rows.map((r) => r.userId), ...(owner ? [owner.ownerId] : [])])];
};
