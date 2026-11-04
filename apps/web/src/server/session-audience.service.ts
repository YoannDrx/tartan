import { isSessionAssigned } from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const computeAudience = async (sessionId: string, options: { includeLogged: boolean }): Promise<string[]> => {
  const session = await prisma.scheduledSession.findUnique({
    where: { id: sessionId },
    select: { organizationId: true, date: true, assignments: true, logs: { select: { athleteId: true } } },
  });
  if (!session) return [];
  const direct = session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  const groups = session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const logged = new Set(options.includeLogged ? session.logs.map((l) => l.athleteId) : []);
  // Les attributions polymorphes peuvent être anciennes : toujours vérifier l'existence et l'espace.
  const athletes = await prisma.athlete.findMany({
    where: {
      organizationId: session.organizationId,
      OR: [{ id: { in: [...direct, ...logged] } }, { groups: { some: { groupId: { in: groups } } } }],
    },
    select: { id: true, groups: { select: { groupId: true, createdAt: true } } },
  });
  return athletes
    .filter((a) =>
      isSessionAssigned({
        date: fromDbDate(session.date),
        assignments: session.assignments,
        athleteId: a.id,
        hasLog: logged.has(a.id),
        groups: a.groups.map((g) => ({ groupId: g.groupId, joinedOn: todayIso(g.createdAt) })),
      }),
    )
    .map((a) => a.id);
};

// Historique du suivi : garde quiconque a un log, même après son départ du groupe.
export const audienceAthleteIds = (sessionId: string): Promise<string[]> =>
  computeAudience(sessionId, { includeLogged: true });

// Destinataires réels : un log, même « manqué », ne suffit pas à rester sollicité après un départ.
export const activeAudienceIds = (sessionId: string): Promise<string[]> =>
  computeAudience(sessionId, { includeLogged: false });

// Même règle pour le calendrier, le détail, la validation et le flux iCal.
// Les dates sont à l'intérieur de OR pour ne pas être écrasées par la plage demandée.
export const athleteAssignedWhere = async (athleteId: string): Promise<Prisma.ScheduledSessionWhereInput> => {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      organizationId: true,
      groups: { select: { groupId: true, createdAt: true } },
    },
  });
  if (!athlete) return { id: { in: [] } };
  return {
    organizationId: athlete.organizationId,
    publishedAt: { not: null },
    OR: [
      { logs: { some: { athleteId } } },
      { assignments: { some: { targetType: "athlete", targetId: athleteId } } },
      ...athlete.groups.map((group) => ({
        date: { gte: toDbDate(todayIso(group.createdAt)) },
        assignments: { some: { targetType: "group" as const, targetId: group.groupId } },
      })),
    ],
  };
};

export const deleteAthleteAssignments = (tx: Prisma.TransactionClient, athleteIds: string[]) =>
  tx.assignment.deleteMany({ where: { targetType: "athlete", targetId: { in: athleteIds } } });
