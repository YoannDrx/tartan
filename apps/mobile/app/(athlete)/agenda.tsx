import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { AgendaList, useWeekNavigator, WeekNav, type AgendaEntry } from "../../src/features/agenda";
import { useActiveSpace, useAthleteCalendar } from "../../src/lib/queries";
import { useOpQueue } from "../../src/lib/sync/op-queue";
import { applyPendingToCard } from "../../src/lib/sync/queue-core";
import { Tag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { StatusDisc } from "../../src/ui/status";
import { NativeCalendarPhases } from "../../src/features/training-phases";

export default function AthleteAgenda() {
  const { orgId } = useActiveSpace();
  const nav = useWeekNavigator();
  const calendar = useAthleteCalendar(orgId, nav.week, nav.to);
  const items = useOpQueue((s) => s.items);
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
    const sessions = calendar.data.sessions.map((raw) => {
      const s = applyPendingToCard({ ...raw }, items);
      const detail = [s.startTime?.replace(":", " h "), s.location, m.variant[s.variant]].filter(Boolean).join(" · ");
      return {
        key: s.id,
        date: s.date,
        title: s.title,
        detail,
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
      <WeekNav {...nav} />
      <NativeCalendarPhases from={nav.week} to={nav.to} />
      {calendar.isPending ? <LoadingState /> : null}
      {calendar.isError && !calendar.data ? (
        <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
      ) : null}
      {calendar.data && entries.length === 0 ? <EmptyState body={m.mobile.agenda.empty} pose="run" /> : null}
      {entries.length > 0 ? <AgendaList entries={entries} /> : null}
    </TabScreen>
  );
}
