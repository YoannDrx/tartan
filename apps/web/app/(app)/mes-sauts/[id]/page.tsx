import { m } from "@tartan/i18n";
import type { Metadata } from "next";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { VideoAnalysis } from "@/features/videos/video-analysis";
import { getVideo } from "@/server/video.service";

export const metadata: Metadata = { title: m.video.mine };

export default async function MonSautPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const { id } = await params;
  const video = await orNotFound(() => getVideo(actor.userId, organizationId, id));
  return (
    <VideoAnalysis
      video={video}
      canAnnotate={video.canAnnotate ?? false}
      staff={false}
      currentUserId={actor.userId}
      backHref="/mes-sauts"
      path={`/mes-sauts/${id}`}
    />
  );
}
