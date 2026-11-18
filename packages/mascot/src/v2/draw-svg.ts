// Le rendu SVG d'une image : chaque partie du corps devient un tracé plein, du fond vers le devant.
// Rien ici ne dépend de React ni du navigateur : des nœuds prêts à poser, qu'un lecteur met à jour (player.ts)
// ou qu'un script écrit en texte.
import { ATHLETES } from "../athletes";
import { svgProp, type Geometry } from "../props";
import { rig, type Face, type Hair } from "../rig";
import type { Shape } from "../skeleton";
import { svgShape } from "../svg";
import { FIGURE } from "./body";
import type { MotionClip } from "./gesture";
import { project, type GestureView } from "./project";
import { depthIn, extent, seenFrom, type Extent, type Prop } from "./props";
import { skin, type Anchor, type SkinPaint } from "./skin";
import type { Solved } from "./solve";

export type Look = { hair: Hair; bib: number | null; face: Face };
export type ScenePaint = Record<SkinPaint, string>;

export type DrawNode =
  // Un aplat : son tracé change à chaque image.
  | { id: string; kind: "path"; paint: SkinPaint; d: string }
  // Un dessin à plat (la tête, le dossard) : seul son placement change. `content` nomme ce qu'il contient :
  // tant qu'il ne change pas, un lecteur garde les formes déjà posées.
  | { id: string; kind: "group"; transform: string; content: string; shapes: readonly Shape[] }
  // Un accessoire : une forme simple, dans le repère de l'image.
  | { id: string; kind: "prop"; paint: SkinPaint; geometry: Geometry };

const n = (value: number) => String(Math.round(value * 10) / 10);

type Circle = { x: number; y: number; r: number };

