import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { useActiveSpace, useAthleteCalendar, usePrefetchMonths } from "../../src/lib/queries";
import { useOpQueue } from "../../src/lib/sync/op-queue";
import { applyPendingToCard } from "../../src/lib/sync/queue-core";
import { ActivityTag, Tag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { StatusDisc } from "../../src/ui/status";
import { NativeCalendarPhases } from "../../src/features/training-phases";

export default function AthleteAgenda() {
  const { orgId } = useActiveSpace();
  const { view, setView } = useCalendarView();
  const isMonth = view === "month";
  const nav = useWeekNavigator();
  const monthNav = useMonthNavigator();
  const [picked, setPicked] = useState<string | null>(null);
  const calendar = useAthleteCalendar(orgId, isMonth ? monthNav.from : nav.week, isMonth ? monthNav.to : nav.to);
  usePrefetchMonths(orgId, monthNav.month, isMonth);
  const items = useOpQueue((s) => s.items);
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
    const sessions = calendar.data.sessions.map((raw) => {
      const s = applyPendingToCard({ ...raw }, items);
      const detail = [s.startTime?.replace(":", " h "), s.location, m.variant[s.variant]].filter(Boolean).join(" · ");
      return {
        key: s.id,
        date: s.date,
        title: s.title,
        detail,
        sessionType: s.type,
        tags: <ActivityTag type={s.type} />,
        leading: <StatusDisc status={s.status} />,
        onPress: () => router.push(`/session/${s.id}`),
        accessibilityLabel: `${s.title}, ${detail}, ${m.status[s.status]}`,
      };
    });
    return [...competitions, ...sessions];
  }, [calendar.data, items, router]);

  return (
    <TabScreen
      world="work"
      title={m.nav.calendrier}
      refreshing={calendar.isRefetching}
      onRefresh={() => void calendar.refetch()}
    >
      <CalendarViewSwitch view={view} onChange={setView} />
      {isMonth ? <MonthNav {...monthNav} /> : <WeekNav {...nav} />}
      <NativeCalendarPhases from={isMonth ? monthNav.from : nav.week} to={isMonth ? monthNav.to : nav.to} />
      {calendar.isPending ? <LoadingState /> : null}
      {calendar.isError && !calendar.data ? (
        <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
      ) : null}
      {isMonth && calendar.data ? (
        <MonthCalendar
          month={monthNav.month}
          entries={entries}
          selected={picked?.startsWith(monthNav.month) ? picked : defaultSelectedDay(monthNav.month, entries)}
          onSelect={setPicked}
        />
      ) : null}
      {!isMonth && calendar.data && entries.length === 0 ? (
        <EmptyState body={m.mobile.agenda.empty} pose="run" />
      ) : null}
      {!isMonth && entries.length > 0 ? <AgendaList entries={entries} /> : null}
    </TabScreen>
  );
}
