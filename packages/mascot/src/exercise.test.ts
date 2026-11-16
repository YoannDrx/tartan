import { describe, expect, it } from "vitest";
import { GYM } from "./exercise";
import { EXERCISE_CLIPS } from "./exercises";
import { POSES } from "./poses";
import { rig } from "./rig";
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
      const joints = jointPositions(pose, root, clip.facing);
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

describe("vue de face", () => {
  const raised = { ...POSES.stand, lean: 0, armA: 90, elbowA: 0, armB: 90, elbowB: 0, legA: 12, kneeA: 0, legB: 12, kneeB: 0 };

  it("un angle positif écarte les deux membres, en miroir", () => {
    const joints = jointPositions(raised, { x: 0, y: 0 }, "front");
    expect(joints.handA.x).toBeGreaterThan(60);
    expect(joints.handB.x).toBeCloseTo(-joints.handA.x, 6);
    expect(joints.handA.y).toBeCloseTo(joints.handB.y, 6);
    expect(joints.footA.x).toBeCloseTo(-joints.footB.x, 6);
    expect(joints.footA.x).toBeGreaterThan(18);
  });

  it("le profil ne change pas : les deux bras partent du même point", () => {
    const joints = jointPositions(raised, { x: 0, y: 0 });
    expect(joints.handA.x).toBeCloseTo(joints.handB.x, 6);
  });

  it("de face, les deux yeux encadrent le milieu du visage ; de dos, aucun visage", () => {
    const eyes = (view: "front" | "back") => rig({ hair: "bun", face: "neutral", bib: 3 }, view).find((bone) => bone.id === "eyes")!;
    const discs = eyes("front").shapes.filter((shape) => shape.kind === "disc");
    expect(discs.map((shape) => (shape.kind === "disc" ? shape.x : 0)).reduce((a, b) => a + b, 0)).toBe(0);
    expect(eyes("back").shapes).toHaveLength(0);
    expect(rig({ hair: "bun", face: "neutral", bib: 3 }, "back").some((bone) => bone.id === "bib")).toBe(false);
  });

  it("les gestes de face déclarent leur point de vue", () => {
    for (const key of ["lateral-raise", "lateral-lunge", "jumping-jacks", "side-plank", "cone-side-shuffle"])
      expect(EXERCISE_CLIPS[key]!.facing).toBe("front");
    expect(EXERCISE_CLIPS["prone-hip-rotation"]!.facing).toBe("back");
    expect(EXERCISE_CLIPS["back-squat"]!.facing).toBe("side");
  });
});
