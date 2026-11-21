import { isAdmin } from "@/server/admin.service";
import type { Metadata } from "next";
import { addDays, barSheetInScope } from "@tartan/domain";
import { formatDayMonth, m } from "@tartan/i18n";
import { VideoFilters, VideoPagination, videoQuery, type VideoSearch } from "@/features/videos/video-filters";
import { listExercises } from "@/server/exercise.service";
import { EmptyState, PageHeader } from "@/components/states";
import { todayIso } from "@/lib/dates";
import { videoEnabled } from "@/lib/mux";
import { requireStaffSpace } from "@/features/shell/space";
import { VideoList } from "@/features/videos/video-list";
import { JumpEntryDialog, UploadVideoDialog } from "@/features/videos/video-tools";
import { requireOrgMember } from "@/server/access";
import { listAthletes } from "@/server/athlete.service";
import { getOrganization, listGroups } from "@/server/org.service";
import { listCalendar } from "@/server/session.service";
import { videoCapacity } from "@/server/video-capacity.service";
import { listVideoPage } from "@/server/video.service";

export const metadata: Metadata = { title: m.video.title };

export default async function VideosPage({ searchParams }: { searchParams: Promise<VideoSearch> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const access = await requireOrgMember(actor.userId, organizationId, "viewVideos");
  const search = await searchParams;
  const { athlete } = search;
  const today = todayIso();
  const [{ videos, nextCursor }, athletes, calendar, capacity, exercises, groups, organization] = await Promise.all([
    listVideoPage(actor.userId, organizationId, videoQuery(search)),
    listAthletes(actor.userId, organizationId),
    listCalendar(actor.userId, organizationId, { from: addDays(today, -14), to: addDays(today, 1) }),
    videoCapacity(),
    listExercises(actor.userId, organizationId),
    listGroups(access),
    getOrganization(actor.userId, organizationId),
  ]);
  // « Feuille de barres » n'appartient qu'au saut en hauteur : proposée seulement si les athlètes affichés en font.
  const query = videoQuery(search);
  const jumpContext = barSheetInScope({
    spaceDisciplines: organization.disciplines,
    athletes: athletes.map((a) => ({ id: a.id, disciplines: a.disciplines, groupIds: a.groups.map((g) => g.id) })),
    athleteId: query.athleteId,
    groupId: query.groupId,
  });
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
              <UploadVideoDialog
                athletes={athletes}
                sessions={sessions}
                enabled={videoEnabled()}
                exercises={exercises}
              />
              {jumpContext ? <JumpEntryDialog athletes={athletes} sessions={sessions} /> : null}
            </>
          ) : null
        }
      />
      <VideoFilters
        search={search}
        basePath="/videos"
        staff
        athletes={athletes.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}`.trim() }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        sessions={sessions}
        exercises={exercises}
      />
      {/* Le total global concerne tout Tartan : il ne regarde que l'éditeur. */}
      {capacity && (await isAdmin(actor.email)) ? (
        <p className="t-caption font-normal text-soft">{m.video.storage(capacity.used, capacity.limit)}</p>
      ) : null}
      {videos.length === 0 ? (
        <EmptyState rubric="videos">
          {m.video.empty} {m.video.slowHint}
        </EmptyState>
      ) : (
        <VideoList videos={videos} basePath="/videos" showAthlete />
      )}
      <VideoPagination search={search} nextCursor={nextCursor} basePath="/videos" />
    </div>
  );
}
