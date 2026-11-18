import { describe, expect, it } from "vitest";
import { depthIn, extent, seenFrom, type Prop } from "./props";

// Un banc dessiné de profil : un plateau de 100 de long, 14 d'épaisseur, 50 au-dessus du sol, large de 2 × 26.
const bench: Prop = {
  paint: "bench",
  shape: { kind: "rect", x: -40, y: -64, width: 100, height: 14, radius: 4 },
  native: "side",
  at: 0,
  half: 26,
};

describe("matériel", () => {
  it("mesure l'étendue de chaque forme", () => {
    expect(extent(bench.shape)).toEqual({ left: -40, right: 60, top: -64, bottom: -50 });
    expect(extent({ kind: "disc", x: 10, y: -20, radius: 5 })).toEqual({ left: 5, right: 15, top: -25, bottom: -15 });
    expect(extent({ kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: -30 }, width: 4 })).toEqual({
      left: -2,
      right: 12,
      top: -32,
      bottom: 2,
    });
    expect(
      extent({
        kind: "poly",
        points: [
          { x: 0, y: 0 },
          { x: 8, y: -30 },
          { x: 16, y: 0 },
        ],
      }),
    ).toEqual({ left: 0, right: 16, top: -30, bottom: 0 });
  });

  it("dans sa vue, un accessoire se dessine tel quel, devant ou derrière l'athlète", () => {
    expect(seenFrom(bench, "side")).toBe(bench.shape);
    expect(depthIn(bench, "side")).toBeLessThan(-1000);
    expect(depthIn({ ...bench, front: true }, "side")).toBeGreaterThan(1000);
  });

  it("dans une autre vue, il se montre par sa silhouette, à sa vraie profondeur", () => {
    // De face : large de son épaisseur, à la même hauteur ; sa profondeur est son milieu le long du corps.
    expect(seenFrom(bench, "front")).toMatchObject({ kind: "rect", x: -26, y: -64, width: 52, height: 14 });
    expect(depthIn(bench, "front")).toBe(10);
    // De dessus : sa longueur et son épaisseur ; sa profondeur est sa hauteur.
    expect(seenFrom(bench, "top")).toMatchObject({ kind: "rect", x: -40, y: -26, width: 100, height: 52 });
    expect(depthIn(bench, "top")).toBe(57);
  });

  it("un accessoire dessiné de face se retourne de même vers le profil", () => {
    const cone: Prop = {
      paint: "cone",
      shape: { kind: "rect", x: 30, y: -30, width: 20, height: 30 },
      native: "front",
      at: 5,
      half: 10,
    };
    expect(seenFrom(cone, "side")).toMatchObject({ kind: "rect", x: -5, y: -30, width: 20, height: 30 });
    // De face, x va vers la gauche du corps : l'accessoire est à sa gauche.
    expect(seenFrom(cone, "top")).toMatchObject({ kind: "rect", x: -5, y: -50, width: 20, height: 20 });
  });

  it("un trait reste un trait : couché, il traverse ; debout, il se voit par sa tranche", () => {
    const rail: Prop = {
      paint: "hurdle",
      shape: { kind: "line", from: { x: 0, y: -80 }, to: { x: 4, y: -80 }, width: 6 },
      native: "side",
      at: 0,
      half: 60,
    };
    expect(seenFrom(rail, "front")).toMatchObject({ kind: "rect", x: -60, y: -83, width: 120, height: 6 });
    const post: Prop = {
      paint: "iron",
      shape: { kind: "line", from: { x: 50, y: 0 }, to: { x: 50, y: -200 }, width: 8 },
      native: "side",
      at: 0,
      half: 6,
    };
    expect(seenFrom(post, "front")).toMatchObject({ kind: "rect", x: -4, y: -200, width: 8, height: 200 });
  });

  it("un ballon est rond sous tous les angles, un repère qui défile ne se montre que dans sa vue", () => {
    const ball: Prop = {
      paint: "ball",
      shape: { kind: "disc", x: 40, y: -120, radius: 27 },
      native: "side",
      at: 0,
      half: 27,
    };
    expect(seenFrom(ball, "front")).toEqual({ kind: "disc", x: 0, y: -120, radius: 27 });
    const mark: Prop = {
      paint: "lane",
      shape: { kind: "rect", x: 0, y: 2, width: 30, height: 8 },
      native: "side",
      at: 0,
      half: 30,
      scroll: true,
    };
    expect(seenFrom(mark, "side")).toBe(mark.shape);
    expect(seenFrom(mark, "front")).toBeNull();
  });
});
