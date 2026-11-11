import { describe, expect, it } from "vitest";
import { drawMascot, type MascotCanvas } from "./canvas";
import { POSES } from "./poses";
import { rig } from "./rig";
import { BODY, jointPositions, STACK, type Paint } from "./skeleton";

const PAINT: Paint = { skin: "skin", tee: "tee", shorts: "shorts", shoe: "shoe", hair: "hair", eye: "eye" };

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
  it("dessine chaque forme de la table, du fond vers le devant, et rend le contexte comme il l'a reçu", () => {
    const { ctx, drawn } = recorder();
    drawMascot(ctx, POSES.run, { paint: PAINT });
    expect(ctx.depth).toBe(0);
    expect(drawn.map((item) => item.color)).toEqual(
      STACK.flatMap((bone) => bone.shapes.map((shape) => PAINT[shape.paint as keyof Paint])),
    );
    expect(drawn.filter((item) => item.op === "stroke")).toHaveLength(10);
    expect(ctx.lineCap).toBe("round");
  });

  it("pose le bout de chaque membre là où la cinématique le place", () => {
    for (const pose of Object.values(POSES)) {
      const { ctx, drawn } = recorder();
      const at = { x: 320, y: 180 };
      drawMascot(ctx, pose, { paint: PAINT, at });
      const joints = jointPositions(pose, at);
      // Les traits de peau, dans l'ordre d'empilement : cuisse, tibia, bras et avant-bras B, puis le côté A.
      const limbs = drawn.filter((item) => item.op === "stroke" && item.color === "skin");
      const ends = { footB: limbs[1], handB: limbs[3], footA: limbs[5], handA: limbs[7] } as const;
      for (const [joint, limb] of Object.entries(ends)) {
        const end = limb!.path[1]!;
        expect(end.x).toBeCloseTo(joints[joint as keyof typeof ends].x, 9);
        expect(end.y).toBeCloseTo(joints[joint as keyof typeof ends].y, 9);
      }
    }
  });

  it("agrandit le personnage sans changer sa pose", () => {
    const { ctx, drawn } = recorder();
    drawMascot(ctx, { ...POSES.stand, legA: 0, kneeA: 0 }, { paint: PAINT, scale: 2 });
    const shin = drawn.filter((item) => item.op === "stroke" && item.color === "skin")[5]!;
    expect(shin.width).toBe(30);
    expect(shin.path[1]!.y).toBeCloseTo(2 * (BODY.thigh + BODY.shin), 9);
  });

  it("ferme la calotte des cheveux sur sa corde", () => {
    const { ctx, drawn } = recorder();
    drawMascot(ctx, { ...POSES.stand, lean: 0 }, { paint: PAINT });
    const [from, to] = drawn.find((item) => item.color === "hair")!.path;
    expect(from!.x).toBeCloseTo(-43, 9);
    expect(to!.x).toBeCloseTo(43, 9);
    expect(from!.y).toBeCloseTo(-BODY.neck - 10, 9);
    expect(to!.y).toBeCloseTo(-BODY.neck - 10, 9);
  });

  it("dessine un athlète du groupe avec ses propres os, et remet son dossard à l'endroit", () => {
    const bones = rig({ hair: "ponytail", face: "joy", bib: 3 });
    const paint = { ...PAINT, bib: "bib", mark: "mark" };
    const shapes = bones.flatMap((bone) => bone.shapes);
    for (const flip of [1, -1]) {
      const { ctx, drawn } = recorder();
      drawMascot(ctx, { ...POSES.stand, lean: 0, flip }, { paint, bones });
      expect(ctx.depth).toBe(0);
      expect(drawn.map((item) => item.color)).toEqual(shapes.map((shape) => shape.paint));
      // Le 3 a ses barres à gauche de sa hampe, que le corps soit de face ou retourné.
      const marks = drawn.filter((item) => item.color === "mark").flatMap((item) => item.path.map((point) => point.x));
      const spine = Math.max(...marks);
      expect(marks.filter((x) => Math.abs(x - spine) < 1e-9).length).toBeGreaterThan(marks.length / 2 - 1);
      expect(Math.min(...marks)).toBeLessThan(spine);
    }
  });

  it("ferme la bouche ouverte sur sa corde et trace les yeux plissés d'un point à l'autre", () => {
    const { ctx, drawn } = recorder();
    const bones = rig({ hair: "crop", face: "joy", bib: null });
    drawMascot(ctx, { ...POSES.stand, lean: 0, head: 0 }, { paint: { ...PAINT, bib: "bib", mark: "mark" }, bones });
    const eyes = drawn.filter((item) => item.color === "eye");
    // Quatre traits pour les deux yeux en chevrons, puis la bouche : une demi-lune sous sa corde.
    expect(eyes.filter((item) => item.op === "stroke")).toHaveLength(4);
    const [from, to] = eyes.find((item) => item.op === "fill")!.path;
    expect(from!.x).toBeCloseTo(24 + 11, 9);
    expect(to!.x).toBeCloseTo(24 - 11, 9);
    expect(from!.y).toBeCloseTo(-BODY.neck + 19, 9);
    expect(to!.y).toBeCloseTo(from!.y, 9);
  });
});
