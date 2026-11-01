import type { JumpPhase } from "@tartan/contracts";

export const PHASE_ORDER: JumpPhase[] = ["approach", "penultimate", "takeoff", "clearance", "landing"];

export type PhaseSegment = { phase: JumpPhase; startMs: number; endMs: number };

// L'API ne stocke pas de bornes de phase : elles découlent des remarques du coach.
// Chaque phase commentée s'étend jusqu'à la remarque de la phase suivante. Aucune borne inventée.
export const phaseSegments = (
  annotations: { tMs: number; phase: JumpPhase | null }[],
  durationMs: number | null,
): PhaseSegment[] => {
  if (!durationMs || durationMs <= 0) return [];
  const firstByPhase = new Map<JumpPhase, number>();
  for (const a of annotations) {
    if (!a.phase) continue;
    const seen = firstByPhase.get(a.phase);
    if (seen === undefined || a.tMs < seen) firstByPhase.set(a.phase, a.tMs);
  }
  const ordered = PHASE_ORDER.filter((p) => firstByPhase.has(p))
    .map((phase) => ({ phase, startMs: Math.min(firstByPhase.get(phase) as number, durationMs) }))
    .sort((a, b) => a.startMs - b.startMs);
  return ordered.map((segment, i) => ({
    ...segment,
    startMs: i === 0 ? 0 : segment.startMs,
    endMs: ordered[i + 1]?.startMs ?? durationMs,
  }));
};

export const segmentAt = (segments: PhaseSegment[], tMs: number): PhaseSegment | null =>
  segments.find((s) => tMs >= s.startMs && tMs < s.endMs) ?? segments[segments.length - 1] ?? null;

// Au centième : le pas image par image doit se voir à l'écran.
export const preciseTimecode = (ms: number): string => {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0").replace(".", ",")}`;
};
