import { BODY } from "@tartan/mascot/skeleton";
import { describe, expect, it } from "vitest";
import { jumperFigure } from "./jumper-rig";

// Des noms de rôle à la place des couleurs : le test ne dépend pas du thème.
const PAINT = { skin: "skin", tee: "tee", shorts: "shorts", shoe: "shoe", hair: "hair", eye: "eye" };
const transformOf = (figure: ReturnType<typeof jumperFigure>, id: string) =>
  figure.bones.find((bone) => bone.id === id)?.transform;

describe("jumperFigure", () => {
  it("applique le squelette partagé à la pose de joie", () => {
    const figure = jumperFigure("cheer", PAINT);
    expect(figure.root).toBe("rotate(0) scale(1 1)");
    expect(transformOf(figure, "torso")).toBe("rotate(-2)");
    expect(transformOf(figure, "head")).toBe(`rotate(-2) translate(0 ${-BODY.neck}) rotate(-10)`);
    expect(transformOf(figure, "upperArmA")).toBe(`rotate(-2) translate(0 ${-BODY.shoulder}) rotate(-122)`);
    expect(transformOf(figure, "forearmA")).toBe(
      `rotate(-2) translate(0 ${-BODY.shoulder}) rotate(-122) translate(0 ${BODY.arm}) rotate(-8)`,
    );
    expect(transformOf(figure, "upperArmB")).toBe(`rotate(-2) translate(0 ${-BODY.shoulder}) rotate(122)`);
    expect(transformOf(figure, "forearmB")).toBe(
      `rotate(-2) translate(0 ${-BODY.shoulder}) rotate(122) translate(0 ${BODY.arm}) rotate(8)`,
    );
    expect(transformOf(figure, "thighA")).toBe("rotate(-7)");
    expect(transformOf(figure, "shinA")).toBe(`rotate(-7) translate(0 ${BODY.thigh}) rotate(3)`);
  });

  it("retourne le corps quand la pose l'indique", () => {
    expect(jumperFigure("apex", PAINT).root).toBe("rotate(94) scale(-1 1)");
  });

  it("dessine le côté B derrière le corps, le côté A devant, avec les couleurs demandées", () => {
    const figure = jumperFigure("stand", PAINT);
    expect(figure.bones.map((bone) => bone.id)).toEqual([
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
    const colors = figure.bones.flatMap((bone) =>
      bone.shapes.map((shape) => (shape.tag === "line" ? shape.stroke : shape.fill)),
    );
    expect(new Set(colors)).toEqual(new Set(Object.values(PAINT)));
  });
});
