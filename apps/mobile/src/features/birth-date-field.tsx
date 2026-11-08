import { m } from "@tartan/i18n";
import { localIsoDate } from "../lib/dates";
import { DateField } from "../ui/date-field";

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

const partsOf = (iso: string): BirthParts =>
  iso ? { year: iso.slice(0, 4), month: iso.slice(5, 7), day: iso.slice(8, 10) } : { day: "", month: "", year: "" };

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
  <DateField
    testID="birth-date"
    label={m.invite.birthDate}
    value={toIsoBirthDate(value) ?? ""}
    max={localIsoDate()}
    error={error}
    onChangeText={(iso) => onChange(partsOf(iso))}
  />
);
