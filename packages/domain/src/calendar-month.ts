import { monthGrid, shiftMonth } from "./date-input";

export type CalendarView = "list" | "month" | "week";

// La période réellement affichée par un mois : six semaines complètes, du lundi au dimanche.
export const monthRange = (month: string): { from: string; to: string; cells: string[] } => {
  const [year, index] = month.split("-").map(Number) as [number, number];
  const cells = monthGrid(year, index);
  return { from: cells[0]!, to: cells[41]!, cells };
};

export const shiftMonthKey = (month: string, delta: number): string => {
  const [year, index] = month.split("-").map(Number) as [number, number];
  const next = shiftMonth(year, index, delta);
  return `${next.year}-${String(next.month).padStart(2, "0")}`;
};

export const calendarCompletion = (
  statuses: readonly ("done" | "partial" | "missed" | "skipped")[],
  total: number,
): { done: number; partial: number; missed: number; total: number } => ({
  done: statuses.filter((s) => s === "done").length,
  partial: statuses.filter((s) => s === "partial").length,
  missed: statuses.filter((s) => s === "missed" || s === "skipped").length,
  total,
});

// Trois pastilles au plus par jour : le reste se résume, la liste du jour donne le détail.
export const visibleDayItems = <T>(items: readonly T[], limit = 3): { visible: T[]; hidden: number } => ({
  visible: items.slice(0, limit),
  hidden: Math.max(0, items.length - limit),
});
