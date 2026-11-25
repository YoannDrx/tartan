import type { Metadata } from "next";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { PageHeader } from "@/components/states";
import { CatalogVideoBoard } from "@/features/admin/catalog-video-board";
import { EditorialBoard } from "@/features/admin/editorial-board";
import { AdminNav } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { videoEnabled } from "@/lib/mux";
import { listCatalogMedia } from "@/server/catalog-media.service";

export const metadata: Metadata = { title: m.admin.nav.exercises, robots: { index: false } };

// Les vidéos des fiches communes du catalogue. L'accès est celui de toute la console : administrateur, passkey
// vérifiée (layout) ; le service le revérifie.
export default async function AdminExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ fiche?: string; famille?: string; page?: string }>;
}) {
  const { actor } = await requireSpace();
  const [media, filters] = await Promise.all([listCatalogMedia(actor.email), searchParams]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={m.admin.nav.exercises} detail={w.admin.catalogVideos.lead} />
      <AdminNav current="/admin/exercices" />
      <EditorialBoard selected={filters.fiche} family={filters.famille} page={filters.page} />
      <details className="rounded-card bg-card p-4 on-card">
        <summary className="min-h-11 cursor-pointer font-semibold">
          {w.admin.stadiumEdition.title(STADIUM_EDITION.length)}
        </summary>
        {STADIUM_EDITION.map(({ catalogKey, name, aliases, guide }) => (
          <details key={catalogKey} className="border-t border-card-line py-2">
            <summary className="min-h-11 cursor-pointer">{name}</summary>
            <p className="font-semibold">{guide.objective}</p>
            <p>{guide.setup.join(" ")}</p>
            <ol className="list-decimal pl-5">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <dl className="grid gap-1">
              <dt>{w.admin.stadiumEdition.mistakes}</dt>
              <dd>{guide.mistakes.join(" ")}</dd>
              <dt>{w.admin.stadiumEdition.count}</dt>
              <dd>{guide.counting.explanation}</dd>
              <dt>{w.admin.stadiumEdition.load}</dt>
              <dd>{guide.loadExplanation}</dd>
              <dt>{w.admin.stadiumEdition.easier}</dt>
              <dd>{guide.easier}</dd>
              <dt>{w.admin.stadiumEdition.harder}</dt>
              <dd>{guide.progression}</dd>
              <dt>{w.admin.stadiumEdition.aliases}</dt>
              <dd>{(aliases ?? []).join(", ")}</dd>
            </dl>
          </details>
        ))}
      </details>
      <CatalogVideoBoard
        entries={[...EXERCISE_CATALOG, ...STADIUM_EDITION].map((entry) => ({
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
