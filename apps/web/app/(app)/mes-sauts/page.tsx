import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { EmptyState, PageHeader } from "@/components/states";
import { requireAthleteSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { getAthleteToday } from "@/server/athlete-view.service";
import { listVideoPage } from "@/server/video.service";
import { athleteVideoContext } from "@/server/video-context.service";
import { videoEnabled } from "@/lib/mux";
import { UploadVideoDialog } from "@/features/videos/video-tools";
import { VideoFilters, VideoPagination, videoQuery, type VideoSearch } from "@/features/videos/video-filters";

export const metadata: Metadata = { title: m.video.mine };

export default async function MesSautsPage({ searchParams }: { searchParams: Promise<VideoSearch> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const search = await searchParams;
  const [{ videos, nextCursor }, today, sessions] = await Promise.all([
    listVideoPage(actor.userId, organizationId, videoQuery(search)),
    getAthleteToday(actor.userId, organizationId),
    athleteVideoContext(actor.userId, organizationId),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title={m.video.mine}
        actions={
          today.videoConsent ? (
            <UploadVideoDialog athletes={[]} sessions={sessions} enabled={videoEnabled()} self />
          ) : undefined
        }
      />
      <VideoFilters
        search={search}
        sessions={sessions}
        exercises={[...new Map(sessions.flatMap((s) => s.exercises.map((e) => [e.id, e] as const))).values()]}
      />
      {!today.videoConsent ? (
        <p className="rounded-thumb bg-card-raised p-3 text-st-partial">{m.video.consentMissingAthlete}</p>
      ) : null}
      {videos.length === 0 ? (
        <EmptyState rubric="videos">{m.video.emptyAthlete}</EmptyState>
      ) : (
        <VideoList videos={videos} basePath="/mes-sauts" showAthlete />
      )}
      <VideoPagination search={search} nextCursor={nextCursor} basePath="/mes-sauts" />
    </div>
  );
}
