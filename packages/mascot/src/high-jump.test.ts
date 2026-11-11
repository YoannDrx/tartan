import { describe, expect, it } from "vitest";
import {
  HIGH_JUMP_APEX,
  HIGH_JUMP_PHASES,
  HIGH_JUMP_STAGE,
  highJumpAt,
  highJumpPose,
  highJumpRoot,
  type HighJumpPhase,
} from "./high-jump";
import { POSES } from "./poses";
import { jointPositions } from "./skeleton";

const PHASES = Object.keys(HIGH_JUMP_PHASES) as HighJumpPhase[];

describe("saut en hauteur", () => {
  it("enchaîne ses phases sans trou, de 0 à 1", () => {
    expect(HIGH_JUMP_PHASES.ready[0]).toBe(0);
    expect(HIGH_JUMP_PHASES.celebrate[1]).toBe(1);
    PHASES.slice(1).forEach((phase, index) => {
      expect(HIGH_JUMP_PHASES[phase][0]).toBe(HIGH_JUMP_PHASES[PHASES[index]!][1]);
    });
  });

  it("raccorde la fin d'une phase au début de la suivante", () => {
    PHASES.slice(1).forEach((phase, index) => {
      const before = highJumpAt(PHASES[index]!, 1);
      const after = highJumpAt(phase, 0);
      for (const key of Object.keys(after.pose) as Array<keyof typeof after.pose>) {
        expect(before.pose[key], `${key} entre ${PHASES[index]} et ${phase}`).toBeCloseTo(after.pose[key], 6);
      }
      expect(before.root.x).toBeCloseTo(after.root.x, 6);
      expect(before.root.y).toBeCloseTo(after.root.y, 6);
    });
  });

  it("part debout et finit les bras en l'air, tourné vers la barre", () => {
    expect(highJumpAt("ready", 0)).toEqual({ pose: POSES.stand, root: { x: 190, y: 600 } });
    // La dernière clé tombe après la fin du clip : au-delà, la pose ne bouge plus.
    const end = highJumpPose("celebrate", 3);
    expect(end).toEqual({ ...POSES.cheer, rot: 360, flip: -1 });
  });

  it("passe par la pose d'apex au sommet de la trajectoire", () => {
    const { pose, root } = highJumpAt("flight", HIGH_JUMP_APEX);
    for (const key of Object.keys(pose) as Array<keyof typeof pose>) expect(pose[key]).toBeCloseTo(POSES.apex[key], 9);
    expect(root.y).toBeCloseTo(105, 9);
    for (let progress = 0; progress <= 1; progress += 0.02) {
      expect(highJumpRoot("flight", progress).y).toBeGreaterThan(root.y - 2);
    }
  });

  it("tombe au point de chute du tapis", () => {
    expect(highJumpRoot("landing", 0)).toEqual(HIGH_JUMP_STAGE.impact);
  });

  it("garde les pieds près du sol pendant la course d'élan", () => {
    for (let progress = 0.2; progress <= 1; progress += 0.05) {
      const { pose, root } = highJumpAt("approach", progress);
      const { footA, footB } = jointPositions(pose, root);
      const lowest = Math.max(footA.y, footB.y);
      expect(lowest).toBeGreaterThan(HIGH_JUMP_STAGE.ground - 80);
      expect(lowest).toBeLessThan(HIGH_JUMP_STAGE.ground + 20);
    }
  });

  it("sépare les angles du déplacement du bassin", () => {
    for (const phase of PHASES) {
      expect(highJumpAt(phase, 0.4)).toEqual({ pose: highJumpPose(phase, 0.4), root: highJumpRoot(phase, 0.4) });
    }
  });
});
