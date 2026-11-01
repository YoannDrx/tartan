import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { DayGroup, useWeekNavigator, WeekNav } from "../../src/features/agenda";
import { useActiveSpace, useCoachCalendar, useGroups } from "../../src/lib/queries";
import { ChevronRight } from "../../src/ui/icons";
import { Chip, T, Tag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { radius, space, usePalette } from "../../src/ui/theme";

// Lecture seule : la création de séance se fait sur ordinateur (§ 6.5).
export default function Planning() {
  const { orgId } = useActiveSpace();
  const nav = useWeekNavigator();
  const [groupId, setGroupId] = useState<string | undefined>();
  const groups = useGroups(orgId);
  const calendar = useCoachCalendar(orgId, nav.week, nav.to, groupId);
  const router = useRouter();
  const p = usePalette();
  const days = useMemo(() => {
    const dates = new Set<string>();
    calendar.data?.sessions.forEach((s) => dates.add(s.date));
    calendar.data?.competitions.forEach((c) => dates.add(c.date));
    return [...dates].sort();
  }, [calendar.data]);
  const card = {
    backgroundColor: p.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: p.border,
    padding: space.md,
    minHeight: 64,
  } as const;
  return (
    <TabScreen title={m.nav.calendrier} refreshing={calendar.isRefetching} onRefresh={() => void calendar.refetch()}>
      <WeekNav {...nav} />
      {groups.data && groups.data.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label={m.coach.allGroups} active={!groupId} onPress={() => setGroupId(undefined)} />
          {groups.data.map((g) => (
            <Chip key={g.id} label={g.name} active={groupId === g.id} onPress={() => setGroupId(g.id)} />
          ))}
        </ScrollView>
      ) : null}
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
              <View key={c.id} style={[card, { gap: space.xs }]} accessible>
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
            .map((s) => {
              const detail = [s.startTime?.replace(":", " h "), s.audience, s.location].filter(Boolean).join(" · ");
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/coach-session/${s.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title}, ${detail}`}
                  style={({ pressed }) => [
                    card,
                    { flexDirection: "row", alignItems: "center", gap: space.md, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="smallStrong">{s.title}</T>
                    <T variant="caption" tone="muted">
                      {detail}
                    </T>
                    <View style={{ flexDirection: "row", gap: space.xs, marginTop: 2, flexWrap: "wrap" }}>
                      <Tag label={m.sessionType[s.type]} />
                      {s.hasAutonomous ? <Tag label={m.builder.versionAutonomous} /> : null}
                      {s.publishedAt ? null : <Tag label={m.mobile.agenda.draft} tone="brand" />}
                    </View>
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
      <T variant="caption" tone="muted">
        {m.mobile.agenda.desktopHint}
      </T>
    </TabScreen>
  );
}
