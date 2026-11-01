// Le ralenti dépend de la fréquence de capture : on prend la meilleure disponible (§ 7.10, § 10.5).
export const CAPTURE_FPS_LADDER = [240, 120, 60, 30] as const;
export const SLOW_MOTION_MIN_FPS = 100;

export type CaptureChoice = { fps: number; slowMotion: boolean };

export const chooseCaptureFps = (supports: (fps: number) => boolean): CaptureChoice => {
  const fps = CAPTURE_FPS_LADDER.find((candidate) => supports(candidate)) ?? 30;
  return { fps, slowMotion: fps >= SLOW_MOTION_MIN_FPS };
};
