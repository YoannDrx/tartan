import { describe, expect, it } from "vitest";
import { phaseSegments, segmentAt } from "./phases";

describe("phaseSegments", () => {
  it("n'invente rien sans remarque ni durée", () => {
    expect(phaseSegments([], 3000)).toEqual([]);
    expect(phaseSegments([{ tMs: 100, phase: "takeoff" }], null)).toEqual([]);
    expect(phaseSegments([{ tMs: 100, phase: null }], 3000)).toEqual([]);
  });

  it("couvre toute la durée à partir des remarques", () => {
    const out = phaseSegments(
      [
        { tMs: 2400, phase: "takeoff" },
        { tMs: 3100, phase: "clearance" },
        { tMs: 2600, phase: "takeoff" },
      ],
      4000,
    );
    expect(out).toEqual([
      { phase: "takeoff", startMs: 0, endMs: 3100 },
      { phase: "clearance", startMs: 3100, endMs: 4000 },
    ]);
  });

  it("borne une remarque placée après la fin", () => {
    const out = phaseSegments(
      [
        { tMs: 100, phase: "approach" },
        { tMs: 9000, phase: "landing" },
      ],
      4000,
    );
    expect(out[1]).toEqual({ phase: "landing", startMs: 4000, endMs: 4000 });
  });
});

describe("segmentAt", () => {
  it("trouve la phase courante", () => {
    const segments = phaseSegments(
      [
        { tMs: 1000, phase: "takeoff" },
        { tMs: 2000, phase: "clearance" },
      ],
      3000,
    );
    expect(segmentAt(segments, 500)?.phase).toBe("takeoff");
    expect(segmentAt(segments, 2500)?.phase).toBe("clearance");
    expect(segmentAt(segments, 3000)?.phase).toBe("clearance");
    expect(segmentAt([], 0)).toBeNull();
  });
});
