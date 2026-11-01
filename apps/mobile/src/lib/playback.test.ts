import { toFileSeconds, toRealMs } from "@tartan/domain";
import { describe, expect, it } from "vitest";
import { defaultSpeed, MAX_PLAYER_RATE, playerRate, speedsFor } from "./playback";

describe("lecture d'une vidéo étirée", () => {
  it("un 240 i/s étiré huit fois se lit au temps réel à 8× dans le lecteur", () => {
    expect(playerRate(1, 8)).toBe(8);
    expect(playerRate(0.1, 8)).toBeCloseTo(0.8);
  });

  it("une vidéo non étirée garde la vitesse demandée", () => {
    expect(playerRate(0.5, 1)).toBe(0.5);
    expect(speedsFor(1).map((s) => s.value)).toEqual([0.1, 0.25, 0.5, 1]);
    expect(defaultSpeed(1)).toBe(0.5);
  });

  it("ne propose pas une vitesse que le lecteur ne peut pas tenir", () => {
    expect(speedsFor(16).at(-1)?.value).toBe(1);
    expect(speedsFor(32).map((s) => s.value)).toEqual([0.1, 0.25, 0.5]);
    expect(speedsFor(64).map((s) => s.value)).toEqual([0.1, 0.25]);
    for (const scale of [1, 2, 4, 8, 16, 32, 64]) {
      for (const speed of speedsFor(scale)) expect(playerRate(speed.value, scale)).toBeLessThanOrEqual(MAX_PLAYER_RATE);
      expect(speedsFor(scale).map((s) => s.value)).toContain(defaultSpeed(scale));
    }
  });

  it("une annotation posée à l'écran enregistre le temps réel", () => {
    // Le lecteur est à 16 s dans le fichier étiré : 2 s dans le saut.
    expect(Math.round(toRealMs(16, 8))).toBe(2000);
    expect(toFileSeconds(2000, 8)).toBe(16);
  });
});
