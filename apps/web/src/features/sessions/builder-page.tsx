import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { todayIso } from "@/lib/dates";
import { requireOrgMember } from "@/server/access";
import { listAthletes } from "@/server/athlete.service";
import { listExercises } from "@/server/exercise.service";
import { listGroups } from "@/server/org.service";
import { getSessionForEdit, listTemplates, listTestKeys } from "@/server/session.service";
import { SessionBuilder } from "./session-builder";

const COMMON_TESTS = Object.keys(m.strengthTest);

export const BuilderPage = async ({
  userId,
  organizationId,
  sessionId,
  defaultDate,
}: {
  userId: string;
  organizationId: string;
  sessionId?: string;
  defaultDate?: string;
}) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const [initial, exercises, groups, athletes, templates, keys] = await Promise.all([
    sessionId ? getSessionForEdit(userId, organizationId, sessionId) : Promise.resolve(null),
    listExercises(userId, organizationId),
    listGroups(access),
    listAthletes(userId, organizationId),
    listTemplates(userId, organizationId),
    listTestKeys(userId, organizationId),
  ]);
  const testKeys = [...new Set([...keys, ...COMMON_TESTS])];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={initial ? initial.draft.title : m.coach.newSession} />
      <SessionBuilder
        initial={initial}
        exercises={exercises}
        groups={groups}
        athletes={athletes}
        templates={templates}
        testKeys={testKeys}
        defaultDate={defaultDate ?? todayIso()}
      />
    </div>
  );
};
