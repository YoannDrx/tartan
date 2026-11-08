import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { RefreshLoads } from "@/features/sessions/refresh-loads";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { AppError } from "@/lib/errors";
import { getSessionForEdit, previewPrescriptionRefresh } from "@/server/session.service";

export default async function RefreshLoadsPage({
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
  let preview = null;
  if (space.progressionEnabled && session.publishedAt) {
    try {
      preview = await orNotFound(() => previewPrescriptionRefresh(actor.userId, organizationId, id));
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "prescription_not_frozen") throw error;
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        href={withSessionReturn(`/seances/${id}/suivi`, returnTo)}
        className="inline-flex min-h-11 items-center font-semibold"
      >
        {m.prescriptionRefresh.back}
      </Link>
      <h1 className="t-h1">{m.prescriptionRefresh.title}</h1>
      <p className="font-semibold break-words">{session.draft.title}</p>
      {preview ? (
        <RefreshLoads
          key={`${organizationId}.${id}.${actor.userId}`}
          initial={preview}
          organizationId={organizationId}
        />
      ) : (
        <p>{space.progressionEnabled ? m.prescriptionRefresh.unavailable : m.progression.disabled}</p>
      )}
    </div>
  );
}
