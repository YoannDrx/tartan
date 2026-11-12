import { describe, expect, it } from "vitest";
import { hurdlerPose } from "./hurdles";

describe("le coureur du jeu des haies", () => {
  it("au sol, au début et à la fin d'un saut, c'est la foulée", () => {
    for (const distance of [0, 260, 1234]) {
      expect(hurdlerPose(distance, null)).toEqual(hurdlerPose(distance, 0));
      expect(hurdlerPose(distance, 1)).toEqual(hurdlerPose(distance, null));
    }
  });

  it("au sommet du saut, la jambe d'attaque est tendue au-dessus de la haie", () => {
    const top = hurdlerPose(500, 0.5);
    expect(top.legA).toBeGreaterThan(90);
    expect(top.kneeA).toBeLessThan(20);
  });

  it("la pose varie sans saut brusque d'un pas à l'autre", () => {
    let previous = hurdlerPose(500, 0);
    for (let i = 1; i <= 41; i += 1) {
      const next = hurdlerPose(500, i / 41);
      expect(Math.abs(next.legA - previous.legA)).toBeLessThan(16);
      previous = next;
    }
  });
});
