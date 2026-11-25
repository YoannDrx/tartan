import { getMe } from "@/server/me.service";
import { encouragementLabels } from "@tartan/i18n";
import type { Metadata } from "next";
import { SessionMode } from "@/features/athlete-view/session-mode";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession, getAthleteToday } from "@/server/athlete-view.service";

export const metadata: Metadata = { title: encouragementLabels.modeTitle };

export default async function ModePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const { id } = await params;
  const session = await orNotFound(() => getAthleteSession(actor.userId, organizationId, id));
  const [today, me] = await Promise.all([getAthleteToday(actor.userId, organizationId), getMe(actor.userId)]);
  return (
    <SessionMode
      tone={me.preferences?.sessionTone ?? "calm"}
      session={session}
      organizationId={organizationId}
      healthConsent={today.healthConsent}
    />
  );
}
