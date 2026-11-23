import { describe, expect, it } from "vitest";
import { ANIMAL_IDS, ANIMAL_SHAPES, shapeTransform } from "./animals";

// Les dessins des animaux, partagés par le web et l'app native.
describe("les animaux de Tartan", () => {
  it("chaque animal a son dessin, avec des yeux à l'encre", () => {
    expect(Object.keys(ANIMAL_SHAPES).sort()).toEqual([...ANIMAL_IDS].sort());
    for (const id of ANIMAL_IDS) {
      expect(ANIMAL_SHAPES[id].length).toBeGreaterThan(5);
      expect(ANIMAL_SHAPES[id].some((shape) => shape.tone === "eye")).toBe(true);
    }
  });

  it("une rotation garde son pivot d'origine", () => {
    const [ear] = ANIMAL_SHAPES.dog.filter((shape) => shape.tag === "ellipse" && shape.rotate);
    expect(shapeTransform(ear!)).toBe("rotate(14 25 52)");
    const stripes = ANIMAL_SHAPES.cat.filter((shape) => shape.tag === "rect" && shape.rotate).map(shapeTransform);
    expect(stripes).toEqual(["rotate(-18 40 37)", "rotate(18 60 37)"]);
    expect(shapeTransform(ANIMAL_SHAPES.fox[0]!)).toBeUndefined();
  });
});
