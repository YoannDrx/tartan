import { addDays, startOfWeek } from "./status";

const pad = (value: number) => String(value).padStart(2, "0");

export const toIsoDateParts = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

const isRealDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// Affichage français partout ; le serveur et les contrats gardent l'ISO.
export const formatDateInput = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

// Accepte la saisie JJ/MM/AAAA et un collage ISO ; une date impossible ne devient jamais une autre date.
export const parseDateInput = (text: string): string | null => {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const french = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(value);
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : french
      ? [Number(french[3]), Number(french[2]), Number(french[1])]
      : [0, 0, 0];
  if (year < 1900 || year > 2200 || !isRealDate(year, month, day)) return null;
  return toIsoDateParts(year, month, day);
};

// Les barres s'ajoutent toutes seules pendant la frappe : huit chiffres suffisent.
export const maskDateInput = (text: string): string => {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
};

// Six semaines complètes, du lundi au dimanche : la grille ne saute pas d'un mois à l'autre.
export const monthGrid = (year: number, month: number): string[] => {
  const first = startOfWeek(toIsoDateParts(year, month, 1));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
};

export const shiftMonth = (year: number, month: number, delta: number): { year: number; month: number } => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const isDateInRange = (iso: string, min?: string, max?: string): boolean =>
  (!min || iso >= min) && (!max || iso <= max);
