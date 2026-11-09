import { useQuery, useQueryClient } from "@tanstack/react-query";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { api } from "../src/lib/api";
import { nativePlatform } from "../src/lib/app-version";
import { ListSurface, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../src/ui/states";
import { space } from "../src/ui/theme";

export default function WhatsNew() {
  const router = useRouter();
  const client = useQueryClient();
  const releases = useQuery({ queryKey: ["releases", nativePlatform], queryFn: () => api.releases(nativePlatform) });
  const latest = releases.data?.releases[0]?.id;
  useEffect(() => {
    if (!latest) return;
    void api
      .markReleaseSeen(latest)
      .then(() => client.invalidateQueries({ queryKey: ["releases", nativePlatform] }))
      .catch(() => undefined);
  }, [client, latest]);
  return (
    <StackScreen title={m.releases.title} onBack={() => router.back()}>
      {releases.isPending ? <LoadingState /> : null}
      {releases.isError ? <ErrorState error={releases.error} onRetry={() => void releases.refetch()} /> : null}
      {releases.data?.releases.length === 0 ? <EmptyState body={m.releases.empty} pose="run" /> : null}
      {releases.data?.releases.map((release) => (
        <ListSurface key={release.id}>
          <View style={{ padding: space.lg, gap: space.sm }}>
            <T variant="title1">{release.title}</T>
            <T variant="caption" tone="muted">
              {capitalize(formatDateLong(release.date))}
            </T>
            {release.items.map((item) => (
              <T key={item} variant="body">
                {`•  ${item}`}
              </T>
            ))}
          </View>
        </ListSurface>
      ))}
    </StackScreen>
  );
}
