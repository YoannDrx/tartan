import { type CreateOrganizationInput, type GroupInput } from "@tartan/contracts";
import { type PlanKey, referralCodeFor, STARTER_LIBRARY } from "@tartan/domain";
import { randomId } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";
import { m } from "@tartan/i18n";
import { put } from "@vercel/blob";
import { env } from "@/lib/env";
import { AppError, invalid, notFound } from "@/lib/errors";
import { coachGroupIds, requireOrgMember, requireGroupInScope, type Access } from "./access";
import { firstNameOf } from "./me.service";
import { assertWithinPlan, ensurePlans, syncEntitlements } from "./billing.service";
import { attributeReferral } from "./referral.service";

// Les adresses de la liste sont celles du pilote : tout gratuit. Les autres démarrent en Découverte.
const initialPlan = (email: string): PlanKey => {
  const listed = env()
    .COACH_SIGNUP_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase());
  return listed.includes(email.trim().toLowerCase()) ? "pilot" : "discovery";
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

export const canCreateCoachSpace = (email: string): boolean => {
  const { COACH_SIGNUP_MODE, COACH_SIGNUP_EMAILS } = env();
  if (COACH_SIGNUP_MODE === "public") return true;
  const allowed = COACH_SIGNUP_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes(email.trim().toLowerCase());
};

export const createOrganization = async (userId: string, input: CreateOrganizationInput) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  if (!canCreateCoachSpace(user.email)) throw new AppError(403, "signup_closed", m.onboarding.closed);
  await ensurePlans();
  const plan = initialPlan(user.email);
  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        type: input.type,
        disciplines: input.disciplines,
        ownerId: userId,
        plan,
        members: { create: { userId, role: "owner", status: "active" } },
        subscriptions: { create: { planKey: plan, status: "active", provider: "manual" } },
        exercises: {
          create: STARTER_LIBRARY.map((e) => ({
            name: e.name,
            category: e.category,
            cues: e.cues,
            defaultPrescription: e.prescription,
            createdBy: userId,
          })),
        },
      },
    });
    const group = await tx.group.create({ data: { organizationId: org.id, name: input.firstGroupName } });
    await tx.groupCoach.create({ data: { groupId: group.id, userId, role: "lead" } });
    return { ...org, firstGroupId: group.id };
  });
  await syncEntitlements(organization.id, plan);
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
  input: { name: string; overdueReminders: boolean; disciplines?: string[] },
) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  await prisma.organization.update({ where: { id: organizationId }, data: input });
};

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

export const saveOrganizationLogo = async (userId: string, organizationId: string, file: File): Promise<void> => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  if (!env().BLOB_READ_WRITE_TOKEN) throw invalid("L'envoi d'images n'est pas configuré sur ce serveur.");
  if (!LOGO_TYPES.includes(file.type)) throw invalid("Choisis une image JPEG, PNG ou WebP.");
  if (file.size > MAX_LOGO_BYTES) throw invalid("Cette image dépasse 4 Mo.");
  const blob = await put(`logos/${organizationId}/${crypto.randomUUID()}`, file, {
    access: "public",
    contentType: file.type,
  });
  await prisma.organization.update({ where: { id: organizationId }, data: { logoUrl: blob.url } });
};

export const saveGroup = async (userId: string, organizationId: string, input: GroupInput) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  const data = { name: input.name, color: input.color ?? null, level: input.level ?? null, goal: input.goal ?? null };
  if (input.id) {
    await requireGroupInScope(access, [input.id]);
    return prisma.group.update({ where: { id: input.id }, data });
  }
  await assertWithinPlan(organizationId, "maxGroups");
  return prisma.group.create({
    data: { ...data, organizationId, coaches: { create: { userId, role: "lead" } } },
  });
};

export const deleteGroup = async (userId: string, organizationId: string, groupId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageOrganization");
  await requireGroupInScope(access, [groupId]);
  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { targetType: "group", targetId: groupId } }),
    prisma.group.delete({ where: { id: groupId } }),
  ]);
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
