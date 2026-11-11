import { describe, expect, it } from "vitest";
import { POSES } from "./poses";
import { BODY, SKELETON, type Paint } from "./skeleton";
import { boneTransform, rootTransform, svgFigure } from "./svg";

// Des noms de rôle à la place des couleurs : les vraies viennent des jetons de design, chez l'hôte.
const PAINT: Paint = { skin: "skin", tee: "tee", shorts: "shorts", shoe: "shoe", hair: "hair", eye: "eye" };
const bone = (id: string) => SKELETON.find((item) => item.id === id)!;

describe("rendu SVG", () => {
  it("oriente le corps, et le place quand la scène le demande", () => {
    expect(rootTransform(POSES.cheer)).toBe("rotate(0) scale(1 1)");
    expect(rootTransform(POSES.apex)).toBe("rotate(94) scale(-1 1)");
    expect(rootTransform(POSES.apex, { x: 947.5, y: 105.004 })).toBe("translate(947.5 105) rotate(94) scale(-1 1)");
  });

  it("écrit le chemin de chaque os depuis le bassin", () => {
    const pose = POSES.cheer;
    expect(boneTransform(bone("torso"), pose)).toBe("rotate(-2)");
    expect(boneTransform(bone("head"), pose)).toBe(`rotate(-2) translate(0 ${-BODY.neck}) rotate(-10)`);
    expect(boneTransform(bone("eyes"), pose)).toBe(boneTransform(bone("head"), pose));
    expect(boneTransform(bone("upperArmA"), pose)).toBe(`rotate(-2) translate(0 ${-BODY.shoulder}) rotate(-122)`);
    expect(boneTransform(bone("forearmB"), pose)).toBe(
      `rotate(-2) translate(0 ${-BODY.shoulder}) rotate(122) translate(0 ${BODY.arm}) rotate(8)`,
    );
    expect(boneTransform(bone("thighA"), pose)).toBe("rotate(-7)");
    expect(boneTransform(bone("shinA"), pose)).toBe(`rotate(-7) translate(0 ${BODY.thigh}) rotate(3)`);
  });

  it("décrit le personnage du fond vers le devant, avec ses couleurs", () => {
    const figure = svgFigure(POSES.stand, PAINT);
    expect(figure.root).toBe("rotate(0) scale(1 1)");
    expect(figure.bones.map((item) => item.id)).toEqual([
      "thighB",
      "shinB",
      "upperArmB",
      "forearmB",
      "thighA",
      "shinA",
      "torso",
      "head",
      "eyes",
      "upperArmA",
      "forearmA",
    ]);
    expect(figure.bones[1]!.shapes).toEqual([
      { tag: "line", x1: 0, y1: 0, x2: 0, y2: BODY.shin, stroke: "skin", strokeWidth: 30, strokeLinecap: "round" },
      { tag: "rect", x: -18, y: BODY.shin - 8, width: 66, height: 30, rx: 15, fill: "shoe" },
    ]);
    expect(figure.bones[7]!.shapes).toEqual([
      { tag: "circle", cx: 0, cy: 0, r: 44, fill: "skin" },
      { tag: "path", d: "M -43 -10 A 44 44 0 0 1 43 -10 Z", fill: "hair" },
    ]);
  });
});
