import { isAdmin } from "@/server/admin.service";
import type { Metadata } from "next";
import { addDays } from "@tartan/domain";
import { formatDayMonth, m } from "@tartan/i18n";
import { FilterPill } from "@/components/filter-pill";
import { EmptyState, PageHeader } from "@/components/states";
import { todayIso } from "@/lib/dates";
import { videoEnabled } from "@/lib/mux";
import { requireStaffSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { JumpEntryDialog, UploadVideoDialog } from "@/features/videos/video-tools";
import { listAthletes } from "@/server/athlete.service";
import { listCalendar } from "@/server/session.service";
import { videoCapacity } from "@/server/video-capacity.service";
import { listVideos } from "@/server/video.service";

export const metadata: Metadata = { title: m.video.title };

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ athlete?: string; exercice?: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { athlete, exercice } = await searchParams;
  const uuidLike = (value?: string) => /^[0-9a-f-]{36}$/.test(value ?? "");
  const today = todayIso();
  const [videos, athletes, calendar, capacity] = await Promise.all([
    listVideos(actor.userId, organizationId, {
      ...(uuidLike(athlete) ? { athleteId: athlete } : {}),
      ...(uuidLike(exercice) ? { exerciseId: exercice } : {}),
    }),
    listAthletes(actor.userId, organizationId),
    listCalendar(actor.userId, organizationId, { from: addDays(today, -14), to: addDays(today, 1) }),
    videoCapacity(),
  ]);
  const sessions = calendar.sessions
    .filter((s) => s.publishedAt)
    .map((s) => ({ id: s.id, label: `${formatDayMonth(s.date)}, ${s.title}`, today: s.date === today }))
    .reverse();
  const filtered = athletes.find((a) => a.id === athlete);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.video.title}
        detail={filtered ? m.video.forAthlete(`${filtered.firstName} ${filtered.lastName}`) : undefined}
        actions={
          athletes.length > 0 ? (
            <>
              <JumpEntryDialog athletes={athletes} sessions={sessions} />
              <UploadVideoDialog athletes={athletes} sessions={sessions} enabled={videoEnabled()} />
            </>
          ) : null
        }
      />
      {athletes.length > 1 ? (
        <nav aria-label={m.video.filterLabel} className="flex max-w-full gap-2 overflow-x-auto py-1">
          <FilterPill href="/videos" active={!filtered}>
            {m.video.allAthletes}
          </FilterPill>
          {athletes.map((a) => (
            <FilterPill key={a.id} href={`/videos?athlete=${a.id}`} active={filtered?.id === a.id}>
              {`${a.firstName} ${a.lastName}`.trim()}
            </FilterPill>
          ))}
        </nav>
      ) : null}
      {/* Le total global concerne tout Tartan : il ne regarde que l'éditeur. */}
      {capacity && isAdmin(actor.email) ? (
        <p className="t-caption font-normal text-soft">{m.video.storage(capacity.used, capacity.limit)}</p>
      ) : null}
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
