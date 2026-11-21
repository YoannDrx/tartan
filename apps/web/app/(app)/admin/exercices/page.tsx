import type { Metadata } from "next";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { PageHeader } from "@/components/states";
import { CatalogVideoBoard } from "@/features/admin/catalog-video-board";
import { AdminNav } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { videoEnabled } from "@/lib/mux";
import { listCatalogMedia } from "@/server/catalog-media.service";

export const metadata: Metadata = { title: m.admin.nav.exercises, robots: { index: false } };

// Les vidéos des fiches communes du catalogue. L'accès est celui de toute la console : administrateur, passkey
// vérifiée (layout) ; le service le revérifie.
export default async function AdminExercisesPage() {
  const { actor } = await requireSpace();
  const media = await listCatalogMedia(actor.email);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={m.admin.nav.exercises} detail={w.admin.catalogVideos.lead} />
      <AdminNav current="/admin/exercices" />
      <CatalogVideoBoard
        entries={EXERCISE_CATALOG.map((entry) => ({
          key: entry.catalogKey,
          name: entry.name,
          family: entry.guide.family,
        }))}
        media={media.map(({ catalogKey, view, status }) => ({ catalogKey, view, status }))}
        enabled={videoEnabled()}
      />
    </div>
  );
}
