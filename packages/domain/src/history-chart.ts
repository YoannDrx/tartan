import type { ExerciseHistorySession } from "@tartan/contracts";

export const historyPeriods = [28, 84, 365] as const;
export type HistoryPeriod = (typeof historyPeriods)[number];
export const historyRange = (today: string, days: HistoryPeriod) => ({
  from: new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10),
  to: today,
});
export const volumeMetrics = ["tonnageKg", "distanceM", "durationS", "groundContacts"] as const;
export type VolumeMetric = (typeof volumeMetrics)[number];
export type HistoryPoint = { date: string; value: number | null; knownSessions: number; sessions: number };

// Une somme ne porte que sur les mesures renseignées. Une journée sans mesure reste manquante.
// Les doublons de transport n'ajoutent jamais une seconde fois le volume de la même saisie.
export const historyVolumePoints = (
  sessions: readonly ExerciseHistorySession[],
  metric: VolumeMetric,
): HistoryPoint[] => {
  const days = new Map<string, HistoryPoint>();
  const unique = new Map<string, ExerciseHistorySession>();
  for (const session of sessions) {
    const previous = unique.get(session.logId);
    if (!previous || session.version > previous.version) unique.set(session.logId, session);
  }
  for (const session of unique.values()) {
    const point = days.get(session.date) ?? { date: session.date, value: null, knownSessions: 0, sessions: 0 };
    point.sessions++;
    const value = session.volumes[metric];
    if (value !== null) {
      point.value = (point.value ?? 0) + value;
      point.knownSessions++;
    }
    days.set(session.date, point);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
};

// Coordonnées communes SVG web/natif : abscisse temporelle et zéro visible, sans pont au-dessus d'un manque.
export const historyChartGeometry = (points: readonly HistoryPoint[]) => {
  const known = points.filter((point) => point.value !== null);
  const max = Math.max(1, ...known.map((point) => point.value!));
  const first = Date.parse(points[0]?.date ?? "1970-01-01");
  const span = Math.max(86_400_000, Date.parse(points.at(-1)?.date ?? "1970-01-01") - first);
  const dots = points.map((point) => ({
    ...point,
    x: 20 + ((Date.parse(point.date) - first) / span) * 560,
    y: point.value === null ? null : 180 - (point.value / max) * 160,
  }));
  let path = "";
  let connected = false;
  for (const point of dots) {
    if (point.y === null) {
      connected = false;
      continue;
    }
    path += `${connected ? "L" : "M"}${point.x},${point.y} `;
    connected = true;
  }
  return { dots, path: path.trim(), max, showChart: known.length >= 4 };
};
