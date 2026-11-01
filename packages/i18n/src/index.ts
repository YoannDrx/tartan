import { fr, type Messages } from "./fr";

export type { Messages } from "./fr";

export const defaultLocale = "fr";

export const locales = { fr } satisfies Record<string, Messages>;

export type Locale = keyof typeof locales;

export const getMessages = (locale: string | null | undefined): Messages =>
  locales[(locale ?? defaultLocale) as Locale] ?? fr;

export const m = fr;

export const formatDateLong = (isoDate: string): string =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00.000Z`),
  );

export const formatDayMonth = (isoDate: string): string =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00.000Z`),
  );

export const formatWeekdayShort = (isoDate: string): string => {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00.000Z`),
  );
  return (label.charAt(0).toUpperCase() + label.slice(1)).replace(".", "");
};

// Les tests de force sont stockés par clé stable ; on n'affiche jamais la clé brute si un libellé existe.
export const strengthTestLabel = (key: string): string =>
  (fr.strengthTest as Record<string, string>)[key] ?? key.replaceAll("_", " ");

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
