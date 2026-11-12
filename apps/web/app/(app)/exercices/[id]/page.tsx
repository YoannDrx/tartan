import type { Metadata } from "next";
import { formatPrescription } from "@tartan/domain";
import { m } from "@tartan/i18n";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/states";
import { ExerciseDetail } from "@/features/exercises/exercise-library";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { getExercise } from "@/server/exercise.service";
import { listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: m.exercises.title };

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  const exercise = await orNotFound(() => getExercise(actor.userId, organizationId, id));
  // Le service applique le périmètre du membre, le consentement vidéo et les blocages : rien n'est refiltré ici.
  const videos = await listVideos(actor.userId, organizationId, { exerciseId: exercise.id });
  const hasContent = exercise.media || exercise.cues.length > 0 || formatPrescription(exercise.defaultPrescription);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={exercise.name}
        detail={(m.exerciseCategory as Record<string, string>)[exercise.category] ?? exercise.category}
        before={
          <Link href="/exercices" className="inline-flex min-h-11 items-center font-semibold">
            {m.exercises.backToLibrary}
          </Link>
        }
      />
      {hasContent ? (
        <section className="on-card rounded-card bg-card p-4">
          <ExerciseDetail exercise={exercise} />
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="t-section">{m.exercises.linkedVideos}</h2>
        {videos.length === 0 ? (
          <EmptyState rubric="exercices">{m.exercises.linkedVideosEmpty}</EmptyState>
        ) : (
          <VideoList videos={videos} basePath="/videos" showAthlete />
        )}
      </section>
    </div>
  );
}
