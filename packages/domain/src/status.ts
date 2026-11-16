import type { CellStatus, LogStatus } from "@tartan/contracts";

export const OVERDUE_HOURS = 24;

// Le groupe est en France : une journée de séance se compte à l'heure de Paris, comme « aujourd'hui » côté serveur.
export const TRAINING_TIME_ZONE = "Europe/Paris";

const parisWallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: TRAINING_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Écart entre l'heure de Paris et l'UTC à cet instant, en millisecondes (une heure l'hiver, deux l'été).
const parisOffsetMs = (instant: Date): number => {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parisWallClock.formatToParts(instant).find((p) => p.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
};

// Dernière seconde de la journée à Paris. Les changements d'heure ont lieu la nuit, jamais à 23 h 59.
export const endOfTrainingDay = (date: string): Date => {
  const asUtc = new Date(`${date}T23:59:59.000Z`);
  return new Date(asUtc.getTime() - parisOffsetMs(asUtc));
};

// Une séance sans heure est réputée se terminer en fin de journée, à Paris.
export const sessionDeadline = (date: string): Date =>
  new Date(endOfTrainingDay(date).getTime() + OVERDUE_HOURS * 3600 * 1000);

export const isOverdue = (date: string, now: Date): boolean => now > sessionDeadline(date);

// Une fiche sans compte ne valide rien elle-même : l'absence de saisie n'est pas une séance manquée.
export const cellStatusOf = (
  log: { status: LogStatus } | null | undefined,
  date: string,
  now: Date,
  hasAccount = true,
): CellStatus => {
  if (log?.status === "done") return "done";
  if (log?.status === "partial") return "partial";
  if (!hasAccount) return isOverdue(date, now) ? "no_return" : "upcoming";
  if (log?.status === "missed" || log?.status === "skipped") return "missed";
  return isOverdue(date, now) ? "missed" : "upcoming";
};

// Pourcentage de réalisation : fait = 1, partiel = 0,5, à venir non compté.
export const completionPct = (statuses: (CellStatus | null)[]): number | null => {
  let past = 0;
  let score = 0;
  for (const s of statuses) {
    if (!s || s === "upcoming" || s === "no_return") continue;
    past += 1;
    if (s === "done") score += 1;
    if (s === "partial") score += 0.5;
  }
  return past === 0 ? null : Math.round((score / past) * 100);
};

export const trailingMissedCount = (statusesOldestFirst: CellStatus[]): number => {
  let count = 0;
  for (let i = statusesOldestFirst.length - 1; i >= 0; i -= 1) {
    const s = statusesOldestFirst[i];
    if (s === "upcoming") continue;
    if (s === "missed") count += 1;
    else break;
  }
  return count;
};

export const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
};

// Dans la semaine en cours, une nouvelle séance part d'aujourd'hui plutôt que d'un lundi déjà passé.
export const defaultDateForWeek = (weekStart: string, today: string): string =>
  startOfWeek(today) === weekStart ? today : weekStart;

export const startOfWeek = (isoDate: string): string => {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  const day = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -day);
};

export const weekDays = (weekStart: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
