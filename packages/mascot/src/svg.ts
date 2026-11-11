// Le rendu SVG, sans bibliothèque : des attributs prêts à poser, que React sur le web et react-native-svg sur mobile habillent.
import { chain, STACK, type Bone, type BoneId, type Paint, type Point, type Pose, type Shape } from "./skeleton";

const round = (value: number) => Math.round(value * 100) / 100;

// Le corps entier : sa position dans la scène si elle est donnée, puis son orientation.
export const rootTransform = (pose: Pose, at?: Point) =>
  `${at ? `translate(${round(at.x)} ${round(at.y)}) ` : ""}rotate(${round(pose.rot)}) scale(${round(pose.flip * pose.sx)} ${round(pose.sy)})`;

// Un os : tout son chemin depuis le bassin. Les os se dessinent à plat, dans l'ordre d'empilement.
export const boneTransform = (bone: Bone, pose: Pose) =>
  chain(bone, pose)
    .map((step) => ("move" in step ? `translate(${step.move.x} ${step.move.y})` : `rotate(${round(step.turn)})`))
    .join(" ");

export type SvgShape =
  | {
      tag: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
      strokeLinecap: "round";
    }
  | { tag: "rect"; x: number; y: number; width: number; height: number; rx: number; fill: string }
  | { tag: "circle"; cx: number; cy: number; r: number; fill: string }
  | { tag: "path"; d: string; fill: string };

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
  }
};

export type SvgBone = { id: BoneId; transform: string; shapes: SvgShape[] };

// Le personnage complet : la transformation du corps, puis chaque os du fond vers le devant.
export const svgFigure = (pose: Pose, paint: Paint, at?: Point): { root: string; bones: SvgBone[] } => ({
  root: rootTransform(pose, at),
  bones: STACK.map((bone) => ({
    id: bone.id,
    transform: boneTransform(bone, pose),
    shapes: bone.shapes.map((shape) => svgShape(shape, paint[shape.paint])),
  })),
});
