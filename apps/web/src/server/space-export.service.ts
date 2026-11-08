import { forbidden } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { audit, requireOrgMember } from "./access";

// Portabilité pour le propriétaire qui quitte Tartan : programmation, groupes, charges réalisées.
// Jamais d'effort ressenti, de douleur, de blessure ni de note privée : ces données restent attachées à l'athlète.
export const exportSpace = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId);
  if (access.role !== "owner") throw forbidden();
  await enforceRateLimit(`space-export:${organizationId}`, 5, 3600);
  const where = { organizationId };
  const [organization, groups, athletes, exercises, templates, sessions, phases, competitions, performances, setLogs] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, type: true, disciplines: true, createdAt: true },
      }),
      prisma.group.findMany({
        where,
        select: { id: true, name: true, goal: true, members: { select: { athleteId: true } } },
      }),
      prisma.athlete.findMany({ where, select: { id: true, firstName: true, lastName: true, disciplines: true } }),
      prisma.exercise.findMany({
        where,
        select: { id: true, name: true, category: true, tags: true, cues: true, defaultPrescription: true },
      }),
      prisma.sessionTemplate.findMany({
        where,
        select: {
          title: true,
          type: true,
          durationMin: true,
          coachNote: true,
          blocks: {
            orderBy: { position: "asc" },
            select: {
              name: true,
              variant: true,
              items: { orderBy: { position: "asc" }, select: { exerciseId: true, prescription: true } },
            },
          },
        },
      }),
      prisma.scheduledSession.findMany({
        where,
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          startTime: true,
          location: true,
          title: true,
          type: true,
          publishedAt: true,
          snapshot: true,
          assignments: { select: { targetType: true, targetId: true } },
          logs: { select: { athleteId: true, status: true, variantDone: true } },
        },
      }),
      prisma.trainingPhase.findMany({
        where: { ...where, deletedAt: null },
        select: { name: true, kind: true, startDate: true, endDate: true, objective: true },
      }),
      prisma.competition.findMany({ where, select: { name: true, date: true, location: true } }),
      prisma.performance.findMany({
        where,
        select: { athleteId: true, discipline: true, mark: true, unit: true, wind: true, date: true },
      }),
      prisma.setLog.findMany({
        where: { log: { session: { organizationId } } },
        select: { sessionLogId: true, itemRef: true, setIndex: true, reps: true, loadKg: true, done: true },
      }),
    ]);
  await audit({ organizationId, actorId: userId, action: "space_exported", entity: "organization", entityId: organizationId });
  return {
    exportedAt: new Date().toISOString(),
    organization,
    groups,
    athletes,
    exercises,
    templates,
    sessions,
    phases,
    competitions,
    performances,
    setLogs,
  };
};
