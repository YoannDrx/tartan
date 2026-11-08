import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import Link from "next/link";
import { m } from "@tartan/i18n";
import type { Metadata } from "next";
import { BuilderPage } from "@/features/sessions/builder-page";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { getSessionForEdit } from "@/server/session.service";

export const metadata: Metadata = { title: "Modifier la séance" };

export default async function EditSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const { actor, organizationId, space } = await requireStaffSpace();
  const { id } = await params;
  const returnTo = sessionReturnTo((await searchParams).retour);
  const session = await orNotFound(() => getSessionForEdit(actor.userId, organizationId, id));
  return (
    <div className="flex flex-col gap-4">
      {space.progressionEnabled && session.publishedAt ? (
        <Link
          className="inline-flex min-h-11 items-center font-semibold"
          href={withSessionReturn(`/seances/${id}/charges`, returnTo)}
        >
          {m.prescriptionRefresh.title}
        </Link>
      ) : null}
      <BuilderPage userId={actor.userId} organizationId={organizationId} sessionId={id} returnTo={returnTo} />
    </div>
  );
}
