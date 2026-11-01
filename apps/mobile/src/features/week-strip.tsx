import type { AthleteToday, CellStatus } from "@tartan/contracts";
import { formatDayMonth, formatWeekdayShort, m } from "@tartan/i18n";
import { View } from "react-native";
import { dayNumber } from "../lib/dates";
import { StatusGlyph } from "../ui/status";
import { T } from "../ui/primitives";
import { color, radius, space, usePalette } from "../ui/theme";

const GLYPH: Partial<Record<AthleteToday["week"][number]["status"], CellStatus>> = {
  done: "done",
  partial: "partial",
  missed: "missed",
  planned: "upcoming",
  today: "upcoming",
};

// La semaine en un coup d'œil : une seule règle horizontale, aujourd'hui passé à l'encre.
export const WeekStrip = ({ week, today }: { week: AthleteToday["week"]; today: string }) => {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: p.surface,
        borderRadius: radius.block,
        borderWidth: 1,
        borderColor: p.border,
        padding: space.xs,
      }}
    >
      {week.map((d) => {
        const isToday = d.date === today;
        const glyph = GLYPH[d.status];
        const tone = isToday ? "white" : "default";
        return (
          <View
            key={d.date}
            accessible
            accessibilityLabel={m.mobile.a11y.day(formatDayMonth(d.date), m.mobile.a11y.dayStatus[d.status])}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 2,
              paddingVertical: space.sm,
              borderRadius: radius.button,
              backgroundColor: isToday ? color.ink : "transparent",
            }}
          >
            <T variant="caption" tone={isToday ? "white" : "muted"} maxFontSizeMultiplier={1.2}>
              {formatWeekdayShort(d.date)}
            </T>
            <T variant="figure" tone={tone} maxFontSizeMultiplier={1.2} style={{ fontSize: 18, lineHeight: 22 }}>
              {dayNumber(d.date)}
            </T>
            <View style={{ height: 16, justifyContent: "center" }}>
              {glyph ? <StatusGlyph status={glyph} size={16} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};
