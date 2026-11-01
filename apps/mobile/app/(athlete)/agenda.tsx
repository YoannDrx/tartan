import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { DayGroup, useWeekNavigator, WeekNav } from "../../src/features/agenda";
import { useActiveSpace, useAthleteCalendar } from "../../src/lib/queries";
import { useOpQueue } from "../../src/lib/sync/op-queue";
import { applyPendingToCard } from "../../src/lib/sync/queue-core";
import { ChevronRight } from "../../src/ui/icons";
import { T, Tag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { StatusDisc } from "../../src/ui/status";
import { radius, space, usePalette } from "../../src/ui/theme";

export default function AthleteAgenda() {
  const { orgId } = useActiveSpace();
  const nav = useWeekNavigator();
  const calendar = useAthleteCalendar(orgId, nav.week, nav.to);
  const items = useOpQueue((s) => s.items);
  const router = useRouter();
  const p = usePalette();

  const days = useMemo(() => {
    const dates = new Set<string>();
    calendar.data?.sessions.forEach((s) => dates.add(s.date));
    calendar.data?.competitions.forEach((c) => dates.add(c.date));
    return [...dates].sort();
  }, [calendar.data]);

  return (
    <TabScreen title={m.nav.calendrier} refreshing={calendar.isRefetching} onRefresh={() => void calendar.refetch()}>
      <WeekNav {...nav} />
      {calendar.isPending ? <LoadingState /> : null}
      {calendar.isError && !calendar.data ? (
        <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
      ) : null}
      {calendar.data && days.length === 0 ? <EmptyState body={m.mobile.agenda.empty} /> : null}
      {days.map((date) => (
        <DayGroup key={date} date={date}>
          {calendar.data?.competitions
            .filter((c) => c.date === date)
            .map((c) => (
              <View
                key={c.id}
                style={{
                  backgroundColor: p.surface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: p.border,
                  padding: space.md,
                  gap: space.xs,
                }}
              >
                <Tag label={m.calendar.competition} tone="brand" />
                <T variant="bodyStrong">{c.name}</T>
                {c.location ? (
                  <T variant="caption" tone="muted">
                    {c.location}
                  </T>
                ) : null}
              </View>
            ))}
          {calendar.data?.sessions
            .filter((s) => s.date === date)
            .map((raw) => {
              const s = applyPendingToCard({ ...raw }, items);
              const detail = [s.startTime?.replace(":", " h "), s.location, m.variant[s.variant]]
                .filter(Boolean)
                .join(" · ");
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/session/${s.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title}, ${detail}, ${m.status[s.status]}`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    backgroundColor: p.surface,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: p.border,
                    padding: space.md,
                    minHeight: 64,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <StatusDisc status={s.status} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="smallStrong">{s.title}</T>
                    <T variant="caption" tone="muted">
                      {detail}
                    </T>
                  </View>
                  <ChevronRight
                    size={20}
                    color={p.textMuted}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </Pressable>
              );
            })}
        </DayGroup>
      ))}
    </TabScreen>
  );
}
