import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { BuilderPage } from "@/features/sessions/builder-page";
import { requireStaffSpace } from "@/features/shell/space";

export const metadata: Metadata = { title: m.coach.newSession };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { date } = await searchParams;
  return (
    <BuilderPage
      userId={actor.userId}
      organizationId={organizationId}
      defaultDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
    />
  );
}
