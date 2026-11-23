import { NativeBatchPublication } from "../../src/features/batch-publication";
import { defaultDateForWeek } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { AgendaList, useWeekNavigator, WeekNav } from "../../src/features/agenda";
import {
  CalendarViewSwitch,
  defaultSelectedDay,
  MonthCalendar,
  MonthNav,
  useMonthNavigator,
  type MonthAgendaEntry,
} from "../../src/features/month-calendar";
import { useCalendarView } from "../../src/lib/calendar-view";
import { localIsoDate } from "../../src/lib/dates";
import { useActiveSpace, useCoachCalendar, useGroups, usePrefetchMonths } from "../../src/lib/queries";
import { Button, Chip, Tag, ActivityTag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";
import { NativeCalendarPhases } from "../../src/features/training-phases";

// Le groupe et la semaine courante accompagnent la création native.
export default function Planning() {
  const { orgId, space: activeSpace } = useActiveSpace();
  const { view, setView } = useCalendarView();
  const isMonth = view === "month";
  const nav = useWeekNavigator();
  const monthNav = useMonthNavigator();
  const [picked, setPicked] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | undefined>();
  const groups = useGroups(orgId);
  const from = isMonth ? monthNav.from : nav.week;
  const to = isMonth ? monthNav.to : nav.to;
  const calendar = useCoachCalendar(orgId, from, to, groupId, isMonth);
  usePrefetchMonths(orgId, monthNav.month, isMonth, groupId, true);
  const router = useRouter();

  const entries = useMemo<MonthAgendaEntry[]>(() => {
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
      const progress = s.completion?.total
        ? m.calendar.progress(s.completion.done + s.completion.partial, s.completion.total)
        : null;
      const detail = [s.startTime?.replace(":", " h "), s.audience, s.location, progress].filter(Boolean).join(" · ");
      return {
        key: s.id,
        date: s.date,
        title: s.title,
        detail,
        sessionType: s.type,
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

  const selectedDay = picked?.startsWith(monthNav.month) ? picked : defaultSelectedDay(monthNav.month, entries);
  const creationDate = isMonth ? selectedDay : defaultDateForWeek(nav.week, localIsoDate());
  return (
    <TabScreen
      world="work"
      title={m.nav.calendrier}
      refreshing={calendar.isRefetching}
      onRefresh={() => void calendar.refetch()}
    >
      <CalendarViewSwitch view={view} onChange={setView} />
      {isMonth ? <MonthNav {...monthNav} /> : <WeekNav {...nav} />}
      {activeSpace?.aiPlannerEnabled ? (
        <Button
          variant="secondary"
          label={m.aiPlanner.title}
          onPress={() =>
            router.push({
              pathname: "/planner",
              params: { date: creationDate, ...(groupId ? { groupId } : {}) },
            })
          }
        />
      ) : null}
      <Button
        label={m.coach.newSession}
        onPress={() =>
          router.push({
            pathname: "/session-builder/[id]",
            params: { id: "new", date: creationDate, ...(groupId ? { groupId } : {}) },
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
          key={`${orgId}:${isMonth ? monthNav.month : nav.week}:${groupId ?? "all"}`}
          orgId={orgId}
          sessions={
            isMonth ? calendar.data.sessions.filter((s) => s.date.startsWith(monthNav.month)) : calendar.data.sessions
          }
          refresh={() => calendar.refetch()}
        />
      ) : null}
      {isMonth ? null : <NativeCalendarPhases from={from} to={to} groupId={groupId} />}
      {calendar.isPending ? <LoadingState /> : null}
      {calendar.isError && !calendar.data ? (
        <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
      ) : null}
      {isMonth && calendar.data ? (
        <MonthCalendar month={monthNav.month} entries={entries} selected={selectedDay} onSelect={setPicked} />
      ) : null}
      {isMonth ? <NativeCalendarPhases from={from} to={to} groupId={groupId} /> : null}
      {!isMonth && calendar.data && entries.length === 0 ? (
        <EmptyState body={m.mobile.agenda.empty} pose="run" />
      ) : null}
      {!isMonth && entries.length > 0 ? <AgendaList entries={entries} /> : null}
    </TabScreen>
  );
}
