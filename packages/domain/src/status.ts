import type { CellStatus, LogStatus } from "@tartan/contracts";

export const OVERDUE_HOURS = 24;

// Une séance sans heure est réputée se terminer en fin de journée (heure UTC du jour).
export const sessionDeadline = (date: string): Date => {
  const end = new Date(`${date}T23:59:59.000Z`);
  return new Date(end.getTime() + OVERDUE_HOURS * 3600 * 1000);
};

export const isOverdue = (date: string, now: Date): boolean => now > sessionDeadline(date);

export const cellStatusOf = (log: { status: LogStatus } | null | undefined, date: string, now: Date): CellStatus => {
  if (log?.status === "done") return "done";
  if (log?.status === "partial") return "partial";
  if (log?.status === "missed" || log?.status === "skipped") return "missed";
  return isOverdue(date, now) ? "missed" : "upcoming";
};

// Pourcentage de réalisation : fait = 1, partiel = 0,5, à venir non compté.
export const completionPct = (statuses: (CellStatus | null)[]): number | null => {
  let past = 0;
  let score = 0;
  for (const s of statuses) {
    if (!s || s === "upcoming") continue;
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

export const startOfWeek = (isoDate: string): string => {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  const day = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -day);
};

export const weekDays = (weekStart: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
