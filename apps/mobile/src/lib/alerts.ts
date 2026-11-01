import type { CoachAlert } from "@tartan/contracts";

export type AthleteAlertGroup = {
  athleteId: string;
  main: CoachAlert;
  // Motifs secondaires, résumés sur la même ligne.
  others: CoachAlert[];
};

// Une ligne par athlète : l'alerte la plus grave (l'API les trie déjà) porte le titre.
export const groupAlerts = (alerts: CoachAlert[]): AthleteAlertGroup[] => {
  const groups = new Map<string, AthleteAlertGroup>();
  for (const alert of alerts) {
    const group = groups.get(alert.athleteId);
    if (group) group.others.push(alert);
    else groups.set(alert.athleteId, { athleteId: alert.athleteId, main: alert, others: [] });
  }
  return [...groups.values()];
};
