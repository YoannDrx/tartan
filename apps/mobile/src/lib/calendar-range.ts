import { monthRange, shiftMonthKey } from "@tartan/domain";
import { localIsoDate } from "./dates";

// Seuls le mois courant et ses voisins restent sur le téléphone : le cache tient sur une seule clé.
export const isPersistedCalendarRange = (from: string, to: string, today: string = localIsoDate()): boolean => {
  const current = today.slice(0, 7);
  return to >= monthRange(shiftMonthKey(current, -1)).from && from <= monthRange(shiftMonthKey(current, 1)).to;
};
