import type { Prisma } from "@/generated/prisma/client";
import type { OrgRole } from "@tartan/contracts";
import { canIn, type Permission } from "@tartan/domain";
import { forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertMemberAge } from "./age.service";

export type Access = {
  userId: string;
  organizationId: string;
  role: OrgRole;
  // Fiche de l'utilisateur quand il est athlète dans cette organisation.
  athleteId: string | null;
  // Espace personnel d'un athlète autonome : il en est l'unique membre et planifie pour sa seule fiche.
  personal: boolean;
};

// Toute lecture ou écriture passe par ici : appartenance et rôle (§ 11.4).
export const requireOrgMember = async (
  userId: string,
  organizationId: string,
  permission?: Permission,
  db: Prisma.TransactionClient = prisma,
): Promise<Access> => {
  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      role: true,
      status: true,
      user: { select: { profile: { select: { birthDate: true } } } },
      organization: { select: { isDemo: true, kind: true, personalOwnerId: true } },
    },
  });
  if (!member || member.status !== "active") throw forbidden();
  // Un espace de démonstration n'a qu'un membre, le coach qui l'a ouvert : aucun athlète réel n'y entre jamais.
  if (member.organization.isDemo && member.role !== "owner") throw forbidden();
  // Un espace personnel n'a qu'un membre, son titulaire, athlète de sa propre fiche : personne d'autre n'y entre.
  const personal = member.organization.kind === "personal";
  if (personal && (member.role !== "athlete" || member.organization.personalOwnerId !== userId)) throw forbidden();
  assertMemberAge(member.user.profile?.birthDate);
  if (permission && !canIn(member.organization.kind, member.role, permission)) throw forbidden();
  const athlete =
    member.role === "athlete"
      ? await db.athlete.findUnique({
          where: { organizationId_userId: { organizationId, userId } },
          select: { id: true },
        })
      : null;
  return { userId, organizationId, role: member.role, athleteId: athlete?.id ?? null, personal };
};

// La règle de l'espace pour un accès déjà vérifié : la matrice, ou celle du titulaire d'un espace personnel.
export const accessCan = (access: Access, permission: Permission): boolean =>
  canIn(access.personal ? "personal" : "coach", access.role, permission);

// Le titulaire d'un espace personnel, quand il planifie : la cible est toujours sa propre fiche.
export const personalAthleteOf = (access: Access): string | null =>
  access.personal && access.role === "athlete" ? access.athleteId : null;

export const requireAthleteAccess = async (
  userId: string,
  organizationId: string,
): Promise<Access & { athleteId: string }> => {
  const access = await requireOrgMember(userId, organizationId);
  if (access.role !== "athlete" || !access.athleteId) throw forbidden();
  return { ...access, athleteId: access.athleteId };
};

export const coachGroupIds = async (access: Access, db: Prisma.TransactionClient = prisma): Promise<string[]> => {
  const rows = await db.groupCoach.findMany({
    where: { userId: access.userId, group: { organizationId: access.organizationId } },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
};

// Athlètes visibles par ce membre : tout pour le propriétaire, ses groupes pour un coach.
export const visibleAthleteIds = async (access: Access, db: Prisma.TransactionClient = prisma): Promise<string[]> => {
  if (access.role === "athlete") return access.athleteId ? [access.athleteId] : [];
  if (access.role === "guardian") return [];
  if (access.role === "owner") {
    const rows = await db.athlete.findMany({
      where: { organizationId: access.organizationId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  const groupIds = await coachGroupIds(access, db);
  const rows = await db.groupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { athleteId: true },
    distinct: ["athleteId"],
  });
  return rows.map((r) => r.athleteId);
};

export const requireVisibleAthlete = async (
  access: Access,
  athleteId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<void> => {
  const athlete = await db.athlete.findFirst({
    where: { id: athleteId, organizationId: access.organizationId },
    select: { id: true },
  });
  if (!athlete) throw notFound();
  const ids = await visibleAthleteIds(access, db);
  if (!ids.includes(athleteId)) throw forbidden();
};

export const requireGroupInScope = async (
  access: Access,
  groupIds: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<void> => {
  if (groupIds.length === 0) return;
  const known = await db.group.count({
    where: { id: { in: groupIds }, organizationId: access.organizationId },
  });
  if (known !== new Set(groupIds).size) throw notFound();
  if (access.role === "owner") return;
  const mine = await coachGroupIds(access, db);
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

export const audit = async (
  input: {
    organizationId?: string | null;
    actorId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
  },
  db: Prisma.TransactionClient = prisma,
): Promise<void> => {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
    },
  });
};
