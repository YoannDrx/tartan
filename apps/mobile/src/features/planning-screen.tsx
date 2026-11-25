import { NativeBatchPublication } from "./batch-publication";
import { isPersonalSpace } from "../lib/personal-space";
import { defaultDateForWeek } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { AgendaList, useWeekNavigator, WeekNav } from "./agenda";
import {
  CalendarViewSwitch,
  defaultSelectedDay,
  MonthCalendar,
  MonthNav,
  useMonthNavigator,
  type MonthAgendaEntry,
} from "./month-calendar";
import { useCalendarView } from "../lib/calendar-view";
import { localIsoDate } from "../lib/dates";
import { useActiveSpace, useCoachCalendar, useGroups, usePrefetchMonths } from "../lib/queries";
import { Button, Chip, Tag, ActivityTag } from "../ui/primitives";
import { TabScreen } from "../ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";
import { NativeCalendarPhases } from "./training-phases";

// Le calendrier de planification. Le groupe et la semaine courante accompagnent la création native. Dans l'espace
// personnel de l'athlète autonome (« Planifier ») : ni groupe ni destinataires, ses brouillons et ses séances
// publiées ; une séance publiée s'ouvre comme il la fera, un brouillon dans le constructeur.
export function PlanningScreen() {
  const { orgId, space: activeSpace } = useActiveSpace();
  const personal = isPersonalSpace(activeSpace);
  const { view, setView } = useCalendarView();
  const isMonth = view === "month";
  const nav = useWeekNavigator();
  const monthNav = useMonthNavigator();
  const [picked, setPicked] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | undefined>();
  const groups = useGroups(personal ? "" : orgId);
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
      const detail = [
        s.startTime?.replace(":", " h "),
        personal ? null : s.audience,
        s.location,
        personal ? null : progress,
      ]
        .filter(Boolean)
        .join(" · ");
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
        onPress: () =>
          router.push(
            s.publishedAt ? (personal ? `/session/${s.id}` : `/coach-session/${s.id}`) : `/session-builder/${s.id}`,
          ),
        accessibilityLabel: `${s.title}, ${detail}`,
      };
    });
    return [...competitions, ...sessions];
  }, [calendar.data, router, personal]);

  const selectedDay = picked?.startsWith(monthNav.month) ? picked : defaultSelectedDay(monthNav.month, entries);
  const creationDate = isMonth ? selectedDay : defaultDateForWeek(nav.week, localIsoDate());
  return (
    <TabScreen
      world="work"
      title={personal ? m.mobile.solo.plan : m.nav.calendrier}
      refreshing={calendar.isRefetching}
      onRefresh={() => void calendar.refetch()}
    >
      <CalendarViewSwitch view={view} onChange={setView} />
      {isMonth ? <MonthNav {...monthNav} /> : <WeekNav {...nav} />}
      {activeSpace?.aiPlannerEnabled ? (
        <Button
          variant="secondary"
          label={personal ? m.aiPlanner.personalCreate : m.aiPlanner.title}
          onPress={() =>
            router.push({
              pathname: "/planner",
              params: { date: creationDate, ...(groupId ? { groupId } : {}) },
            })
          }
        />
      ) : null}
      <Button
        testID="plan-new-session"
        label={personal ? m.mobile.solo.planSession : m.coach.newSession}
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
