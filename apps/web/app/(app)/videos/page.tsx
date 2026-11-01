import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { EmptyState, PageHeader } from "@/components/states";
import { videoEnabled } from "@/lib/mux";
import { requireStaffSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { JumpEntryDialog, UploadVideoDialog } from "@/features/videos/video-tools";
import { listAthletes } from "@/server/athlete.service";
import { listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: m.video.title };

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ athlete?: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { athlete } = await searchParams;
  const [videos, athletes] = await Promise.all([
    listVideos(actor.userId, organizationId, /^[0-9a-f-]{36}$/.test(athlete ?? "") ? { athleteId: athlete } : {}),
    listAthletes(actor.userId, organizationId),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={m.video.title}
        actions={
          athletes.length > 0 ? (
            <>
              <JumpEntryDialog athletes={athletes} />
              <UploadVideoDialog athletes={athletes} enabled={videoEnabled()} />
            </>
          ) : null
        }
      />
      {videos.length === 0 ? (
        <EmptyState>
          {m.video.empty} {m.video.slowHint}
        </EmptyState>
      ) : (
        <VideoList videos={videos} basePath="/videos" showAthlete />
      )}
    </div>
  );
}
