import { describe, expect, it } from "vitest";
import { BODY } from "./skeleton";
import { svgShape } from "./svg";

describe("rendu SVG", () => {
  it("donne à chaque forme ses attributs, avec la couleur de son rôle", () => {
    expect(svgShape({ kind: "limb", length: BODY.shin, width: 30, paint: "skin" }, "skin")).toEqual({
      tag: "line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: BODY.shin,
      stroke: "skin",
      strokeWidth: 30,
      strokeLinecap: "round",
    });
    expect(
      svgShape({ kind: "box", x: -18, y: BODY.shin - 8, width: 66, height: 30, radius: 15, paint: "shoe" }, "shoe"),
    ).toEqual({ tag: "rect", x: -18, y: BODY.shin - 8, width: 66, height: 30, rx: 15, fill: "shoe" });
    expect(svgShape({ kind: "disc", x: 0, y: 0, radius: 44, paint: "skin" }, "skin")).toEqual({
      tag: "circle",
      cx: 0,
      cy: 0,
      r: 44,
      fill: "skin",
    });
    expect(svgShape({ kind: "cap", radius: 44, chord: { x: 43, y: -10 }, paint: "hair" }, "hair")).toEqual({
      tag: "path",
      d: "M -43 -10 A 44 44 0 0 1 43 -10 Z",
      fill: "hair",
    });
  });

  it("trace un trait entre deux points et une part de disque fermée par sa corde", () => {
    expect(
      svgShape({ kind: "stroke", from: { x: 9, y: 2 }, to: { x: 20, y: 8 }, width: 5, paint: "eye" }, "ink"),
    ).toEqual({
      tag: "line",
      x1: 9,
      y1: 2,
      x2: 20,
      y2: 8,
      stroke: "ink",
      strokeWidth: 5,
      strokeLinecap: "round",
    });
    // La moitié basse d'un disque : de la droite à la gauche, en passant par le bas.
    expect(svgShape({ kind: "segment", x: 24, y: 19, radius: 11, from: 0, to: 180, paint: "eye" }, "ink")).toEqual({
      tag: "path",
      d: "M 35 19 A 11 11 0 0 1 13 19 Z",
      fill: "ink",
    });
    // Au-delà d'un demi-tour, l'arc prend le grand côté.
    expect(svgShape({ kind: "segment", x: 0, y: 0, radius: 10, from: 0, to: 270, paint: "eye" }, "ink")).toMatchObject({
      d: "M 10 0 A 10 10 0 1 1 0 -10 Z",
    });
  });
});
