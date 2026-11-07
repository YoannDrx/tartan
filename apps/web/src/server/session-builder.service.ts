import { sessionBuilderContext } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { m } from "@tartan/i18n";
import { requireOrgMember } from "./access";
import { listAthletes } from "./athlete.service";
import { listExercises } from "./exercise.service";
import { listGroups } from "./org.service";
import { listTemplates, listTestKeys } from "./session.service";

// Le constructeur reçoit seulement les destinataires nécessaires, sans notes ni santé.
export const getSessionBuilderContext = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const [exercises, groups, athletes, templates, keys, space] = await Promise.all([
    listExercises(userId, organizationId),
    listGroups(access),
    listAthletes(userId, organizationId),
    listTemplates(userId, organizationId),
    listTestKeys(userId, organizationId),
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { progressionEnabled: true } }),
  ]);
  return sessionBuilderContext.parse({
    exercises,
    groups,
    templates,
    athletes: athletes.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    testKeys: [
      ...new Set([
        ...keys,
        ...Object.keys(m.strengthTest),
        ...(space.progressionEnabled
          ? exercises
              .filter((e) => e.strengthLoadKind === "external_total" || e.strengthLoadKind === "added_weight")
              .map((e) => `exercise:${e.id}`)
          : []),
      ]),
    ],
  });
};
