import { describe, expect, it } from "vitest";
import { COMBINED_ORDER, MAX_POINTS, SCALE, combinedTotal, pointsFor } from "./combined";
import { EVENTS } from "./events";

describe("combiné : le barème", () => {
  it("vaut 0 à la marque basse, 1 000 à la marque haute, quel que soit le sens de l'épreuve", () => {
    for (const event of COMBINED_ORDER) {
      expect(pointsFor(event, SCALE[event].zero)).toBe(0);
      expect(pointsFor(event, SCALE[event].full)).toBe(1_000);
    }
    // Les haies : plus le temps est bas, plus il vaut.
    expect(pointsFor("hurdles", 14_000)).toBeGreaterThan(pointsFor("hurdles", 15_000));
    expect(pointsFor("longJump", 7_000)).toBeGreaterThan(pointsFor("longJump", 6_000));
  });

  it("une marque nulle vaut 0, et aucune épreuve ne dépasse 1 200 points", () => {
    for (const event of COMBINED_ORDER) {
      expect(pointsFor(event, 0)).toBe(0);
      const best = EVENTS[event].best;
      expect(pointsFor(event, best)).toBeLessThanOrEqual(MAX_POINTS);
    }
    expect(pointsFor("hurdles", 30_000)).toBe(0);
  });

  it("additionne les six épreuves dans l'ordre du combiné", () => {
    const scores = COMBINED_ORDER.map((event) => SCALE[event].full);
    expect(combinedTotal(scores)).toBe(6_000);
    expect(combinedTotal([SCALE.hurdles.full])).toBe(1_000);
  });
});
