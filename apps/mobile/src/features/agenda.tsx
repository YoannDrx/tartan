import { addDays, startOfWeek } from "@tartan/domain";
import { capitalize, formatDateLong, formatDayMonth, m } from "@tartan/i18n";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { localIsoDate } from "../lib/dates";
import { ChevronLeft, ChevronRight } from "../ui/icons";
import { IconButton, T } from "../ui/primitives";
import { space } from "../ui/theme";

export const useWeekNavigator = () => {
  const current = startOfWeek(localIsoDate());
  const [week, setWeek] = useState(current);
  return {
    week,
    to: addDays(week, 6),
    isCurrent: week === current,
    previous: () => setWeek(addDays(week, -7)),
    next: () => setWeek(addDays(week, 7)),
    reset: () => setWeek(current),
  };
};

export const WeekNav = ({ week, previous, next }: { week: string; previous: () => void; next: () => void }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
    <IconButton icon={ChevronLeft} label={m.mobile.a11y.previousWeek} tone="filled" onPress={previous} />
    <T variant="smallStrong" style={{ flex: 1, textAlign: "center" }} accessibilityLiveRegion="polite">
      {m.mobile.agenda.week(formatDayMonth(week))}
    </T>
    <IconButton icon={ChevronRight} label={m.mobile.a11y.nextWeek} tone="filled" onPress={next} />
  </View>
);

export const DayGroup = ({ date, children }: { date: string; children: ReactNode }) => (
  <View style={{ gap: space.sm }}>
    <T variant="smallStrong" tone="muted" accessibilityRole="header">
      {capitalize(formatDateLong(date))}
    </T>
    {children}
  </View>
);
