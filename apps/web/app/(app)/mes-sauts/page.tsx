import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { EmptyState, PageHeader } from "@/components/states";
import { requireAthleteSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { getAthleteToday } from "@/server/athlete-view.service";
import { listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: m.nav.mesSauts };

export default async function MesSautsPage() {
  const { actor, organizationId } = await requireAthleteSpace();
  const [videos, today] = await Promise.all([
    listVideos(actor.userId, organizationId),
    getAthleteToday(actor.userId, organizationId),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={m.nav.mesSauts} />
      {!today.videoConsent ? (
        <p className="rounded-thumb bg-card-raised p-3 text-st-partial">{m.video.consentMissingAthlete}</p>
      ) : null}
      {videos.length === 0 ? (
        <EmptyState rubric="videos">{m.video.emptyAthlete}</EmptyState>
      ) : (
        <VideoList videos={videos} basePath="/mes-sauts" showAthlete={false} />
      )}
    </div>
  );
}
