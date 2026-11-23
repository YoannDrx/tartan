import { describe, expect, it } from "vitest";
import { drawShape, type MascotCanvas } from "./canvas";
import { rig } from "./rig";
import { BODY } from "./skeleton";

type Matrix = [number, number, number, number, number, number];
const then = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

// Un contexte témoin : il suit la matrice courante et note chaque tracé, à la manière d'un vrai canvas.
const recorder = () => {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const point = (x: number, y: number) => ({
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  });
  let path: Array<{ x: number; y: number }> = [];
  const drawn: Array<{ op: "fill" | "stroke"; color: unknown; width?: number; path: Array<{ x: number; y: number }> }> =
    [];
  const ctx: MascotCanvas & { depth: number } = {
    depth: 0,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    save() {
      stack.push(matrix);
      ctx.depth += 1;
    },
    restore() {
      matrix = stack.pop()!;
      ctx.depth -= 1;
    },
    translate: (x, y) => void (matrix = then(matrix, [1, 0, 0, 1, x, y])),
    rotate: (a) => void (matrix = then(matrix, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])),
    scale: (x, y) => void (matrix = then(matrix, [x, 0, 0, y, 0, 0])),
    beginPath: () => void (path = []),
    moveTo: (x, y) => void path.push(point(x, y)),
    lineTo: (x, y) => void path.push(point(x, y)),
    arc: (x, y, radius, start, end) => {
      path.push(point(x + radius * Math.cos(start), y + radius * Math.sin(start)));
      path.push(point(x + radius * Math.cos(end), y + radius * Math.sin(end)));
    },
    closePath: () => undefined,
    fill: () => void drawn.push({ op: "fill", color: ctx.fillStyle, path }),
    stroke: () => void drawn.push({ op: "stroke", color: ctx.strokeStyle, width: ctx.lineWidth, path }),
  };
  return { ctx, drawn };
};

describe("rendu canvas", () => {
  it("trace un membre d'un trait rond", () => {
    const { ctx, drawn } = recorder();
    drawShape(ctx, { kind: "limb", length: BODY.shin, width: 30, paint: "skin" }, "skin");
    expect(drawn).toEqual([
      {
        op: "stroke",
        color: "skin",
        width: 30,
        path: [
          { x: 0, y: 0 },
          { x: 0, y: BODY.shin },
        ],
      },
    ]);
    expect(ctx.lineCap).toBe("round");
  });

  it("ferme la calotte des cheveux sur sa corde", () => {
    const { ctx, drawn } = recorder();
    drawShape(ctx, { kind: "cap", radius: 44, chord: { x: 43, y: -10 }, paint: "hair" }, "hair");
    const [from, to] = drawn[0]!.path;
    expect(drawn[0]!.op).toBe("fill");
    expect(from!.x).toBeCloseTo(-43, 9);
    expect(to!.x).toBeCloseTo(43, 9);
    expect(from!.y).toBeCloseTo(-10, 9);
    expect(to!.y).toBeCloseTo(-10, 9);
  });

  it("ferme la bouche ouverte sur sa corde et trace les yeux plissés d'un point à l'autre", () => {
    const { ctx, drawn } = recorder();
    const eyes = rig({ hair: "crop", face: "joy", bib: null }).find((bone) => bone.id === "eyes")!;
    for (const shape of eyes.shapes) drawShape(ctx, shape, shape.paint);
    // Quatre traits pour les deux yeux en chevrons, puis la bouche : une demi-lune sous sa corde.
    expect(drawn.filter((item) => item.op === "stroke")).toHaveLength(4);
    const [from, to] = drawn.find((item) => item.op === "fill")!.path;
    expect(from!.x).toBeCloseTo(24 + 11, 9);
    expect(to!.x).toBeCloseTo(24 - 11, 9);
    expect(from!.y).toBeCloseTo(19, 9);
    expect(to!.y).toBeCloseTo(from!.y, 9);
  });
});
