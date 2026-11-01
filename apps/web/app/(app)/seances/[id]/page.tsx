import type { Metadata } from "next";
import { BuilderPage } from "@/features/sessions/builder-page";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { getSessionForEdit } from "@/server/session.service";

export const metadata: Metadata = { title: "Modifier la séance" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  await orNotFound(() => getSessionForEdit(actor.userId, organizationId, id));
  return <BuilderPage userId={actor.userId} organizationId={organizationId} sessionId={id} />;
}
