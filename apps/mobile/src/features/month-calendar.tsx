import type { SessionType } from "@tartan/contracts";
import { monthRange, shiftMonthKey, visibleDayItems } from "@tartan/domain";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { tokens } from "@tartan/design-tokens";
import { memo, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { dayNumber, localIsoDate } from "../lib/dates";
import { AgendaList, type AgendaEntry } from "./agenda";
import { ChevronLeft, ChevronRight, Medal } from "../ui/icons";
import { Chip, IconButton, ListSurface, T } from "../ui/primitives";
import { radius, space, usePalette } from "../ui/theme";
import type { NativeCalendarView } from "../lib/calendar-view";

export type MonthAgendaEntry = AgendaEntry & { sessionType?: SessionType };

export const useMonthNavigator = () => {
  const current = localIsoDate().slice(0, 7);
  const [month, setMonth] = useState(current);
  const range = monthRange(month);
  return {
    month,
    from: range.from,
    to: range.to,
    previous: () => setMonth(shiftMonthKey(month, -1)),
    next: () => setMonth(shiftMonthKey(month, 1)),
  };
};

export const CalendarViewSwitch = ({
  view,
  onChange,
}: {
  view: NativeCalendarView;
  onChange: (next: NativeCalendarView) => void;
}) => (
  <View style={{ flexDirection: "row", gap: space.sm }} accessibilityRole="tablist">
    <Chip label={m.calendar.list} active={view === "list"} onPress={() => onChange("list")} />
    <Chip label={m.calendar.month} active={view === "month"} onPress={() => onChange("month")} />
  </View>
);

const monthTitle = (month: string) =>
  capitalize(
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${month}-15T12:00:00Z`),
    ),
  );

export const MonthNav = ({ month, previous, next }: { month: string; previous: () => void; next: () => void }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
    <IconButton icon={ChevronLeft} label={m.calendar.previousMonth} tone="filled" onPress={previous} />
    <T variant="smallStrong" style={{ flex: 1, textAlign: "center" }} accessibilityLiveRegion="polite">
      {monthTitle(month)}
    </T>
    <IconButton icon={ChevronRight} label={m.calendar.nextMonth} tone="filled" onPress={next} />
  </View>
);

type DayData = { sessions: SessionType[]; competitions: number; total: number };

const DayCell = memo(
  ({
    day,
    inMonth,
    today,
    selected,
    data,
    onSelect,
  }: {
    day: string;
    inMonth: boolean;
    today: boolean;
    selected: boolean;
    data: DayData;
    onSelect: (day: string) => void;
  }) => {
    const p = usePalette();
    const tints = p.work && p.dark ? tokens.activityDark : tokens.activity;
    const { visible, hidden } = visibleDayItems(data.sessions);
    return (
      <Pressable
        onPress={() => onSelect(day)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${capitalize(formatDateLong(day))}, ${m.calendar.dayCount(data.total)}`}
        android_ripple={{ color: p.ripple }}
        style={{
          flex: 1,
          minHeight: 52,
          alignItems: "center",
          gap: 4,
          paddingVertical: 6,
          backgroundColor: selected ? p.raised : undefined,
          borderRadius: radius.thumb,
        }}
      >
        <View
          style={{
            minWidth: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: today ? p.accent : undefined,
          }}
        >
          <T
            variant="smallStrong"
            maxFontSizeMultiplier={1.2}
            tone={inMonth ? "default" : "muted"}
            style={today ? { color: p.accentText } : undefined}
          >
            {dayNumber(day)}
          </T>
        </View>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 10 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {data.competitions > 0 ? <Medal size={10} color={p.textMuted} /> : null}
          {visible.map((type, index) => (
            <View
              key={`${type}-${index}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: tints[type].background,
                borderWidth: 1,
                borderColor: p.border,
              }}
            />
          ))}
          {hidden > 0 ? (
            <T variant="caption" tone="muted" maxFontSizeMultiplier={1} style={{ fontSize: 10, lineHeight: 10 }}>
              +{hidden}
            </T>
          ) : null}
        </View>
      </Pressable>
    );
  },
);
DayCell.displayName = "DayCell";

// Six rangées fixes : la grille ne saute pas d'un mois à l'autre, le détail du jour touché vient dessous.
export const MonthCalendar = ({
  month,
  entries,
  selected,
  onSelect,
}: {
  month: string;
  entries: MonthAgendaEntry[];
  selected: string;
  onSelect: (day: string) => void;
}) => {
  const { cells } = monthRange(month);
  const today = localIsoDate();
  const byDay = useMemo(() => {
    const map = new Map<string, MonthAgendaEntry[]>();
    for (const entry of entries) map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
    return map;
  }, [entries]);
  const dataOf = (day: string): DayData => {
    const list = byDay.get(day) ?? [];
    return {
      sessions: list.flatMap((entry) => (entry.sessionType ? [entry.sessionType] : [])),
      competitions: list.filter((entry) => !entry.sessionType).length,
      total: list.length,
    };
  };
  const rows = Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const dayEntries = byDay.get(selected) ?? [];
  return (
    <>
      <ListSurface>
        <View style={{ padding: space.xs }}>
          <View style={{ flexDirection: "row" }} accessibilityElementsHidden importantForAccessibility="no">
            {cells.slice(0, 7).map((day) => (
              <View key={day} style={{ flex: 1, alignItems: "center", paddingVertical: space.xs }}>
                <T variant="caption" tone="muted" maxFontSizeMultiplier={1.2}>
                  {formatWeekdayShort(day)}
                </T>
              </View>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row[0]} style={{ flexDirection: "row" }}>
              {row.map((day) => (
                <DayCell
                  key={day}
                  day={day}
                  inMonth={day.startsWith(month)}
                  today={day === today}
                  selected={day === selected}
                  data={dataOf(day)}
                  onSelect={onSelect}
                />
              ))}
            </View>
          ))}
        </View>
      </ListSurface>
      <T variant="smallStrong" accessibilityLiveRegion="polite">
        {capitalize(formatDateLong(selected))}
      </T>
      {dayEntries.length > 0 ? (
        <AgendaList entries={dayEntries} />
      ) : (
        <T variant="small" tone="muted">
          {m.calendar.emptyDay}
        </T>
      )}
    </>
  );
};

// Le jour montré par défaut : aujourd'hui si le mois le contient, sinon le premier jour occupé.
export const defaultSelectedDay = (month: string, entries: { date: string }[], today: string = localIsoDate()) => {
  if (today.startsWith(month)) return today;
  const busy = entries
    .map((entry) => entry.date)
    .filter((date) => date.startsWith(month))
    .sort()[0];
  return busy ?? `${month}-01`;
};
