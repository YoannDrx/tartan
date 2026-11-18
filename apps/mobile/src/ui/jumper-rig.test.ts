import { describe, expect, it } from "vitest";
import { jumperFigure } from "./jumper-rig";

// Des noms de rôle à la place des couleurs : le test ne dépend pas du thème.
const PAINT = { skin: "skin", tee: "tee", shorts: "shorts", shoe: "shoe", hair: "hair", eye: "eye" };
const colorsOf = (figure: ReturnType<typeof jumperFigure>) =>
  figure.bones.flatMap((bone) => bone.shapes.map((shape) => (shape.tag === "line" ? shape.stroke : shape.fill)));

describe("jumperFigure", () => {
  it("dessine le corps du groupe, à l'échelle des anciennes scènes, avec les couleurs demandées", () => {
    const figure = jumperFigure("stand", PAINT);
    expect(figure.root).toMatch(/^translate\(0 [\d.]+\) scale\(0\.8\d*\)$/);
    expect(new Set(colorsOf(figure))).toEqual(new Set(Object.values(PAINT)));
    // Un aplat par partie du corps, la tête en dessin à plat, et aucun dossard.
    const ids = figure.bones.map((bone) => bone.id as string);
    expect(ids).toContain("head");
    expect(ids).not.toContain("bib");
    for (const bone of figure.bones)
      for (const shape of bone.shapes) expect(JSON.stringify(shape)).not.toMatch(/NaN|undefined/);
  });

  it("change de tracé avec la pose", () => {
    const [stand, cheer] = [jumperFigure("stand", PAINT), jumperFigure("cheer", PAINT)];
    const pathsOf = (figure: ReturnType<typeof jumperFigure>) =>
      figure.bones.flatMap((bone) => bone.shapes.map((shape) => (shape.tag === "path" ? shape.d : "")));
    expect(pathsOf(stand)).not.toEqual(pathsOf(cheer));
  });
});
