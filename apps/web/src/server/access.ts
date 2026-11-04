import type { OrgRole } from "@tartan/contracts";
import { can, type Permission, scopeOf } from "@tartan/domain";
import { forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertMemberAge } from "./age.service";

export type Access = {
  userId: string;
  organizationId: string;
  role: OrgRole;
  // Fiche de l'utilisateur quand il est athlète dans cette organisation.
  athleteId: string | null;
};

// Toute lecture ou écriture passe par ici : appartenance et rôle (§ 11.4).
export const requireOrgMember = async (
  userId: string,
  organizationId: string,
  permission?: Permission,
): Promise<Access> => {
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, status: true, user: { select: { profile: { select: { birthDate: true } } } } },
  });
  if (!member || member.status !== "active") throw forbidden();
  assertMemberAge(member.user.profile?.birthDate);
  if (permission && !can(member.role, permission)) throw forbidden();
  const athlete =
    member.role === "athlete"
      ? await prisma.athlete.findUnique({
          where: { organizationId_userId: { organizationId, userId } },
          select: { id: true },
        })
      : null;
  return { userId, organizationId, role: member.role, athleteId: athlete?.id ?? null };
};

export const requireAthleteAccess = async (
  userId: string,
  organizationId: string,
): Promise<Access & { athleteId: string }> => {
  const access = await requireOrgMember(userId, organizationId);
  if (access.role !== "athlete" || !access.athleteId) throw forbidden();
  return { ...access, athleteId: access.athleteId };
};

export const coachGroupIds = async (access: Access): Promise<string[]> => {
  const rows = await prisma.groupCoach.findMany({
    where: { userId: access.userId, group: { organizationId: access.organizationId } },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
};

// Athlètes visibles par ce membre : tout pour le propriétaire, ses groupes pour un coach.
export const visibleAthleteIds = async (access: Access): Promise<string[]> => {
  if (access.role === "athlete") return access.athleteId ? [access.athleteId] : [];
  if (access.role === "guardian") return [];
  if (access.role === "owner") {
    const rows = await prisma.athlete.findMany({
      where: { organizationId: access.organizationId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  const groupIds = await coachGroupIds(access);
  const rows = await prisma.groupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { athleteId: true },
    distinct: ["athleteId"],
  });
  return rows.map((r) => r.athleteId);
};

export const requireVisibleAthlete = async (access: Access, athleteId: string): Promise<void> => {
  const athlete = await prisma.athlete.findFirst({
    where: { id: athleteId, organizationId: access.organizationId },
    select: { id: true },
  });
  if (!athlete) throw notFound();
  const ids = await visibleAthleteIds(access);
  if (!ids.includes(athleteId)) throw forbidden();
};

export const requireGroupInScope = async (access: Access, groupIds: string[]): Promise<void> => {
  if (groupIds.length === 0) return;
  const known = await prisma.group.count({
    where: { id: { in: groupIds }, organizationId: access.organizationId },
  });
  if (known !== new Set(groupIds).size) throw notFound();
  if (access.role === "owner") return;
  const mine = await coachGroupIds(access);
  if (!groupIds.every((id) => mine.includes(id))) throw forbidden();
};

// Une référence transmise par le client doit appartenir à l'espace : le schéma ne l'impose pas.
export const requireOwnedRefs = async (
  organizationId: string,
  refs: { sessionId?: string | null; competitionId?: string | null; videoId?: string | null },
): Promise<void> => {
  const [session, competition, video] = await Promise.all([
    refs.sessionId ? prisma.scheduledSession.count({ where: { id: refs.sessionId, organizationId } }) : 1,
    refs.competitionId ? prisma.competition.count({ where: { id: refs.competitionId, organizationId } }) : 1,
    refs.videoId ? prisma.video.count({ where: { id: refs.videoId, organizationId } }) : 1,
  ]);
  if (!session || !competition || !video) throw notFound();
};

export const audit = async (input: {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
}): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
    },
  });
};
