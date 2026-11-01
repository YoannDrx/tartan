import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { OfflineActions } from "@/features/offline/offline-actions";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = { title: m.offline.title, robots: { index: false } };

export default function HorsLignePage() {
  return (
    <PublicPage title={m.offline.title} lead={m.offline.lead}>
      <OfflineActions />
    </PublicPage>
  );
}
