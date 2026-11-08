import { isSessionAssigned } from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const computeAudience = async (
  sessionId: string,
  options: { includeLogged: boolean },
  db: Prisma.TransactionClient = prisma,
): Promise<string[]> => {
  const session = await db.scheduledSession.findUnique({
    where: { id: sessionId },
    select: { organizationId: true, date: true, assignments: true, logs: { select: { athleteId: true } } },
  });
  if (!session) return [];
  const direct = session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  const groups = session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const logged = new Set(options.includeLogged ? session.logs.map((l) => l.athleteId) : []);
  // Les attributions polymorphes peuvent être anciennes : toujours vérifier l'existence et l'espace.
  const athletes = await db.athlete.findMany({
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
export const activeAudienceIds = (sessionId: string, db: Prisma.TransactionClient = prisma): Promise<string[]> =>
  computeAudience(sessionId, { includeLogged: false }, db);

type AudienceSession = {
  id: string;
  date: Date;
  assignments: { targetType: "group" | "athlete"; targetId: string }[];
};

// Destinataires de plusieurs séances en une seule lecture d'athlètes : même règle que computeAudience.
export const audienceBySession = async (
  organizationId: string,
  sessions: AudienceSession[],
  loggedBySession: Map<string, Set<string>>,
  onlyAthletes?: string[] | null,
): Promise<Map<string, string[]>> => {
  const direct = new Set<string>();
  const groups = new Set<string>();
  for (const session of sessions) {
    for (const a of session.assignments) (a.targetType === "group" ? groups : direct).add(a.targetId);
    for (const id of loggedBySession.get(session.id) ?? []) direct.add(id);
  }
  const athletes = sessions.length
    ? await prisma.athlete.findMany({
        where: {
          organizationId,
          ...(onlyAthletes ? { id: { in: onlyAthletes } } : {}),
          OR: [{ id: { in: [...direct] } }, { groups: { some: { groupId: { in: [...groups] } } } }],
        },
        select: { id: true, groups: { select: { groupId: true, createdAt: true } } },
      })
    : [];
  const candidates = athletes.map((a) => ({
    id: a.id,
    groups: a.groups.map((g) => ({ groupId: g.groupId, joinedOn: todayIso(g.createdAt) })),
  }));
  return new Map(
    sessions.map((session) => {
      const logged = loggedBySession.get(session.id);
      const date = fromDbDate(session.date);
      const audience = candidates
        .filter((a) =>
          isSessionAssigned({
            date,
            assignments: session.assignments,
            athleteId: a.id,
            hasLog: logged?.has(a.id) ?? false,
            groups: a.groups,
          }),
        )
        .map((a) => a.id);
      return [session.id, audience];
    }),
  );
};

// Même règle pour le calendrier, le détail, la validation et le flux iCal.
// Les dates sont à l'intérieur de OR pour ne pas être écrasées par la plage demandée.
export const athleteAssignedWhere = async (
  athleteId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<Prisma.ScheduledSessionWhereInput> => {
  const athlete = await db.athlete.findUnique({
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
