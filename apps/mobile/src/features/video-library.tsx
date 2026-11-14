import type { VideoSummary } from "@tartan/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { api } from "../lib/api";
import { deniesCachedAccess } from "../lib/errors";
import { useIsOnline } from "../lib/network";
import { useActiveSpace, useAthletes, useToday } from "../lib/queries";
import { useOwnUploads } from "../lib/upload/upload-queue";
import { Button, Chip, Divider, ListSurface, SectionTitle, T } from "../ui/primitives";
import { TabScreen } from "../ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";
import { UploadRow, VideoRow } from "./video-bits";

const states: [VideoSummary["status"] | undefined, string][] = [
  [undefined, m.videoCollaboration.allStates],
  ["uploading", m.video.uploading],
  ["processing", m.video.processing],
  ["ready", m.videoCollaboration.ready],
  ["error", m.video.failed],
];

export function VideoLibrary({ staff }: { staff: boolean }) {
  const { orgId } = useActiveSpace();
  const today = useToday(staff ? "" : orgId);
  const athletes = useAthletes(orgId, staff);
  const [athleteId, setAthleteId] = useState<string>();
  const [status, setStatus] = useState<VideoSummary["status"]>();
  const [needsReview, setNeedsReview] = useState(false);
  const router = useRouter();
  const uploads = useOwnUploads();
  const online = useIsOnline();
  const filter = {
    athleteId: staff ? athleteId : undefined,
    status,
    review: staff && needsReview ? ("pending" as const) : undefined,
  };
  const videos = useInfiniteQuery({
    queryKey: ["videos", orgId, "pages", filter],
    enabled: Boolean(orgId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.videoPage(orgId, { ...filter, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.videos.some((video) => video.status === "uploading" || video.status === "processing"),
      )
        ? 15_000
        : false,
  });
  const denied = [videos.error, today.error, athletes.error].some(deniesCachedAccess);
  const pending = denied ? [] : uploads.filter((item) => item.orgId === orgId);
  const rows = denied
    ? []
    : [
        ...new Map(
          (videos.data?.pages.flatMap((page) => page.videos) ?? []).map((video) => [video.id, video]),
        ).values(),
      ];
  const consentOff = !staff && !today.data?.videoConsent;
  return (
    <TabScreen
      world="work"
      title={staff ? m.video.title : m.nav.mesSauts}
      refreshing={videos.isRefetching}
      onRefresh={() => void videos.refetch()}
    >
      <Button
        testID={staff ? "open-capture" : "athlete-video-upload"}
        label={m.videoCollaboration.upload}
        disabled={consentOff || denied}
        onPress={() => router.push("/capture")}
      />
      {!staff ? (
        <T variant="small" tone="muted">
          {m.videoCollaboration.private}
        </T>
      ) : null}
      {!staff && today.data && consentOff ? (
        <T variant="small" tone="muted">
          {m.video.consentMissingAthlete}
        </T>
      ) : null}
      {pending.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.mobile.video.pendingTitle}</SectionTitle>
          <ListSurface>
            {pending.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <UploadRow item={item} />
              </View>
            ))}
          </ListSurface>
          {!online ? (
            <T variant="caption" tone="muted">
              {m.mobile.video.queueOffline}
            </T>
          ) : null}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {states.map(([value, label]) => (
          <Chip key={value ?? "all"} label={label} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </ScrollView>
      {staff ? (
        <>
          <Chip
            label={m.videoCollaboration.awaitingReview}
            active={needsReview}
            onPress={() => setNeedsReview(!needsReview)}
          />
          {!denied && athletes.data?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip
                label={m.videoCollaboration.allAthletes}
                active={!athleteId}
                onPress={() => setAthleteId(undefined)}
              />
              {athletes.data.map((athlete) => (
                <Chip
                  key={athlete.id}
                  label={`${athlete.firstName} ${athlete.lastName}`.trim()}
                  active={athleteId === athlete.id}
                  onPress={() => setAthleteId(athlete.id)}
                />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}
      {videos.isPending ? <LoadingState /> : null}
      {videos.isError ? (
        <ErrorState
          error={videos.error}
          onRetry={() => void (videos.isFetchNextPageError ? videos.fetchNextPage() : videos.refetch())}
        />
      ) : null}
      {videos.data && rows.length === 0 && !denied ? (
        <EmptyState body={staff ? m.video.empty : m.video.emptyAthlete} pose="apex" />
      ) : null}
      {rows.length > 0 ? (
        <ListSurface>
          {rows.map((video, index) => (
            <View key={video.id}>
              {index > 0 ? <Divider /> : null}
              <VideoRow video={video} showAthlete={staff} onPress={() => router.push(`/video/${video.id}`)} />
              {staff ? (
                <T variant="caption" tone="muted">
                  {video.reviewedAt ? m.videoCollaboration.reviewed : m.videoCollaboration.awaitingReview}
                </T>
              ) : null}
            </View>
          ))}
        </ListSurface>
      ) : null}
      {videos.hasNextPage && !denied ? (
        <Button
          label={m.videoCollaboration.nextPage}
          variant="secondary"
          loading={videos.isFetchingNextPage}
          onPress={() => void videos.fetchNextPage()}
        />
      ) : null}
    </TabScreen>
  );
}
