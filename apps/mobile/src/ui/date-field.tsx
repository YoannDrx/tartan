import { formatDateInput, isDateInRange, maskDateInput, monthGrid, parseDateInput, shiftMonth } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { tokens } from "@tartan/design-tokens";
import { useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { localIsoDate } from "../lib/dates";
import { Calendar, ChevronLeft, ChevronRight } from "./icons";
import { Button, Field, IconButton, T } from "./primitives";
import { Sheet } from "./sheet";
import { radius, Scene, space, usePalette } from "./theme";

const t = m.datePicker;
const YEARS_PER_PAGE = 12;
// Le nom lu commence par le chiffre affiché.
const dayLabel = (iso: string) =>
  `${Number(iso.slice(8))} ${t.months[Number(iso.slice(5, 7)) - 1]?.toLowerCase()} ${iso.slice(0, 4)}`;
const monthOf = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });

const Lanes = () => (
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 4 }}>
    <View style={{ height: 2, backgroundColor: tokens.band.lane }} />
    <View style={{ height: 2, backgroundColor: tokens.band.lane }} />
  </View>
);

const MonthCalendar = ({
  value,
  min,
  max,
  allowClear,
  onChoose,
}: {
  value: string;
  min?: string;
  max?: string;
  allowClear: boolean;
  onChoose: (iso: string) => void;
}) => {
  const p = usePalette();
  const today = localIsoDate();
  const selected = parseDateInput(value);
  const [view, setView] = useState(() => monthOf(selected ?? today));
  const [years, setYears] = useState(false);
  const yearStart = view.year - (view.year % YEARS_PER_PAGE);
  const days = monthGrid(view.year, view.month);
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const move = (delta: number) =>
    setView(years ? { ...view, year: view.year + delta * YEARS_PER_PAGE } : shiftMonth(view.year, view.month, delta));
  return (
    <View style={{ gap: space.md }}>
      <Scene scene="piste">
        <View style={{ backgroundColor: tokens.band.background, borderRadius: radius.thumb, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: space.xs }}>
            <IconButton icon={ChevronLeft} label={years ? t.previousYears : t.previousMonth} onPress={() => move(-1)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.chooseYear}, ${t.months[view.month - 1]} ${view.year}`}
              accessibilityState={{ expanded: years }}
              onPress={() => setYears((old) => !old)}
              style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center" }}
            >
              <T variant="title2">
                {years
                  ? `${yearStart} – ${yearStart + YEARS_PER_PAGE - 1}`
                  : `${t.months[view.month - 1]} ${view.year}`}
              </T>
            </Pressable>
            <IconButton icon={ChevronRight} label={years ? t.nextYears : t.nextMonth} onPress={() => move(1)} />
          </View>
          <Lanes />
          <View style={{ height: space.sm }} />
        </View>
      </Scene>
      {years ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {Array.from({ length: YEARS_PER_PAGE }, (_, index) => yearStart + index).map((year) => (
            <View key={year} style={{ width: "33.33%", padding: 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: year === view.year }}
                onPress={() => {
                  setView({ ...view, year });
                  setYears(false);
                }}
                style={{
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.button,
                  backgroundColor: year === view.year ? p.accent : p.surface,
                }}
              >
                <T variant="smallStrong" style={year === view.year ? { color: p.accentText } : undefined}>
                  {year}
                </T>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: "row" }}
          >
            {t.weekdays.map((day) => (
              <T key={day} variant="caption" tone="muted" style={{ flex: 1, textAlign: "center" }}>
                {day}
              </T>
            ))}
          </View>
          {weeks.map((week) => (
            <View key={week[0]} style={{ flexDirection: "row" }}>
              {week.map((day) => {
                const isSelected = day === selected;
                const outside = monthOf(day).month !== view.month;
                const allowed = isDateInRange(day, min, max);
                return (
                  <Pressable
                    key={day}
                    testID={`date-${day}`}
                    accessibilityRole="button"
                    accessibilityLabel={dayLabel(day)}
                    accessibilityState={{ selected: isSelected, disabled: !allowed }}
                    disabled={!allowed}
                    onPress={() => onChoose(day)}
                    style={{ flex: 1, height: 46, alignItems: "center", justifyContent: "center" }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: allowed ? 1 : 0.3,
                        backgroundColor: isSelected ? p.accent : "transparent",
                        borderWidth: day === today && !isSelected ? 2 : 0,
                        borderColor: p.accent,
                      }}
                    >
                      <T
                        variant={isSelected || day === today ? "smallStrong" : "small"}
                        tone={!isSelected && outside ? "muted" : undefined}
                        style={isSelected ? { color: p.accentText } : undefined}
                      >
                        {Number(day.slice(8))}
                      </T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            compact
            label={t.today}
            disabled={!isDateInRange(today, min, max)}
            onPress={() => onChoose(today)}
          />
        </View>
        {allowClear && selected ? (
          <View style={{ flex: 1 }}>
            <Button variant="secondary" compact label={t.clear} onPress={() => onChoose("")} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

// Toujours JJ/MM/AAAA à l'écran ; le formulaire reçoit de l'ISO, ou une chaîne vide tant que la date est incomplète.
export const DateField = ({
  label,
  value,
  onChangeText,
  hint,
  error,
  editable = true,
  min,
  max,
  allowClear = false,
  containerStyle,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (iso: string) => void;
  hint?: string;
  error?: string;
  editable?: boolean;
  min?: string;
  max?: string;
  allowClear?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) => {
  const [text, setText] = useState(formatDateInput(value));
  const [open, setOpen] = useState(false);
  const impossible = text.length === 10 && !parseDateInput(text);

  // Une valeur modifiée ailleurs (brouillon repris, proposition) remplace l'affichage, jamais une frappe en cours.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if ((parseDateInput(text) ?? "") !== value) setText(formatDateInput(value));
  }

  return (
    <>
      <Field
        testID={testID}
        label={label}
        hint={hint}
        error={error ?? (impossible ? t.invalid : undefined)}
        containerStyle={containerStyle}
        value={text}
        editable={editable}
        placeholder={t.placeholder}
        keyboardType="number-pad"
        maxLength={10}
        onChangeText={(raw) => {
          const display = maskDateInput(raw);
          setText(display);
          // Une date en cours de frappe garde la dernière valeur valide.
          const iso = parseDateInput(display);
          if (iso && iso !== value) onChangeText(iso);
          if (!display && value) onChangeText("");
        }}
        onBlur={() => {
          if (text && !parseDateInput(text) && text.length < 10) setText(formatDateInput(value));
        }}
        accessory={editable ? <IconButton icon={Calendar} label={t.open} onPress={() => setOpen(true)} /> : undefined}
      />
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {open ? (
          <MonthCalendar
            value={value}
            min={min}
            max={max}
            allowClear={allowClear}
            onChoose={(iso) => {
              setText(formatDateInput(iso));
              onChangeText(iso);
              setOpen(false);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
};
