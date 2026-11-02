import { describe, expect, it } from "vitest";
import { groupMarkers } from "@/features/videos/timeline-markers";

const at = (...times: number[]) => times.map((tMs) => ({ tMs }));

describe("repères de la timeline vidéo", () => {
  it("regroupe les repères trop proches pour être touchés", () => {
    const groups = groupMarkers(at(1000, 1010, 5000), 10000, 300);
    expect(groups.map((g) => [g.first.tMs, g.count])).toEqual([
      [1000, 2],
      [5000, 1],
    ]);
  });

  it("garde séparés les repères assez espacés, même donnés dans le désordre", () => {
    const groups = groupMarkers(at(9000, 1000), 10000, 300);
    expect(groups.map((g) => g.first.tMs)).toEqual([1000, 9000]);
  });

  it("garde un écart d'au moins 28 px entre deux boutons", () => {
    const width = 320;
    const times = Array.from({ length: 40 }, (_, i) => i * 250);
    const firsts = groupMarkers(at(...times), 10000, width).map((g) => (g.first.tMs / 10000) * width);
    firsts.slice(1).forEach((x, i) => expect(x - (firsts[i] ?? 0)).toBeGreaterThanOrEqual(28));
  });

  it("ne plante pas sur une vidéo sans durée connue", () => {
    expect(groupMarkers(at(0, 0), 0, 300)).toHaveLength(1);
  });
});
