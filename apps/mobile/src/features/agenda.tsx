import { addDays, startOfWeek } from "@tartan/domain";
import { capitalize, formatDateLong, formatDayMonth, formatWeekdayShort, m } from "@tartan/i18n";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { dayNumber, localIsoDate } from "../lib/dates";
import { ChevronLeft, ChevronRight } from "../ui/icons";
import { Divider, IconButton, ListSurface, T } from "../ui/primitives";
import { scene, space } from "../ui/theme";

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

export type AgendaEntry = {
  key: string;
  date: string;
  title: string;
  detail?: string;
  leading?: ReactNode;
  tags?: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
};

// Le carnet de la semaine : une seule surface, la date en colonne, une ligne par séance.
export const AgendaList = ({ entries }: { entries: AgendaEntry[] }) => {
  const today = localIsoDate();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ListSurface>
      {sorted.map((entry, i) => {
        const firstOfDay = sorted[i - 1]?.date !== entry.date;
        const isToday = entry.date === today;
        return (
          <View key={entry.key}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              disabled={!entry.onPress}
              onPress={entry.onPress}
              accessibilityRole={entry.onPress ? "button" : undefined}
              accessibilityLabel={`${capitalize(formatDateLong(entry.date))}, ${entry.accessibilityLabel}`}
              android_ripple={{ color: scene.cardLine }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                minHeight: 68,
                paddingLeft: space.md,
                paddingRight: space.sm,
                paddingVertical: space.sm,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ width: 34, alignItems: "center" }}>
                {firstOfDay ? (
                  <>
                    <T variant="caption" tone={isToday ? "link" : "muted"} maxFontSizeMultiplier={1.2}>
                      {formatWeekdayShort(entry.date)}
                    </T>
                    <T variant="figure" tone={isToday ? "link" : "default"} maxFontSizeMultiplier={1.2}>
                      {dayNumber(entry.date)}
                    </T>
                  </>
                ) : null}
              </View>
              {entry.leading}
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="smallStrong">{entry.title}</T>
                {entry.detail ? (
                  <T variant="caption" tone="muted">
                    {entry.detail}
                  </T>
                ) : null}
                {entry.tags ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: 2 }}>
                    {entry.tags}
                  </View>
                ) : null}
              </View>
              {entry.onPress ? (
                <ChevronRight
                  size={18}
                  color={scene.textMuted}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </ListSurface>
  );
};
