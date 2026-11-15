import { describe, expect, it } from "vitest";
import { GYM } from "./exercise";
import { EXERCISE_CLIPS } from "./exercises";
import { jointPositions } from "./skeleton";

const clips = Object.values(EXERCISE_CLIPS);
// Les gestes tirés d'une épreuve gardent leur propre scène et leurs propres tests (events.test.ts).
const gym = clips.filter((clip) => clip.stage === GYM);
// La hauteur de repos de chaque appui (la cheville au-dessus de la semelle, le centre de la main, le bassin assis).
// Une marge de 8 unités absorbe le léger dépassement voulu de l'interpolation entre deux clés.
const FLOOR = { footA: 16, footB: 16, handA: 15, handB: 15, pelvis: 20, head: 40, shoulder: 26 } as const;

describe("gestes des exercices", () => {
  it.each(clips.filter((clip) => clip.loop).map((clip) => [clip.key, clip] as const))("%s : une boucle sans à-coup", (_, clip) => {
    const [start, end] = [clip.frame(0), clip.frame(1)];
    expect(end.root.x).toBeCloseTo(start.root.x, 3);
    expect(end.root.y).toBeCloseTo(start.root.y, 3);
    for (const key of Object.keys(start.pose) as (keyof typeof start.pose)[])
      expect(end.pose[key]).toBeCloseTo(start.pose[key], 3);
  });

  it.each(clips.map((clip) => [clip.key, clip] as const))("%s : une position par ligne du guide", (_, clip) => {
    expect(clip.positions).toHaveLength(4);
    expect(clip.positions[0]!.from).toBe(0);
    expect(clip.positions.at(-1)!.to).toBeCloseTo(1);
    clip.stills.forEach((t, i) => {
      expect(t).toBeGreaterThanOrEqual(clip.positions[i]!.from);
      expect(t).toBeLessThan(clip.positions[i]!.to);
    });
  });

  it.each(gym.map((clip) => [clip.key, clip] as const))("%s : rien ne traverse le sol", (_, clip) => {
    for (let i = 0; i <= 120; i += 1) {
      const { pose, root } = clip.frame(i / 120);
      const joints = jointPositions(pose, root);
      for (const [anchor, rest] of Object.entries(FLOOR)) {
        const y = joints[anchor as keyof typeof FLOOR].y;
        expect(Number.isFinite(y)).toBe(true);
        expect(y, `${anchor} à t = ${i / 120}`).toBeLessThanOrEqual(GYM.ground - rest + 8);
      }
    }
  });

  it.each(clips.map((clip) => [clip.key, clip] as const))("%s : un cadre au format 3:2", (_, clip) => {
    const [, , width, height] = clip.view.split(" ").map(Number);
    expect(width! / height!).toBeCloseTo(1.5, 1);
  });
});
