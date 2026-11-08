import { NativeBatchPublication } from "../../src/features/batch-publication";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { AgendaList, useWeekNavigator, WeekNav, type AgendaEntry } from "../../src/features/agenda";
import { useActiveSpace, useCoachCalendar, useGroups } from "../../src/lib/queries";
import { Button, Chip, Tag, ActivityTag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";
import { NativeCalendarPhases } from "../../src/features/training-phases";

// Le groupe et la semaine courante accompagnent la création native.
export default function Planning() {
  const { orgId, space: activeSpace } = useActiveSpace();
  const nav = useWeekNavigator();
  const [groupId, setGroupId] = useState<string | undefined>();
  const groups = useGroups(orgId);
  const calendar = useCoachCalendar(orgId, nav.week, nav.to, groupId);
  const router = useRouter();

  const entries = useMemo<AgendaEntry[]>(() => {
    if (!calendar.data) return [];
    const competitions = calendar.data.competitions.map((c) => ({
      key: `c-${c.id}`,
      date: c.date,
      title: c.name,
      detail: c.location ?? undefined,
      tags: <Tag label={m.calendar.competition} tone="brand" />,
      accessibilityLabel: [m.calendar.competition, c.name, c.location].filter(Boolean).join(", "),
    }));
    const sessions = calendar.data.sessions.map((s) => {
      const detail = [s.startTime?.replace(":", " h "), s.audience, s.location].filter(Boolean).join(" · ");
      return {
        key: s.id,
        date: s.date,
        title: s.title,
        detail,
        tags: (
          <>
            <ActivityTag type={s.type} />
            {s.hasAutonomous ? <Tag label={m.builder.versionAutonomous} /> : null}
            {s.publishedAt ? null : <Tag label={m.mobile.agenda.draft} tone="brand" />}
          </>
        ),
        onPress: () => router.push(s.publishedAt ? `/coach-session/${s.id}` : `/session-builder/${s.id}`),
        accessibilityLabel: `${s.title}, ${detail}`,
      };
    });
    return [...competitions, ...sessions];
  }, [calendar.data, router]);

  return (
    <TabScreen
      world="work"
      title={m.nav.calendrier}
      refreshing={calendar.isRefetching}
      onRefresh={() => void calendar.refetch()}
    >
      <WeekNav {...nav} />
      {activeSpace?.aiPlannerEnabled ? (
        <Button
          variant="secondary"
          label={m.aiPlanner.title}
          onPress={() =>
            router.push({ pathname: "/planner", params: { date: nav.week, ...(groupId ? { groupId } : {}) } })
          }
        />
      ) : null}
      <Button
        label={m.coach.newSession}
        onPress={() =>
          router.push({
            pathname: "/session-builder/[id]",
            params: { id: "new", date: nav.week, ...(groupId ? { groupId } : {}) },
          })
        }
      />
      {groups.data && groups.data.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label={m.coach.allGroups} active={!groupId} onPress={() => setGroupId(undefined)} />
          {groups.data.map((g) => (
            <Chip key={g.id} label={g.name} active={groupId === g.id} onPress={() => setGroupId(g.id)} />
          ))}
        </ScrollView>
      ) : null}
      {calendar.data ? (
        <NativeBatchPublication
          key={`${orgId}:${nav.week}:${groupId ?? "all"}`}
          orgId={orgId}
          sessions={calendar.data.sessions}
          refresh={() => calendar.refetch()}
        />
      ) : null}
      <NativeCalendarPhases from={nav.week} to={nav.to} groupId={groupId} />
      {calendar.isPending ? <LoadingState /> : null}
      {calendar.isError && !calendar.data ? (
        <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
      ) : null}
      {calendar.data && entries.length === 0 ? <EmptyState body={m.mobile.agenda.empty} pose="run" /> : null}
      {entries.length > 0 ? <AgendaList entries={entries} /> : null}
    </TabScreen>
  );
}
