import { describe, expect, it } from "vitest";
import { framePace } from "./frame-pace";

describe("cadence du geste", () => {
  it("laisse passer trente images par seconde sur un écran à soixante", () => {
    const pace = framePace(30);
    const passed: number[] = [];
    for (let frame = 0; frame <= 60; frame += 1) {
      const elapsed = pace(frame * (1000 / 60));
      if (elapsed !== null) passed.push(elapsed);
    }
    // La première image part de zéro, puis une image sur deux.
    expect(passed).toHaveLength(31);
    expect(passed[0]).toBe(0);
    expect(passed.slice(1).every((elapsed) => Math.abs(elapsed - 1000 / 30) < 0.01)).toBe(true);
  });

  it("garde le temps réel : la somme des images vaut le temps écoulé", () => {
    const pace = framePace(30);
    let total = 0;
    for (let frame = 0; frame <= 240; frame += 1) total += pace(frame * (1000 / 120)) ?? 0;
    expect(total).toBeCloseTo(2000, 6);
  });

  it("ne fait pas sauter le geste au retour de l'arrière-plan", () => {
    const pace = framePace(30);
    pace(0);
    expect(pace(60_000)).toBe(100);
    expect(pace(60_010)).toBeNull();
  });
});
