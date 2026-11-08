/** Legacy jump metadata remains meaningful; a shared session's bar sheet alone does not classify a video. */
export const hasHighJumpContext = (video: {
  barHeightCm?: number | null;
  attemptNo?: number | null;
  result?: string | null;
  annotations?: readonly { phase?: string | null }[];
}): boolean =>
  video.barHeightCm != null ||
  video.attemptNo != null ||
  video.result != null ||
  Boolean(video.annotations?.some((annotation) => annotation.phase != null));
