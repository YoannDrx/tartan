// Le rendu SVG, sans bibliothèque : des attributs prêts à poser, que React sur le web et react-native-svg sur mobile habillent.
import {
  chain,
  STACK,
  type AthletePaint,
  type Bone,
  type BoneId,
  type Paint,
  type Point,
  type Pose,
  type Shape,
} from "./skeleton";

const round = (value: number) => Math.round(value * 100) / 100;

// Le corps entier : sa position dans la scène si elle est donnée, puis son orientation.
export const rootTransform = (pose: Pose, at?: Point) =>
  `${at ? `translate(${round(at.x)} ${round(at.y)}) ` : ""}rotate(${round(pose.rot)}) scale(${round(pose.flip * pose.sx)} ${round(pose.sy)})`;

// Un os : tout son chemin depuis le bassin. Les os se dessinent à plat, dans l'ordre d'empilement.
export const boneTransform = (bone: Bone, pose: Pose, among?: ReadonlyMap<BoneId, Bone>) =>
  chain(bone, pose, among)
    .map((step) =>
      "move" in step
        ? `translate(${step.move.x} ${step.move.y})`
        : "turn" in step
          ? `rotate(${round(step.turn)})`
          : "scale(-1 1)",
    )
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

export type SvgBone = { id: BoneId; transform: string; shapes: SvgShape[] };

export type SvgFigure = { root: string; bones: SvgBone[] };

const figure = (bones: readonly Bone[], pose: Pose, paint: Partial<AthletePaint>, at?: Point): SvgFigure => {
  const among = new Map(bones.map((bone) => [bone.id, bone]));
  return {
    root: rootTransform(pose, at),
    bones: bones.map((bone) => ({
      id: bone.id,
      transform: boneTransform(bone, pose, among),
      shapes: bone.shapes.map((shape) => svgShape(shape, paint[shape.paint]!)),
    })),
  };
};

// Le personnage complet : la transformation du corps, puis chaque os du fond vers le devant.
export const svgFigure = (pose: Pose, paint: Paint, at?: Point): SvgFigure => figure(STACK, pose, paint, at);

// Un athlète du groupe : ses propres os (rig.ts), déjà triés du fond vers le devant, et son dossard à colorer.
export const svgAthlete = (bones: readonly Bone[], pose: Pose, paint: AthletePaint, at?: Point): SvgFigure =>
  figure(bones, pose, paint, at);
