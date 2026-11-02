// Des repères trop proches ne se touchent plus au doigt : ils se regroupent, le bouton mène au premier (WCAG 2.5.8).
export const MIN_MARKER_GAP_PX = 28;

export const groupMarkers = <T extends { tMs: number }>(
  items: T[],
  durationMs: number,
  widthPx: number,
  minGapPx = MIN_MARKER_GAP_PX,
): { first: T; count: number }[] => {
  const groups: { first: T; count: number }[] = [];
  const pixelsPerMs = durationMs > 0 ? widthPx / durationMs : 0;
  for (const item of [...items].sort((a, b) => a.tMs - b.tMs)) {
    const last = groups.at(-1);
    if (last && (item.tMs - last.first.tMs) * pixelsPerMs < minGapPx) last.count += 1;
    else groups.push({ first: item, count: 1 });
  }
  return groups;
};
