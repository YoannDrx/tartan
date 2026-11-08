import { PageHeader } from "@/components/states";
import { todayIso } from "@/lib/dates";
import { getSessionForEdit } from "@/server/session.service";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import { m } from "@tartan/i18n";
import { SessionBuilder } from "./session-builder";

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
  const [initial, context] = await Promise.all([
    sessionId ? getSessionForEdit(userId, organizationId, sessionId) : Promise.resolve(null),
    getSessionBuilderContext(userId, organizationId),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={initial ? initial.draft.title : m.coach.newSession} />
      <SessionBuilder
        organizationId={organizationId}
        initial={initial}
        {...context}
        defaultDate={defaultDate ?? todayIso()}
      />
    </div>
  );
};
