import Link from "next/link";
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
  defaultGroupId,
  returnTo,
}: {
  userId: string;
  organizationId: string;
  sessionId?: string;
  defaultDate?: string;
  defaultGroupId?: string;
  returnTo?: string;
}) => {
  const [initial, context] = await Promise.all([
    sessionId ? getSessionForEdit(userId, organizationId, sessionId) : Promise.resolve(null),
    getSessionBuilderContext(userId, organizationId),
  ]);
  const groupUnavailable = defaultGroupId !== undefined && !context.groups.some((group) => group.id === defaultGroupId);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={initial ? initial.draft.title : m.coach.newSession}
        before={
          returnTo ? (
            <Link href={returnTo} className="inline-flex min-h-11 items-center font-semibold">
              {m.calendar.backToContext}
            </Link>
          ) : undefined
        }
      />
      {groupUnavailable ? <p role="status">{m.calendar.groupUnavailable}</p> : null}
      <SessionBuilder
        organizationId={organizationId}
        initial={initial}
        {...context}
        defaultDate={defaultDate ?? todayIso()}
        defaultGroupId={groupUnavailable ? "" : defaultGroupId}
        returnTo={returnTo}
      />
    </div>
  );
};