const circlePath = ({ x, y, r }: Circle) =>
  `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;

// Deux cercles et leurs tangentes : un membre qui s'affine. Un membre pointé vers le spectateur se réduit à un cercle.
const capsulePath = (a: Circle, b: Circle) => {
  const [big, small] = a.r >= b.r ? [a, b] : [b, a];
  const gap = Math.hypot(small.x - big.x, small.y - big.y);
  if (gap + small.r <= big.r + 1e-6) return circlePath(big);
  const toward = Math.atan2(small.y - big.y, small.x - big.x);
  const spread = Math.acos((big.r - small.r) / gap);
  const on = (c: Circle, angle: number) => `${n(c.x + c.r * Math.cos(angle))} ${n(c.y + c.r * Math.sin(angle))}`;
  return (
    `M${on(big, toward + spread)}A${n(big.r)} ${n(big.r)} 0 1 1 ${on(big, toward - spread)}` +
    `L${on(small, toward - spread)}A${n(small.r)} ${n(small.r)} 0 0 1 ${on(small, toward + spread)}Z`
  );
};

// L'enveloppe convexe de plusieurs cercles, approchée par un polygone assez fin pour ne pas se voir.
const FACETS = 20;
const hullPath = (circles: readonly Circle[]) => {
  const points: [number, number][] = [];
  for (const { x, y, r } of circles)
    for (let i = 0; i < FACETS; i += 1) {
      const angle = (i / FACETS) * 2 * Math.PI;
      points.push([x + r * Math.cos(angle), y + r * Math.sin(angle)]);
    }
  points.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const turn = (o: [number, number], p: [number, number], q: [number, number]) =>
    (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const half = (ordered: [number, number][]) => {
    const chain: [number, number][] = [];
    for (const point of ordered) {
      while (chain.length >= 2 && turn(chain[chain.length - 2]!, chain[chain.length - 1]!, point) <= 0) chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  const hull = [...half(points), ...half([...points].reverse())];
  return `M${hull.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z`;
};

// Un disque de fonte : un cercle vu par sa face, un rectangle aux coins adoucis vu par sa tranche.
const discPath = (a: Circle, b: Circle) => {
  const gap = Math.hypot(b.x - a.x, b.y - a.y);
  if (gap < 0.5) return circlePath(a);
  const [dx, dy] = [(b.x - a.x) / gap, (b.y - a.y) / gap];
  const soft = 2;
  const corner = (c: Circle, inward: number, across: number): Circle => ({
    x: c.x + dx * inward * soft - dy * across * (c.r - soft),
    y: c.y + dy * inward * soft + dx * across * (c.r - soft),
    r: soft,
  });
  return hullPath([corner(a, 1, 1), corner(a, 1, -1), corner(b, -1, 1), corner(b, -1, -1)]);
};

// La tête et le dossard reprennent les formes du premier dessin, à l'échelle de la nouvelle tête :
// les visages, les coiffures et les chiffres du groupe ne changent pas.
const SCALE = { head: FIGURE.head / 44, bib: 0.46 };
const flats = new Map<string, readonly Shape[]>();
const headShapes = (look: Look, view: GestureView): readonly Shape[] => {
  const key = `head/${look.hair}/${look.face}/${view}`;
  let shapes = flats.get(key);
  if (!shapes) {
    // De dessus, on voit la chevelure : c'est la vue de dos du premier dessin.
    const bones = rig({ ...look, bib: null }, view === "top" ? "back" : view);
    const of = (id: string) => bones.find((bone) => bone.id === id)?.shapes ?? [];
    shapes = [...of("hairBack"), ...of("head"), ...of("eyes")];
    flats.set(key, shapes);
  }
  return shapes;
};
const bibShapes = (bib: number): readonly Shape[] => {
  const key = `bib/${bib}`;
  let shapes = flats.get(key);
  if (!shapes) {
    shapes = rig({ hair: "crop", face: "neutral", bib }, "front").find((bone) => bone.id === "bib")!.shapes;
    flats.set(key, shapes);
  }
  return shapes;
};

const placed = (anchor: Anchor, view: GestureView, scale: number) => {
  const at = project(anchor.at, view);
  const up = project(anchor.up, view);
  // De dessus, l'axe du corps pointe vers le spectateur : le dessin reste droit.
  const angle = view === "top" ? 0 : (Math.atan2(up.x, -up.y) * 180) / Math.PI;
  const size = Math.round(scale * 1000) / 1000;
  return { depth: at.depth, transform: `translate(${n(at.x)} ${n(at.y)}) rotate(${n(angle)}) scale(${size})` };
};

export type DrawOptions = {
  // De profil, les disques passent derrière l'athlète : devant, ils cacheraient les jambes et les mains.
  // La barre reste visible par son bout, sur la main. Faux : les disques sont dessinés à leur vraie profondeur.
  platesBehind?: boolean;
  // Le matériel du geste à cette image.
  props?: readonly Prop[];
};

// Une image : les nœuds à dessiner, du fond vers le devant.
export const drawBody = (body: Solved, look: Look, view: GestureView, options: DrawOptions = {}): DrawNode[] => {
  const { parts, head, bib } = skin(body);
  const platesBehind = (options.platesBehind ?? true) && view === "side";
  const depths = new Map<string, number>();
  const items: { node: DrawNode; depth: number }[] = [];

  for (const part of parts) {
    const circles = part.spheres.map(({ c, r }) => ({ ...project(c, view), r }));
    let depth = circles.reduce((sum, circle) => sum + circle.depth, 0) / circles.length + (part.lift ?? 0);
    if (part.over) depth = depths.get(part.over)! + 1e-3;
    if (part.disc && platesBehind) depth = -1e6;
    depths.set(part.id, depth);
    const d = part.disc
      ? discPath(circles[0]!, circles[1]!)
      : circles.length === 2
        ? capsulePath(circles[0]!, circles[1]!)
        : hullPath(circles);
    items.push({ node: { id: part.id, kind: "path", paint: part.paint, d }, depth });
  }

  if (look.bib !== null && view !== "top") {
    const { transform } = placed(bib, view, SCALE.bib);
    items.push({
      node: { id: "bib", kind: "group", transform, content: `bib/${look.bib}`, shapes: bibShapes(look.bib) },
      depth: depths.get("chest")! + 2e-3,
    });
  }
  const { depth, transform } = placed(head, view, SCALE.head);
  items.push({
    node: {
      id: "head",
      kind: "group",
      transform,
      content: `head/${look.hair}/${look.face}/${view}`,
      shapes: headShapes(look, view),
    },
    // De profil, le visage reste lisible : la tête passe devant le bras qui la croise.
    depth: depth + (view === "side" ? 150 : 0),
  });

  (options.props ?? []).forEach((prop, index) => {
    const geometry = seenFrom(prop, view);
    if (geometry)
      items.push({
        node: { id: `prop${index}`, kind: "prop", paint: prop.paint, geometry },
        depth: depthIn(prop, view),
      });
  });

  // Le tri est stable : à profondeur égale, l'ordre des parties décide (le cou sous la tête, la barre sous la tête).
  return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
};

// L'apparence d'un athlète du groupe pour un visage donné.
export const lookOf = (clip: MotionClip, face: Face): Look => ({ ...ATHLETES[clip.athlete], face });

// L'image d'un geste à l'instant `t`.
export const drawClip = (clip: MotionClip, t: number, view: GestureView, options?: DrawOptions): DrawNode[] => {
  const body = clip.pose(t);
  return drawBody(body, lookOf(clip, clip.face(t)), view, { props: clip.props(t, body), ...options });
};

const ATTRIBUTES: Record<string, string> = { strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap" };

// Une forme du premier dessin, en balise et attributs SVG.
const attributesOf = (shape: Record<string, unknown>) => {
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(shape))
    if (name !== "tag" && value !== undefined) attributes[ATTRIBUTES[name] ?? name] = String(value);
  return attributes;
};

export const shapeElement = (shape: Shape, paint: ScenePaint): { tag: string; attributes: Record<string, string> } => {
  const drawn = svgShape(shape, paint[shape.paint]);
  return { tag: drawn.tag, attributes: attributesOf(drawn) };
};

// Un accessoire, en balise et attributs SVG.
export const propElement = (geometry: Geometry, color: string): { tag: string; attributes: Record<string, string> } => {
  const drawn = svgProp(geometry, color);
  return { tag: drawn.tag, attributes: attributesOf(drawn) };
};

// Les nœuds d'une image, en texte SVG : pour une image fixe, une frise, un script.
export const svgMarkup = (nodes: readonly DrawNode[], paint: ScenePaint): string =>
  nodes
    .map((node) => {
      if (node.kind === "path") return `<path d="${node.d}" fill="${paint[node.paint]}"/>`;
      const write = ({ tag, attributes }: { tag: string; attributes: Record<string, string> }) =>
        `<${tag} ${Object.entries(attributes)
          .map(([name, value]) => `${name}="${value}"`)
          .join(" ")}/>`;
      if (node.kind === "prop") return write(propElement(node.geometry, paint[node.paint]));
      const children = node.shapes.map((shape) => write(shapeElement(shape, paint)));
      return `<g transform="${node.transform}">${children.join("")}</g>`;
    })
    .join("");

export type Box = { x: number; y: number; width: number; height: number };

// Le cadre qui contient tout le geste dans une vue : le corps et la barre sur toute la boucle, plus une marge.
// De profil et de face, il s'arrête juste sous le sol.
export const framing = (clip: MotionClip, view: GestureView, margin = 14): Box => {
  let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
  const include = (x: number, y: number, r: number) => {
    left = Math.min(left, x - r);
    right = Math.max(right, x + r);
    top = Math.min(top, y - r);
    bottom = Math.max(bottom, y + r);
  };
  const gear: Extent[] = [];
  for (let i = 0; i < 96; i += 1) {
    const body = clip.pose(i / 96);
    const { parts, head } = skin(body);
    for (const prop of clip.props(i / 96, body)) {
      const geometry = prop.scroll ? null : seenFrom(prop, view);
      if (geometry) gear.push(extent(geometry));
    }
    for (const part of parts)
      for (const { c, r } of part.spheres) {
        const at = project(c, view);
        include(at.x, at.y, r);
      }
    // La tête, coiffure comprise : une coupe afro dépasse le crâne.
    const at = project(head.at, view);
    include(at.x, at.y, FIGURE.head * 1.4);
  }
  // Le matériel entre dans le cadre, mais ne l'étire pas sans fin : un ballon lancé sort de l'image.
  const reach = 150;
  const [bodyLeft, bodyRight, bodyTop, bodyBottom] = [left, right, top, bottom];
  for (const seen of gear) {
    include(Math.max(seen.left, bodyLeft - reach), Math.max(seen.top, bodyTop - reach), 0);
    include(Math.min(seen.right, bodyRight + reach), Math.min(seen.bottom, bodyBottom + reach), 0);
  }
  if (view !== "top") bottom = 0;
  return {
    x: Math.floor(left - margin),
    y: Math.floor(top - margin),
    width: Math.ceil(right - left + 2 * margin),
    height: Math.ceil(bottom - top + margin + (view === "top" ? margin : 10)),
  };
};

// Une image complète : le cadre, le sol, puis l'athlète. `box` : le cadre, par défaut celui du geste.
export const sceneSvg = (
  clip: MotionClip,
  t: number,
  view: GestureView,
  paint: ScenePaint,
  box: Box = framing(clip, view),
  options?: DrawOptions,
): string => {
  const floor =
    view === "top"
      ? ""
      : `<line x1="${box.x}" y1="2" x2="${box.x + box.width}" y2="2" stroke="${paint.floor}" stroke-width="4"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}">` +
    floor +
    svgMarkup(drawClip(clip, t, view, options), paint) +
    `</svg>`
  );
};
