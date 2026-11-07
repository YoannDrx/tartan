import { sessionBuilderContext } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { requireOrgMember } from "./access";
import { listAthletes } from "./athlete.service";
import { listExercises } from "./exercise.service";
import { listGroups } from "./org.service";
import { listTemplates, listTestKeys } from "./session.service";

// Le constructeur reçoit seulement les destinataires nécessaires, sans notes ni santé.
export const getSessionBuilderContext = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const [exercises, groups, athletes, templates, keys] = await Promise.all([
    listExercises(userId, organizationId),
    listGroups(access),
    listAthletes(userId, organizationId),
    listTemplates(userId, organizationId),
    listTestKeys(userId, organizationId),
  ]);
  return sessionBuilderContext.parse({
    exercises,
    groups,
    templates,
    athletes: athletes.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    testKeys: [...new Set([...keys, ...Object.keys(m.strengthTest)])],
  });
};
