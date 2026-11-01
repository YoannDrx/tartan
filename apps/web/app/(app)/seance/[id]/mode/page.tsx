import type { Metadata } from "next";
import { SessionMode } from "@/features/athlete-view/session-mode";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession, getAthleteToday } from "@/server/athlete-view.service";

export const metadata: Metadata = { title: "Mode séance" };

export default async function ModePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const { id } = await params;
  const session = await orNotFound(() => getAthleteSession(actor.userId, organizationId, id));
  const today = await getAthleteToday(actor.userId, organizationId);
  return <SessionMode session={session} organizationId={organizationId} healthConsent={today.healthConsent} />;
}
