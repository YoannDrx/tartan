import {
  BAR_STEP,
  FLIGHT_TICKS,
  OUTCOME,
  STAGE,
  START_BAR,
  TAKEOFF_TICK,
  highJump,
} from "@tartan/game/events/high-jump";
import { describe, expect, it } from "vitest";
import { SLOW, arcLift, barLift, clipTime, highJumpTimeScale } from "@/features/game/high-jump-scene";

// La scène du saut en hauteur : la barre monte avec les hauteurs, le sauteur avec elle, et le geste passe au ralenti
// à l'appel puis au franchissement. Tout cela n'est que de l'image : la simulation ne bouge pas.

const at = (stage: number, t: number) => ({ ...highJump.init(1), stage, t });

describe("scène du saut en hauteur", () => {
  it("monte la barre d'un cran par hauteur, sans sortir du cadre", () => {
    expect(barLift(START_BAR)).toBe(0);
    expect(barLift(START_BAR + BAR_STEP)).toBe(10);
    expect(barLift(START_BAR + 4 * BAR_STEP)).toBe(40);
    expect(barLift(3_000)).toBe(150);
  });

  it("ralentit l'appel, le franchissement et la réception, pas l'élan", () => {
    expect(highJumpTimeScale(at(STAGE.approach, 0))).toBe(1);
    expect(highJumpTimeScale(at(STAGE.approach, TAKEOFF_TICK - 10))).toBe(SLOW.takeoff);
    expect(highJumpTimeScale(at(STAGE.flight, 5))).toBe(SLOW.takeoff);
    expect(highJumpTimeScale(at(STAGE.flight, 30))).toBe(SLOW.clearance);
    expect(highJumpTimeScale(at(STAGE.flight, FLIGHT_TICKS - 1))).toBe(1);
    expect(highJumpTimeScale({ ...at(STAGE.reset, 10), outcome: OUTCOME.cleared })).toBe(SLOW.celebration);
    expect(highJumpTimeScale({ ...at(STAGE.reset, 10), outcome: OUTCOME.failed })).toBe(SLOW.fall);
    expect(highJumpTimeScale({ ...at(STAGE.reset, 10), outcome: OUTCOME.balked })).toBe(1);
  });

  it("élève l'arc du sauteur au sommet, pas à l'appel ni sur le tapis", () => {
    const takeoff = clipTime(at(STAGE.flight, 0));
    const apex = clipTime(at(STAGE.flight, FLIGHT_TICKS / 2));
    const landing = clipTime(at(STAGE.flight, FLIGHT_TICKS));
    expect(arcLift(takeoff, 70)).toBe(0);
    expect(arcLift(apex, 70)).toBeGreaterThan(60);
    expect(arcLift(landing, 70)).toBeCloseTo(0, 5);
  });
});
