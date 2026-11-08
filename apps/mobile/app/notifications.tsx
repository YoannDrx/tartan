import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { api } from "../src/lib/api";
import { localIsoDate } from "../src/lib/dates";
import { routeForNotification } from "../src/lib/notification-routes";
import { useSpaceStore } from "../src/lib/space-store";
import { Button, Divider, ListSurface, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../src/ui/states";
import { space, usePalette } from "../src/ui/theme";

export default function NotificationsScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const p = usePalette();
  const inbox = useQuery({ queryKey: ["notifications"], queryFn: () => api.notifications() });
  const refresh = () => client.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({ mutationFn: api.markNotificationsRead, onSettled: refresh });
  return (
    <StackScreen title={m.inbox.title} onBack={() => router.back()}>
      {inbox.isPending ? <LoadingState /> : null}
      {inbox.isError ? <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} /> : null}
      {inbox.data?.items.length === 0 ? <EmptyState body={m.inbox.empty} pose="run" /> : null}
      {inbox.data && inbox.data.unread > 0 ? (
        <Button
          label={m.inbox.markAll}
          variant="secondary"
          compact
          disabled={read.isPending}
          onPress={() => read.mutate({ all: true })}
        />
      ) : null}
      {inbox.data && inbox.data.items.length > 0 ? (
        <ListSurface>
          {inbox.data.items.map((item, index) => {
            const unread = item.readAt === null;
            return (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.text}${unread ? `, ${m.inbox.unread}` : ""}`}
                  android_ripple={{ color: p.ripple }}
                  onPress={() => {
                    if (unread) read.mutate({ ids: [item.id] });
                    if (item.organizationId) useSpaceStore.getState().setActive(item.organizationId);
                    const route = routeForNotification({ link: item.link ?? undefined, type: item.type });
                    if (route !== "/") router.push(route as never);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, padding: space.md }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant={unread ? "smallStrong" : "small"}>{item.text}</T>
                    <T variant="caption" tone="muted">
                      {capitalize(formatDateLong(localIsoDate(new Date(item.createdAt))))}
                    </T>
                  </View>
                  {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.link }} /> : null}
                </Pressable>
              </View>
            );
          })}
        </ListSurface>
      ) : null}
    </StackScreen>
  );
}
