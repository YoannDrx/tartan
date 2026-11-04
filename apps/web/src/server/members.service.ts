import { deleteAthleteAssignments } from "./session-audience.service";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { audit, requireOrgMember, requireVisibleAthlete } from "./access";

// Vue multi-coachs (§ 7.2) : le propriétaire attribue les groupes et gère les rôles.
export const listMembers = async (userId: string, organizationId: string) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  const [rows, groupCoaches] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId, role: { in: ["owner", "coach", "assistant"] } },
      orderBy: { createdAt: "asc" },
      select: { role: true, status: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.groupCoach.findMany({ where: { group: { organizationId } }, select: { userId: true, groupId: true } }),
  ]);
  return rows.map((r) => ({
    userId: r.user.id,
    name: r.user.name,
    email: r.user.email,
    role: r.role,
    status: r.status,
    groupIds: groupCoaches.filter((g) => g.userId === r.user.id).map((g) => g.groupId),
  }));
};

export const updateMember = async (
  userId: string,
  organizationId: string,
  input: { memberId: string; role: "coach" | "assistant"; groupIds: string[] },
) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: input.memberId } },
  });
  if (!member) throw notFound();
  if (member.role === "owner" || member.role === "athlete" || member.role === "guardian") throw forbidden();
  const known = await prisma.group.count({ where: { id: { in: input.groupIds }, organizationId } });
  if (known !== new Set(input.groupIds).size) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId: input.memberId } },
      data: { role: input.role },
    });
    await tx.groupCoach.deleteMany({ where: { userId: input.memberId, group: { organizationId } } });
    await tx.groupCoach.createMany({
      data: input.groupIds.map((groupId) => ({
        groupId,
        userId: input.memberId,
        role: input.role === "assistant" ? ("assistant" as const) : ("lead" as const),
      })),
    });
  });
  await audit({
    organizationId,
    actorId: userId,
    action: "member_updated",
    entity: "member",
    entityId: input.memberId,
  });
};

export const removeCoach = async (userId: string, organizationId: string, memberId: string) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  if (memberId === userId) throw invalid("Tu ne peux pas te retirer de ton propre espace.");
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: memberId } },
  });
  if (!member) throw notFound();
  if (member.role === "owner" || member.role === "athlete" || member.role === "guardian") throw forbidden();
  await prisma.$transaction([
    prisma.groupCoach.deleteMany({ where: { userId: memberId, group: { organizationId } } }),
    prisma.organizationMember.delete({ where: { organizationId_userId: { organizationId, userId: memberId } } }),
  ]);
  await audit({ organizationId, actorId: userId, action: "member_removed", entity: "member", entityId: memberId });
};

// Retirer un athlète de l'espace supprime sa fiche et ses données d'entraînement dans cet espace.
export const removeAthlete = async (userId: string, organizationId: string, athleteId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, athleteId);
  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { id: athleteId }, select: { userId: true } });
  await prisma.$transaction(async (tx) => {
    await deleteAthleteAssignments(tx, [athleteId]);
    await tx.athlete.delete({ where: { id: athleteId } });
    if (athlete.userId) {
      await tx.organizationMember.deleteMany({ where: { organizationId, userId: athlete.userId, role: "athlete" } });
    }
  });
  await audit({ organizationId, actorId: userId, action: "athlete_removed", entity: "athlete", entityId: athleteId });
};

// Un athlète peut quitter un espace de lui-même.
export const leaveOrganization = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId);
  if (access.role === "owner") throw invalid("Transfère ou supprime ton espace pour le quitter.");
  await prisma.$transaction(async (tx) => {
    if (access.athleteId) {
      await deleteAthleteAssignments(tx, [access.athleteId]);
      await tx.athlete.delete({ where: { id: access.athleteId } });
    }
    await tx.groupCoach.deleteMany({ where: { userId, group: { organizationId } } });
    await tx.organizationMember.delete({ where: { organizationId_userId: { organizationId, userId } } });
  });
  await audit({ organizationId, actorId: userId, action: "member_left", entity: "member" });
};
