import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { videoEnabled } from "@/lib/mux";
import { ExerciseLibrary } from "@/features/exercises/exercise-library";
import { requireStaffSpace } from "@/features/shell/space";
import { listExercises } from "@/server/exercise.service";

export const metadata: Metadata = { title: m.exercises.title };

export default async function ExercicesPage({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { nouveau } = await searchParams;
  const exercises = await listExercises(actor.userId, organizationId);
  return <ExerciseLibrary exercises={exercises} openNew={nouveau === "1"} videoEnabled={videoEnabled()} />;
}
