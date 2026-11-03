import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { Jumper } from "@/components/jumper";
import { OfflineActions } from "@/features/offline/offline-actions";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = { title: m.offline.title, robots: { index: false } };

export default function HorsLignePage() {
  return (
    <PublicPage title={m.offline.title} lead={m.offline.lead} world="nuit">
      <Jumper className="mb-4 size-48" />
      <OfflineActions />
    </PublicPage>
  );
}
