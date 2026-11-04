import { m } from "@tartan/i18n";
import { View } from "react-native";
import { Field, T } from "../ui/primitives";
import { space } from "../ui/theme";

export type BirthParts = { day: string; month: string; year: string };

export const toIsoBirthDate = ({ day, month, year }: BirthParts): string | null => {
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  if (!y || !mo || !d || year.length !== 4) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const digits = (value: string) => value.replace(/\D/g, "");

// Neutre : ni valeur préremplie, ni mention d'un âge minimal.
export const BirthDateField = ({
  value,
  onChange,
  error,
}: {
  value: BirthParts;
  onChange: (next: BirthParts) => void;
  error?: string;
}) => (
  <View style={{ gap: space.xs + 2 }}>
    <T variant="smallStrong">{m.invite.birthDate}</T>
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <Field
        testID="birth-day"
        label={m.mobile.invite.day}
        hideLabel
        placeholder={m.mobile.invite.day}
        value={value.day}
        onChangeText={(v) => onChange({ ...value, day: digits(v) })}
        keyboardType="number-pad"
        maxLength={2}
        containerStyle={{ flex: 1 }}
      />
      <Field
        testID="birth-month"
        label={m.mobile.invite.month}
        hideLabel
        placeholder={m.mobile.invite.month}
        value={value.month}
        onChangeText={(v) => onChange({ ...value, month: digits(v) })}
        keyboardType="number-pad"
        maxLength={2}
        containerStyle={{ flex: 1 }}
      />
      <Field
        testID="birth-year"
        label={m.mobile.invite.year}
        hideLabel
        placeholder={m.mobile.invite.year}
        value={value.year}
        onChangeText={(v) => onChange({ ...value, year: digits(v) })}
        keyboardType="number-pad"
        maxLength={4}
        containerStyle={{ flex: 1.3 }}
      />
    </View>
    {error ? (
      <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
        {error}
      </T>
    ) : null}
  </View>
);
