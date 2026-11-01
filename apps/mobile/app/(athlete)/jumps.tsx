import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { VideoRow } from "../../src/features/video-bits";
import { useActiveSpace, useToday, useVideos } from "../../src/lib/queries";
import { Divider, ListSurface, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";

export default function Jumps() {
  const { orgId } = useActiveSpace();
  const today = useToday(orgId);
  const videos = useVideos(orgId);
  const router = useRouter();
  const consentOff = today.data && !today.data.videoConsent;
  return (
    <TabScreen title={m.nav.mesSauts} refreshing={videos.isRefetching} onRefresh={() => void videos.refetch()}>
      {consentOff ? (
        <T variant="small" tone="muted">
          {today.data?.parentalConsentPending ? m.parental.pendingBanner : m.video.consentMissingAthlete}
        </T>
      ) : null}
      {videos.isPending ? <LoadingState /> : null}
      {videos.isError && !videos.data ? (
        <ErrorState error={videos.error} onRetry={() => void videos.refetch()} />
      ) : null}
      {videos.data?.length === 0 ? <EmptyState body={m.video.emptyAthlete} /> : null}
      {videos.data && videos.data.length > 0 ? (
        <ListSurface>
          {videos.data.map((video, i) => (
            <View key={video.id}>
              {i > 0 ? <Divider /> : null}
              <VideoRow video={video} showAthlete={false} onPress={() => router.push(`/video/${video.id}`)} />
            </View>
          ))}
        </ListSurface>
      ) : null}
    </TabScreen>
  );
}
