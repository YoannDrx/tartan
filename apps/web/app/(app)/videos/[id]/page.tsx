import type { Metadata } from "next";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { VideoAnalysis } from "@/features/videos/video-analysis";
import { listExercises } from "@/server/exercise.service";
import { getVideo } from "@/server/video.service";

export const metadata: Metadata = { title: "Analyse vidéo" };

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  const [video, exercises] = await Promise.all([
    orNotFound(() => getVideo(actor.userId, organizationId, id)),
    listExercises(actor.userId, organizationId).catch(() => []),
  ]);
  return (
    <VideoAnalysis exercises={exercises.map((e) => ({ id: e.id, name: e.name }))} video={video} canAnnotate currentUserId={actor.userId} backHref="/videos" path={`/videos/${id}`} />
  );
}
