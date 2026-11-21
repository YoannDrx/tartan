import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/states";
import { ExerciseDetail, SheetActions } from "@/features/exercises/exercise-sheet";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { videoEnabled } from "@/lib/mux";
import { getExerciseSheet } from "@/server/exercise.service";
import { listExerciseLists } from "@/server/exercise-list.service";
import { listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: m.exercises.title };

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modifier?: string }>;
}) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  const { modifier } = await searchParams;
  const exercise = await orNotFound(() => getExerciseSheet(actor.userId, organizationId, id));
  // Le service applique le périmètre du membre, le consentement vidéo et les blocages : rien n'est refiltré ici.
  const [videos, lists] = await Promise.all([
    listVideos(actor.userId, organizationId, { exerciseId: exercise.id }),
    listExerciseLists(actor.userId, organizationId),
  ]);
  const family = exercise.family ? m.exerciseGuide.families[exercise.family] : null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={exercise.name}
        detail={[
          family,
          (exercise.shared ? w.exercises.sheet.source.shared : w.exercises.sheet.source.mine).toLowerCase(),
        ]
          .filter(Boolean)
          .join(", ")}
        before={
          <Link href="/exercices" className="inline-flex min-h-11 items-center font-semibold">
            {m.exercises.backToLibrary}
          </Link>
        }
        actions={
          <SheetActions
            exercise={exercise}
            lists={lists}
            videoEnabled={videoEnabled()}
            // `?modifier=1` : « Compléter la fiche », au sortir d'une création rapide.
            openEdit={modifier === "1"}
          />
        }
      />
      {exercise.shared && exercise.motionKey ? (
        <p className="text-[15px]">{w.exercises.sheet.personalizeHint}</p>
      ) : null}
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] desktop:items-start">
        <section className="on-card min-w-0 rounded-card bg-card p-4 tablet:p-6">
          <ExerciseDetail exercise={exercise} variants={exercise.variants} />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="t-section">{m.exercises.linkedVideos}</h2>
          {videos.length === 0 ? (
            <EmptyState rubric="exercices">{m.exercises.linkedVideosEmpty}</EmptyState>
          ) : (
            <VideoList videos={videos} basePath="/videos" showAthlete />
          )}
        </section>
      </div>
    </div>
  );
}
