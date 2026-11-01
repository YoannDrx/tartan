import type { JumpResult } from "@tartan/contracts";

export type Attempt = { barHeightCm: number; attemptNo: number; result: JumpResult };

export const formatHeight = (cm: number): string => (cm / 100).toFixed(2).replace(".", ",");

// Notation officielle des concours verticaux : O, XO, XXO, X–, XXX…
export const notationFor = (attempts: Attempt[]): string =>
  [...attempts]
    .sort((a, b) => a.attemptNo - b.attemptNo)
    .map((a) => (a.result === "pass" ? "–" : a.result))
    .join("");

export type BarSheetRow = { heightCm: number; label: string; notation: string; cleared: boolean };

export const barSheet = (attempts: Attempt[]): BarSheetRow[] => {
  const heights = [...new Set(attempts.map((a) => a.barHeightCm))].sort((a, b) => a - b);
  return heights.map((heightCm) => {
    const here = attempts.filter((a) => a.barHeightCm === heightCm);
    return {
      heightCm,
      label: formatHeight(heightCm),
      notation: notationFor(here),
      cleared: here.some((a) => a.result === "O"),
    };
  });
};

export const bestClearedHeight = (attempts: Attempt[]): number | null => {
  const cleared = attempts.filter((a) => a.result === "O").map((a) => a.barHeightCm);
  return cleared.length ? Math.max(...cleared) : null;
};

// Dernière séance de saut d'une liste d'essais : même séance, même concours, ou à défaut même jour.
export const latestSitting = <
  T extends { scheduledSessionId: string | null; competitionId: string | null; createdAt: Date },
>(
  attempts: T[],
): T[] => {
  const keyOf = (a: T) => a.scheduledSessionId ?? a.competitionId ?? a.createdAt.toISOString().slice(0, 10);
  const latest = attempts.reduce<T | null>((best, a) => (!best || a.createdAt > best.createdAt ? a : best), null);
  return latest ? attempts.filter((a) => keyOf(a) === keyOf(latest)) : [];
};

// Prochain essai logique à une barre donnée (1 à 3), null si la barre est terminée.
export const nextAttemptNo = (attempts: Attempt[], heightCm: number): number | null => {
  const here = attempts.filter((a) => a.barHeightCm === heightCm);
  if (here.some((a) => a.result === "O" || a.result === "pass")) return null;
  return here.length >= 3 ? null : here.length + 1;
};

export const formatTimecode = (ms: number): string => {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0").replace(".", ",")}`;
};

export const frameStepMs = (fps: number | null | undefined): number => 1000 / (fps && fps > 0 ? fps : 30);

export const isHighFrameRate = (fps: number | null | undefined): boolean => (fps ?? 0) >= 100;

const PHASE_ORDER = ["approach", "penultimate", "takeoff", "clearance", "landing"] as const;
export type Phase = (typeof PHASE_ORDER)[number];

export type PhaseRange = { phase: Phase; startMs: number; endMs: number };

// Segments de timeline : chaque phase commence à sa première annotation. Sans annotation, pas de découpe inventée.
export const phaseRanges = (annotations: { tMs: number; phase: Phase | null }[], durationMs: number): PhaseRange[] => {
  const starts = PHASE_ORDER.flatMap((phase) => {
    const times = annotations.filter((a) => a.phase === phase).map((a) => a.tMs);
    return times.length ? [{ phase, startMs: Math.min(...times) }] : [];
  }).sort((a, b) => a.startMs - b.startMs);
  return starts.map((s, i) => ({
    phase: s.phase,
    startMs: i === 0 ? 0 : s.startMs,
    endMs: starts[i + 1]?.startMs ?? durationMs,
  }));
};

export const phaseAt = (ranges: PhaseRange[], tMs: number): Phase | null =>
  ranges.find((r) => tMs >= r.startMs && tMs < r.endMs)?.phase ?? null;
