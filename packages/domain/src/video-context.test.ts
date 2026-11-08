import { describe, expect, it } from "vitest";
import { hasHighJumpContext } from "./video-context";

describe("contexte vidéo", () => {
  it("ne transforme pas une vidéo générique ni ses repères temporels en saut", () => {
    expect(hasHighJumpContext({})).toBe(false);
    expect(
      hasHighJumpContext({ barHeightCm: null, attemptNo: null, result: null, annotations: [{ phase: null }] }),
    ).toBe(false);
  });
  it("préserve chaque forme de métadonnée historique de saut", () => {
    for (const video of [
      { barHeightCm: 180 },
      { attemptNo: 2 },
      { result: "X" },
      { annotations: [{ phase: null }, { phase: "takeoff" }] },
    ])
      expect(hasHighJumpContext(video)).toBe(true);
  });
});
