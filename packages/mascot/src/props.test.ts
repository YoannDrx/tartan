import { describe, expect, it } from "vitest";
import { drawProp, svgProp, type PropCanvas, type PropShape } from "./props";

const recorder = () => {
  const calls: string[] = [];
  const note =
    (name: string) =>
    (...args: number[]) => {
      calls.push(`${name}(${args.map((value) => Math.round(value * 100) / 100).join(",")})`);
    };
  const ctx: PropCanvas = {
    beginPath: note("begin"),
    moveTo: note("move"),
    lineTo: note("line"),
    quadraticCurveTo: note("curve"),
    arc: note("arc"),
    closePath: note("close"),
    fill: note("fill"),
    stroke: note("stroke"),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
  };
  return { ctx, calls };
};

const LINE: PropShape = { kind: "line", from: { x: 0, y: 10 }, to: { x: 30.004, y: 10 }, width: 5, paint: "lane" };
const POLE: PropShape = {
  kind: "curve",
  from: { x: 0, y: 100 },
  control: { x: 40, y: 20 },
  to: { x: -10, y: 0 },
  width: 9,
  paint: "pole",
};

describe("les accessoires en SVG", () => {
  it("trace un trait, à bouts ronds sauf demande contraire", () => {
    expect(svgProp(LINE, "white")).toEqual({
      tag: "line",
      x1: 0,
      y1: 10,
      x2: 30,
      y2: 10,
      stroke: "white",
      strokeWidth: 5,
      strokeLinecap: "round",
    });
    expect(svgProp({ ...LINE, cap: "butt" }, "white")).toMatchObject({ strokeLinecap: "butt" });
  });

  it("pose un pavé, un disque et la perche qui fléchit", () => {
    expect(svgProp({ kind: "rect", x: 1, y: 2, width: 30, height: 10, paint: "mat" }, "sun")).toEqual({
      tag: "rect",
      x: 1,
      y: 2,
      width: 30,
      height: 10,
      rx: 0,
      fill: "sun",
    });
    expect(svgProp({ kind: "disc", x: 5, y: 6, radius: 7, paint: "discus" }, "sun")).toEqual({
      tag: "circle",
      cx: 5,
      cy: 6,
      r: 7,
      fill: "sun",
    });
    expect(svgProp(POLE, "lime")).toEqual({
      tag: "path",
      d: "M 0 100 Q 40 20 -10 0",
      fill: "none",
      stroke: "lime",
      strokeWidth: 9,
      strokeLinecap: "round",
    });
  });
});

describe("les accessoires en canvas", () => {
  it("trace les traits et la courbe sans les remplir", () => {
    const line = recorder();
    drawProp(line.ctx, { ...LINE, cap: "butt" }, "white");
    expect(line.calls).toEqual(["begin()", "move(0,10)", "line(30,10)", "stroke()"]);
    expect(line.ctx).toMatchObject({ lineWidth: 5, lineCap: "butt", strokeStyle: "white" });

    const pole = recorder();
    drawProp(pole.ctx, POLE, "lime");
    expect(pole.calls).toEqual(["begin()", "move(0,100)", "curve(40,20,-10,0)", "stroke()"]);
    expect(pole.ctx.lineCap).toBe("round");
  });

  it("remplit le disque et le pavé, coins ronds bornés par sa taille", () => {
    const disc = recorder();
    drawProp(disc.ctx, { kind: "disc", x: 5, y: 6, radius: 7, paint: "discus" }, "sun");
    expect(disc.calls).toEqual(["begin()", "arc(5,6,7,0,6.28)", "close()", "fill()"]);

    const box = recorder();
    drawProp(box.ctx, { kind: "rect", x: 0, y: 0, width: 40, height: 10, radius: 30, paint: "sand" }, "sand");
    expect(box.calls.filter((call) => call.startsWith("arc"))).toEqual([
      "arc(35,5,5,-1.57,0)",
      "arc(35,5,5,0,1.57)",
      "arc(5,5,5,1.57,3.14)",
      "arc(5,5,5,3.14,4.71)",
    ]);
    expect(box.ctx.fillStyle).toBe("sand");
  });
});
