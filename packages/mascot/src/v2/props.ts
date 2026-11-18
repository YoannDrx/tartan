// Le matériel d'un geste : un banc, une boîte, des marches, un haltère. Chaque accessoire est une forme plate,
// dessinée dans le plan d'une vue, puis épaissie de part et d'autre de ce plan. Dans sa vue d'origine, il se
// dessine tel quel ; dans les autres, par sa silhouette : un rectangle.
import type { GearRole } from "../exercise";
import type { Geometry } from "../props";
import type { GestureView } from "./project";

export type Prop = {
  paint: GearRole;
  // La forme, dans le plan de sa vue d'origine : x vers la droite de l'image, y vers le bas, le sol à y = 0.
  shape: Geometry;
  native: GestureView;
  // Sa place et sa demi-épaisseur le long de l'axe du regard de cette vue.
  at: number;
  half: number;
  // Dessiné devant l'athlète dans sa vue d'origine. Sinon derrière lui.
  front?: boolean;
  // Un repère qui défile au sol : il ne compte pas dans le cadrage et ne se montre que dans sa vue d'origine.
  scroll?: boolean;
};

export type Extent = { left: number; right: number; top: number; bottom: number };

export const extent = (shape: Geometry): Extent => {
  const points: { x: number; y: number; pad: number }[] =
    shape.kind === "line"
      ? [shape.from, shape.to].map((point) => ({ ...point, pad: shape.width / 2 }))
      : shape.kind === "curve"
        ? [shape.from, shape.control, shape.to].map((point) => ({ ...point, pad: shape.width / 2 }))
        : shape.kind === "poly"
          ? shape.points.map((point) => ({ ...point, pad: 0 }))
          : shape.kind === "disc"
            ? [{ x: shape.x, y: shape.y, pad: shape.radius }]
            : [
                { x: shape.x, y: shape.y, pad: 0 },
                { x: shape.x + shape.width, y: shape.y + shape.height, pad: 0 },
              ];
  return {
    left: Math.min(...points.map((point) => point.x - point.pad)),
    right: Math.max(...points.map((point) => point.x + point.pad)),
    top: Math.min(...points.map((point) => point.y - point.pad)),
    bottom: Math.max(...points.map((point) => point.y + point.pad)),
  };
};

// La boîte qui contient l'accessoire, dans le repère du corps : x vers l'avant, y vers le haut, z vers la droite.
const box = (prop: Prop) => {
  const { left, right, top, bottom } = extent(prop.shape);
  const thick: [number, number] = [prop.at - prop.half, prop.at + prop.half];
  return prop.native === "side"
    ? { x: [left, right], y: [-bottom, -top], z: thick }
    : prop.native === "front"
      ? { x: thick, y: [-bottom, -top], z: [-right, -left] }
      : { x: [left, right], y: thick, z: [top, bottom] };
};

// Ce qu'on voit de l'accessoire dans une vue : sa forme dans la sienne, sa silhouette dans les autres.
export const seenFrom = (prop: Prop, view: GestureView): Geometry | null => {
  if (view === prop.native) return prop.shape;
  if (prop.scroll) return null;
  // Un trait (une latte de haie, un montant, un élastique) reste un trait : vu en travers s'il est couché, par sa
  // tranche s'il est debout.
  if (prop.shape.kind === "line") {
    const { from, to, width } = prop.shape;
    const [left, top] = [Math.min(from.x, to.x), Math.min(from.y, to.y)];
    const [long, tall] = [Math.abs(to.x - from.x), Math.abs(to.y - from.y)];
    const slim: Prop =
      long > 2 * tall
        ? { ...prop, shape: { kind: "rect", x: left, y: (from.y + to.y) / 2 - width / 2, width: long, height: width } }
        : { ...prop, half: width / 2, shape: { kind: "rect", x: left, y: top, width: long, height: tall } };
    return seenFrom(slim, view);
  }
  const { x, y, z } = box(prop);
  const [across, down] =
    view === "side"
      ? [x, [-y[1]!, -y[0]!]]
      : view === "front"
        ? [
            [-z[1]!, -z[0]!],
            [-y[1]!, -y[0]!],
          ]
        : [x, z];
  // Un ballon est rond sous tous les angles.
  if (prop.shape.kind === "disc" && prop.paint === "ball")
    return { kind: "disc", x: (across[0]! + across[1]!) / 2, y: (down[0]! + down[1]!) / 2, radius: prop.shape.radius };
  const [width, height] = [across[1]! - across[0]!, down[1]! - down[0]!];
  return { kind: "rect", x: across[0]!, y: down[0]!, width, height, radius: Math.min(3, width / 2, height / 2) };
};

// Sa profondeur dans une vue : dans la sienne, devant ou derrière l'athlète ; ailleurs, là où il est vraiment.
export const depthIn = (prop: Prop, view: GestureView): number => {
  if (view === prop.native) return prop.front ? 1e5 : -1e5;
  const { x, y, z } = box(prop);
  const along = view === "side" ? z : view === "front" ? x : y;
  return (along[0]! + along[1]!) / 2;
};
