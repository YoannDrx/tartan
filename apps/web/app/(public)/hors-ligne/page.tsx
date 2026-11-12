import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { Athlete } from "@/components/athlete";
import { OfflineActions } from "@/features/offline/offline-actions";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = { title: m.offline.title, robots: { index: false } };

export default function HorsLignePage() {
  return (
    <PublicPage title={m.offline.title} lead={m.offline.lead} world="nuit">
      {/* Lila attend sur la ligne : rien ne part tant que le réseau n'est pas revenu. */}
      <Athlete id="longJump" pose="lineup" on="ink" view="standing" className="mb-4 h-48 w-auto" />
      <OfflineActions />
    </PublicPage>
  );
}
