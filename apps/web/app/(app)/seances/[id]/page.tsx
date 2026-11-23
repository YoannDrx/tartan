import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import type { Metadata } from "next";
import { BuilderPage } from "@/features/sessions/builder-page";
import { orNotFound, requirePlannerSpace } from "@/features/shell/space";
import { getSessionForEdit } from "@/server/session.service";

export const metadata: Metadata = { title: "Modifier la séance" };

export default async function EditSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const { actor, organizationId, space, personal } = await requirePlannerSpace();
  const { id } = await params;
  const returnTo = sessionReturnTo((await searchParams).retour);
  const session = await orNotFound(() => getSessionForEdit(actor.userId, organizationId, id));
  return (
    <BuilderPage
      userId={actor.userId}
      organizationId={organizationId}
      sessionId={id}
      returnTo={returnTo}
      personalAthleteId={personal ? (space.athleteId ?? undefined) : undefined}
      headerActions={
        personal && session.publishedAt ? (
          // L'athlète autonome a planifié sa séance : il l'ouvre pour la faire et la valider.
          <Button asChild size="sm">
            <Link href={`/seance/${id}`}>{w.personal.openSession}</Link>
          </Button>
        ) : space.progressionEnabled && session.publishedAt && !personal ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={withSessionReturn(`/seances/${id}/charges`, returnTo)}>{m.prescriptionRefresh.title}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
