import { describe, expect, it } from "vitest";
import { blend, runPose, runRise, sample, samplePose, smooth, type Track } from "./clip";
import { POSES } from "./poses";

const TRACK: Track<{ v: number }> = [
  { t: 0, v: { v: 0 } },
  { t: 1, v: { v: 10 } },
  { t: 3, v: { v: 10 } },
  { t: 4, v: { v: -5 } },
];

describe("sample", () => {
  it("passe par chaque clé", () => {
    for (const key of TRACK) expect(sample(TRACK, key.t).v).toBeCloseTo(key.v.v, 12);
  });

  it("ne bouge plus avant la première clé ni après la dernière", () => {
    expect(sample(TRACK, -2)).toEqual({ v: 0 });
    expect(sample(TRACK, 9)).toEqual({ v: -5 });
  });

  it("dépasse légèrement entre deux clés égales, pour le rebond", () => {
    expect(sample(TRACK, 2).v).toBeGreaterThan(10);
  });

  it("borne le retournement d'une pose", () => {
    const track = [
      { t: 0, v: POSES.stand },
      { t: 1, v: POSES.stand },
      { t: 2, v: POSES.apex },
      { t: 3, v: POSES.apex },
    ];
    for (let t = 0; t <= 3; t += 0.05) {
      const { flip } = samplePose(track, t);
      expect(flip).toBeGreaterThanOrEqual(-1);
      expect(flip).toBeLessThanOrEqual(1);
    }
  });
});

describe("outils de clip", () => {
  it("adoucit entre deux bornes", () => {
    expect(smooth(2, 4, 1)).toBe(0);
    expect(smooth(2, 4, 3)).toBe(0.5);
    expect(smooth(2, 4, 5)).toBe(1);
  });

  it("mélange deux valeurs champ par champ", () => {
    expect(blend({ x: 0, y: 10 }, { x: 4, y: 20 }, 0.25)).toEqual({ x: 1, y: 12.5 });
  });
});

describe("runPose", () => {
  it("croise les jambes et oppose les bras", () => {
    const pose = runPose(Math.PI / 2);
    expect(pose.legA).toBe(60);
    expect(pose.legB).toBe(-36);
    expect(pose.armA).toBe(-pose.armB);
  });

  it("revient à la même foulée après deux appuis", () => {
    const first = runPose(0.7);
    const again = runPose(0.7 + 2 * Math.PI);
    for (const key of Object.keys(first) as Array<keyof typeof first>) expect(again[key]).toBeCloseTo(first[key], 9);
  });

  it("monte le bassin à chaque appui", () => {
    expect(runRise(0)).toBe(8);
    expect(runRise(Math.PI / 2)).toBe(26);
  });
});
