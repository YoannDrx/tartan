// Le rendu SVG, sans bibliothèque : des attributs prêts à poser, que React sur le web et react-native-svg sur mobile habillent.
import type { BoneId, Shape } from "./skeleton";

const round = (value: number) => Math.round(value * 100) / 100;

export type SvgShape =
  | {
      tag: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
      strokeLinecap: "round" | "butt";
    }
  | { tag: "rect"; x: number; y: number; width: number; height: number; rx: number; fill: string }
  | { tag: "circle"; cx: number; cy: number; r: number; fill: string }
  // Un tracé plein (calotte, part de disque) ou, pour un accessoire, un trait courbe.
  | { tag: "path"; d: string; fill: string; stroke?: string; strokeWidth?: number; strokeLinecap?: "round" };

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export const svgShape = (shape: Shape, color: string): SvgShape => {
  switch (shape.kind) {
    case "limb":
      return {
        tag: "line",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: shape.length,
        stroke: color,
        strokeWidth: shape.width,
        strokeLinecap: "round",
      };
    case "box":
      return {
        tag: "rect",
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        rx: shape.radius,
        fill: color,
      };
    case "disc":
      return { tag: "circle", cx: shape.x, cy: shape.y, r: shape.radius, fill: color };
    case "cap": {
      const { radius, chord } = shape;
      return {
        tag: "path",
        d: `M ${-chord.x} ${chord.y} A ${radius} ${radius} 0 0 1 ${chord.x} ${chord.y} Z`,
        fill: color,
      };
    }
    case "stroke":
      return {
        tag: "line",
        x1: shape.from.x,
        y1: shape.from.y,
        x2: shape.to.x,
        y2: shape.to.y,
        stroke: color,
        strokeWidth: shape.width,
        strokeLinecap: "round",
      };
    case "segment": {
      const { x, y, radius } = shape;
      const at = (angle: number) =>
        `${round(x + radius * Math.cos(radians(angle)))} ${round(y + radius * Math.sin(radians(angle)))}`;
      const large = shape.to - shape.from > 180 ? 1 : 0;
      return {
        tag: "path",
        d: `M ${at(shape.from)} A ${radius} ${radius} 0 ${large} 1 ${at(shape.to)} Z`,
        fill: color,
      };
    }
  }
};

// Une figure prête à poser : la transformation du corps, puis ses parties du fond vers le devant. Le corps du
// moteur des gestes la remplit (v2/pose-figure.ts).
export type SvgBone = { id: BoneId; transform: string; shapes: SvgShape[] };

export type SvgFigure = { root: string; bones: SvgBone[] };
