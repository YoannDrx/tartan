import type { CellStatus } from "@tartan/contracts";
import { addDays, startOfWeek } from "./status";

// La série de régularité de l'athlète, en semaines : celles où il a rendu chacune de ses séances.
// - Une séance compte quand elle est validée, en entier ou en partie : c'est un retour au coach.
// - Une absence signalée à l'avance excuse la séance : dire qu'on ne vient pas ne casse jamais la série.
// - Une semaine sans séance (repos, vacances) ne compte pas et ne casse rien.
// - Une séance encore dans son délai de saisie (celle du jour, celle de la veille) ne casse rien : la semaine en
//   cours compte dès sa première séance validée, tant qu'aucune n'a été manquée.
export type RegularityEntry = { date: string; status: CellStatus; excused?: boolean };
export type Regularity = {
  // Semaines de suite.
  weeks: number;
  // La semaine en cours, pour le tour de piste : séances prévues, hors absences signalées, et séances rendues.
  planned: number;
  validated: number;
};

const isValidated = (status: CellStatus) => status === "done" || status === "partial";

export const regularity = (entries: readonly RegularityEntry[], today: string): Regularity => {
  const byWeek = new Map<string, RegularityEntry[]>();
  for (const entry of entries) {
    if (entry.excused && !isValidated(entry.status)) continue;
    const monday = startOfWeek(entry.date);
    byWeek.set(monday, [...(byWeek.get(monday) ?? []), entry]);
  }
  const current = startOfWeek(today);
  const thisWeek = byWeek.get(current) ?? [];
  const oldest = [...byWeek.keys()].sort()[0] ?? current;

  let weeks = 0;
  for (let monday = current; monday >= oldest; monday = addDays(monday, -7)) {
    const list = byWeek.get(monday) ?? [];
    if (list.some((entry) => entry.status === "missed")) break;
    if (list.some((entry) => isValidated(entry.status))) weeks += 1;
  }
  return {
    weeks,
    planned: thisWeek.length,
    validated: thisWeek.filter((entry) => isValidated(entry.status)).length,
  };
};
