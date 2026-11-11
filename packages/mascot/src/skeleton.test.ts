import { describe, expect, it } from "vitest";
import { POSES } from "./poses";
import { BODY, chain, jointPositions, SKELETON, STACK, type Pose } from "./skeleton";

const STRAIGHT: Pose = {
  ...POSES.stand,
  lean: 0,
  armA: 0,
  elbowA: 0,
  armB: 0,
  elbowB: 0,
  legA: 0,
  kneeA: 0,
  legB: 0,
  kneeB: 0,
};
const near = (point: { x: number; y: number }, x: number, y: number) => {
  expect(point.x).toBeCloseTo(x, 9);
  expect(point.y).toBeCloseTo(y, 9);
};

describe("SKELETON", () => {
  it("déclare chaque os après celui qui le porte", () => {
    const seen = new Set<string>();
    for (const bone of SKELETON) {
      if (bone.parent) expect(seen.has(bone.parent)).toBe(true);
      seen.add(bone.id);
    }
    expect(seen.size).toBe(SKELETON.length);
  });

  it("empile le côté B derrière le corps et le côté A devant", () => {
    expect(STACK.map((bone) => bone.id)).toEqual([
      "thighB",
      "shinB",
      "upperArmB",
      "forearmB",
      "thighA",
      "shinA",
      "torso",
      "head",
      "eyes",
      "upperArmA",
      "forearmA",
    ]);
  });

  it("donne à chaque os son chemin depuis le bassin", () => {
    const forearm = SKELETON.find((bone) => bone.id === "forearmA")!;
    expect(chain(forearm, POSES.cheer)).toEqual([
      { turn: -2 },
      { move: { x: 0, y: -BODY.shoulder } },
      { turn: -122 },
      { move: { x: 0, y: BODY.arm } },
      { turn: -8 },
    ]);
  });
});

describe("jointPositions", () => {
  it("place les mains, les pieds et la tête d'un corps droit", () => {
    const at = jointPositions(STRAIGHT);
    near(at.pelvis, 0, 0);
    near(at.head, 0, -BODY.neck);
    near(at.handA, 0, -BODY.shoulder + BODY.arm + BODY.forearm);
    near(at.handB, 0, -BODY.shoulder + BODY.arm + BODY.forearm);
    near(at.footA, 0, BODY.thigh + BODY.shin);
  });

  it("suit les articulations", () => {
    // Bras levé à l'horizontale vers l'avant, coude plié à angle droit vers le haut.
    const at = jointPositions({ ...STRAIGHT, armA: 90, elbowA: 90 });
    near(at.handA, BODY.arm, -BODY.shoulder - BODY.forearm);
    // Genou plié à angle droit : le pied part vers l'arrière.
    near(jointPositions({ ...STRAIGHT, kneeB: 90 }).footB, -BODY.shin, BODY.thigh);
  });

  it("applique l'orientation du corps puis la position du bassin", () => {
    const turned = jointPositions({ ...STRAIGHT, rot: 90 }, { x: 100, y: 50 });
    near(turned.pelvis, 100, 50);
    near(turned.footA, 100 - (BODY.thigh + BODY.shin), 50);
    const flipped = jointPositions({ ...STRAIGHT, flip: -1, armA: 90 });
    near(flipped.handA, -(BODY.arm + BODY.forearm), -BODY.shoulder);
    near(jointPositions({ ...STRAIGHT, sy: 2 }).head, 0, -2 * BODY.neck);
  });
});
