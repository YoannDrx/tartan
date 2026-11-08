import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { UploadRow, VideoRow } from "../../src/features/video-bits";
import { useIsOnline } from "../../src/lib/network";
import { useActiveSpace, useVideos } from "../../src/lib/queries";
import { useUploads } from "../../src/lib/upload/upload-queue";
import { Camera } from "../../src/ui/icons";
import { Button, Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

export default function CoachVideos() {
  const { orgId } = useActiveSpace();
  const videos = useVideos(orgId);
  const uploads = useUploads((s) => s.items);
  const online = useIsOnline();
  const router = useRouter();
  const pending = uploads.filter((u) => u.orgId === orgId);
  return (
    <TabScreen
      world="work"
      title={m.video.title}
      refreshing={videos.isRefetching}
      onRefresh={() => void videos.refetch()}
    >
      <Button testID="open-capture" label={m.video.capture} icon={Camera} onPress={() => router.push("/capture")} />
      {pending.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.mobile.video.pendingTitle}</SectionTitle>
          <ListSurface>
            {pending.map((item, i) => (
              <View key={item.id}>
                {i > 0 ? <Divider /> : null}
                <UploadRow item={item} />
              </View>
            ))}
          </ListSurface>
          {online ? null : (
            <T variant="caption" tone="muted">
              {m.mobile.video.queueOffline}
            </T>
          )}
        </View>
      ) : null}
      {videos.isPending ? <LoadingState /> : null}
      {videos.isError && !videos.data ? (
        <ErrorState error={videos.error} onRetry={() => void videos.refetch()} />
      ) : null}
      {videos.data?.length === 0 && pending.length === 0 ? <EmptyState body={m.video.empty} pose="apex" /> : null}
      {videos.data && videos.data.length > 0 ? (
        <ListSurface>
          {videos.data.map((video, i) => (
            <View key={video.id}>
              {i > 0 ? <Divider /> : null}
              <VideoRow video={video} showAthlete onPress={() => router.push(`/video/${video.id}`)} />
            </View>
          ))}
        </ListSurface>
      ) : null}
    </TabScreen>
  );
}
