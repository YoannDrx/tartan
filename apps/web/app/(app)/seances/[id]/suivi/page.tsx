import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { SessionFollowupContent } from "@/features/tracking/session-detail";

export const metadata: Metadata = { title: m.calendar.sessionDetail };

export default function SessionFollowupPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  return <SessionFollowupContent {...props} />;
}
