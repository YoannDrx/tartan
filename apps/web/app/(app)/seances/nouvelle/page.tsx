import { sessionReturnTo } from "@/lib/session-navigation";
import { isoDate } from "@tartan/contracts";
import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { BuilderPage } from "@/features/sessions/builder-page";
import { requireStaffSpace } from "@/features/shell/space";

export const metadata: Metadata = { title: m.coach.newSession };

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; groupe?: string; retour?: string }>;
}) {
  const { actor, organizationId } = await requireStaffSpace();
  const { date, groupe, retour } = await searchParams;
  return (
    <BuilderPage
      userId={actor.userId}
      organizationId={organizationId}
      defaultDate={isoDate.safeParse(date).success ? date : undefined}
      defaultGroupId={groupe}
      returnTo={sessionReturnTo(retour)}
    />
  );
}
