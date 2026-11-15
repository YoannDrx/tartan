import { describe, expect, it } from "vitest";
import { clampPoint, drawingAngle, drawingPoints } from "./video-drawing";

describe("tracés sur vidéo", () => {
  it("demande trois points pour un angle et deux pour les autres tracés", () => {
    expect(drawingPoints("angle")).toBe(3);
    expect(drawingPoints("line")).toBe(2);
    expect(drawingPoints("circle")).toBe(2);
  });

  it("mesure l'angle au sommet dans les proportions de l'image", () => {
    const square = [{ x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }];
    expect(drawingAngle(square, 1)).toBe(90);
    // Sur une image en portrait (9:16), les mêmes coordonnées relatives ne font plus un angle droit…
    const portrait = [{ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.3 }];
    expect(drawingAngle(portrait, 9 / 16)).toBe(Math.round((Math.atan2(0.3 * (9 / 16), 0.2) * 180) / Math.PI));
    // … et un alignement reste plat quelle que soit l'image.
    expect(drawingAngle([{ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }], 16 / 9)).toBe(180);
  });

  it("refuse un angle sans longueur ou incomplet", () => {
    expect(drawingAngle([{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }], 1)).toBeNull();
    expect(drawingAngle([{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }], 1)).toBeNull();
  });

  it("ramène un point posé hors de l'image sur son bord", () => {
    expect(clampPoint({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });
});
