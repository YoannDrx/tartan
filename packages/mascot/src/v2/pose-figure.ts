// Une seule morphologie partout : les anciennes poses (les épreuves, le film d'accueil, le jeu, les cartes, les
// e-mails) habillent désormais le corps du nouveau moteur, de 6,8 têtes. L'ancienne pose donne les directions du
// buste, de la tête et des membres ; les pieds et les mains se posent exactement aux points de l'ancien squelette,
// pour que les appuis, les perches, les disques et les barres restent à leur place dans les scènes. Le corps est
// mis à l'échelle de l'ancien par la hauteur de la hanche : les jambes ont la même longueur, la tête est plus petite.
// Le rendu sort en nœuds (draw-svg.ts), en figure SVG prête à poser (le format de svg.ts), ou sur un canvas.
import { ATHLETES, type AthleteId } from "../athletes";
import { drawShape, type MascotCanvas } from "../canvas";
import type { Face } from "../rig";
import type { AthletePaint, BoneId, Paint, PaintRole, Point, Pose, Shape, View } from "../skeleton";
import { svgShape, type SvgFigure } from "../svg";
import { FIGURE } from "./body";
import { drawBody, type DrawNode, type Look, type ScenePaint } from "./draw-svg";
import { svgSink, type MotionSink, type SvgDocumentLike, type SvgElementLike } from "./player";
import { anglesOf, footOf, limbOf, lifted, nativeOf, oldJoints, SCALE, shapeOf, type OldKey } from "./lift-v1";
import { STAND, type Controls } from "./pose";
import type { GestureView } from "./project";
import { SIDES, solve, type Side, type Solved } from "./solve";
import { add, cross, dot, normalize, scale, sub, vec } from "./vec";

const out = (side: Side) => (side === "R" ? 1 : -1);
// Le corps est résolu loin au-dessus du sol : aucun pied n'y est posé, la pointe suit le pied (solve.ts). Le dessin
// le redescend de cette hauteur.
const LIFT = 1000;

// Le nouveau corps dans l'ancienne pose, le bassin à l'origine, dans les unités du nouveau corps.
export const poseBody = (pose: Pose, view: View = "side"): Solved => {
  const native = nativeOf(view);
  const joints = oldJoints(pose, { x: 0, y: 0 }, view);
  const shape = shapeOf({ joints, flip: pose.flip } as OldKey, native);
  // Un point de l'ancien squelette, autour du bassin, dans l'espace du nouveau corps.
  const at = (point: Point) => scale(lifted(native, point.x, point.y), SCALE);
  const turn = anglesOf(shape.pelvis);
  const c: Controls = {
    ...STAND,
    pelvisX: 0,
    pelvisY: LIFT,
    pelvisZ: 0,
    pelvisYaw: turn.yaw,
    pelvisRoll: turn.roll,
    pelvisPitch: turn.pitch,
    lumbar: shape.bend / 2,
    thoracic: shape.bend / 2,
    neck: Math.min(40, Math.max(-45, 0.6 * shape.nod)),
    head: Math.min(30, Math.max(-30, 0.4 * shape.nod)),
  };
  for (const side of SIDES) {
    const limb = limbOf(native, side);
    const k = out(side);
    // Le pied : sa cheville au point de l'ancienne cheville, à la largeur des hanches, perpendiculaire au tibia.
    const foot = footOf(shape, side, true, false, 4);
    const old = at(joints[`ankle${limb}`]);
    const ankle = native === "side" ? vec(old.x, old.y, k * FIGURE.hip) : old;
    const ball = add(ankle, foot.ball);
    const angles = anglesOf(foot.frame);
    c[`foot${side}X`] = ball.x;
    c[`foot${side}Z`] = ball.z;
    c[`foot${side}Lift`] = LIFT + ball.y;
    c[`foot${side}Yaw`] = k * angles.yaw;
    c[`foot${side}Roll`] = k * angles.roll;
    c[`foot${side}Heel`] = angles.pitch;
    // Le genou se plie vers l'avant de la cuisse. Sa direction est donnée dans la scène : l'ouverture du pied
    // s'en retranche.
    const chord = normalize(sub(ankle, shape.legs[side].hip));
    const bend = cross(shape.pelvis.s, chord);
    c[`knee${side}Out`] = -c[`foot${side}Yaw`];
    c[`knee${side}Forward`] = bend.x;
    c[`knee${side}Up`] = bend.y;
    c[`knee${side}Side`] = k * bend.z;
    // La main : posée au point de l'ancienne main, là où l'objet tenu est dessiné.
    const arm = shape.arms[side];
    const oldHand = at(joints[`hand${limb}`]);
    const hand = native === "side" ? vec(oldHand.x, oldHand.y, arm.hand.z) : oldHand;
    c[`hand${side}Pin`] = 1;
    c[`hand${side}X`] = hand.x;
    c[`hand${side}Y`] = LIFT + hand.y;
    c[`hand${side}Z`] = hand.z;
    c[`elbow${side}Forward`] = dot(arm.bend, shape.frame.f);
    c[`elbow${side}Up`] = dot(arm.bend, shape.frame.u);
    c[`elbow${side}Out`] = k * dot(arm.bend, shape.frame.s);
  }
  return solve(c, { bar: null });
};

// La vue du nouveau moteur qui correspond à une vue de l'ancien : de dos, c'est le dessus d'un corps couché.
export const gestureViewOf = (view: View): GestureView => nativeOf(view);

// L'apparence d'un athlète du groupe pour un visage donné.
export const lookFor = (id: AthleteId, face: Face): Look => ({ ...ATHLETES[id], face });

// Les nœuds à dessiner, autour du bassin, dans les unités du nouveau corps.
export const poseNodes = (id: AthleteId, face: Face, pose: Pose, view: View = "side"): DrawNode[] =>
  drawBody(poseBody(pose, view), lookFor(id, face), gestureViewOf(view));

// De l'unité du nouveau corps à celle des anciennes scènes : la hauteur de la hanche se conserve.
export const POSE_SCALE = 1 / SCALE;
const round = (value: number) => Math.round(value * 1000) / 1000;
// La transformation qui pose le corps dans une ancienne scène : le bassin en `at`, à l'échelle de l'ancien corps.
export const poseRoot = (at?: Point, size = 1) =>
  `translate(${round(at?.x ?? 0)} ${round((at?.y ?? 0) + LIFT * POSE_SCALE * size)}) scale(${round(POSE_SCALE * size)})`;

// Le personnage image par image dans un groupe SVG, sans React (player.ts) : le groupe porte `poseRoot`. Un
// personnage seul n'a pas de matériel : ses couleurs suffisent au lecteur des gestes.
export const poseSink = <E extends SvgElementLike<E>>(
  document: SvgDocumentLike<E>,
  parent: E,
  paint: AthletePaint,
): MotionSink => svgSink(document, parent, paint as ScenePaint);

// Un canvas qui sait remplir un tracé SVG : un CanvasRenderingContext2D, avec Path2D.
export type PoseCanvas = MascotCanvas & { fill(path?: unknown): void };
type PathMaker = (d: string) => unknown;
const hostPath: PathMaker = (d) => {
  const Path = (globalThis as { Path2D?: new (d: string) => unknown }).Path2D;
  if (!Path) throw new Error("Aucun Path2D : donner `path` au dessin.");
  return new Path(d);
};
// Le placement d'un dessin à plat, tel que draw-svg.ts l'écrit.
const PLACED = /^translate\((\S+) (\S+)\) rotate\((\S+)\) scale\((\S+)\)$/;

// Le personnage sur un canvas, à la place de l'ancien (canvas.ts) : `at` place le bassin, `scale` change sa taille.
export const drawPoseFigure = (
  ctx: PoseCanvas,
  id: AthleteId,
  face: Face,
  pose: Pose,
  {
    paint,
    at,
    scale: size = 1,
    view = "side",
    path = hostPath,
  }: { paint: AthletePaint; at?: Point; scale?: number; view?: View; path?: PathMaker },
) => {
  ctx.save();
  ctx.translate(at?.x ?? 0, (at?.y ?? 0) + LIFT * POSE_SCALE * size);
  ctx.scale(POSE_SCALE * size, POSE_SCALE * size);
  for (const node of poseNodes(id, face, pose, view)) {
    if (node.kind === "path") {
      ctx.fillStyle = paint[node.paint as keyof AthletePaint];
      ctx.fill(path(node.d));
    } else if (node.kind === "group") {
      const [x, y, angle, factor] = PLACED.exec(node.transform)!.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.scale(factor, factor);
      for (const shape of node.shapes) drawShape(ctx, shape, paint[shape.paint]);
      ctx.restore();
    }
  }
  ctx.restore();
};

// Des nœuds au format des figures SVG (svg.ts) : un groupe par aplat, la tête et le dossard comme dessins à plat.
// Sans dossard, les couleurs de base suffisent.
const figureOf = (nodes: readonly DrawNode[], paint: Paint & Partial<AthletePaint>, at?: Point): SvgFigure => ({
  root: poseRoot(at),
  bones: nodes.flatMap((node) =>
    node.kind === "path"
      ? [
          {
            id: node.id as BoneId,
            transform: "",
            shapes: [{ tag: "path" as const, d: node.d, fill: paint[node.paint as PaintRole]! }],
          },
        ]
      : node.kind === "group"
        ? [
            {
              id: node.id as BoneId,
              transform: node.transform,
              shapes: node.shapes.map((shape: Shape) => svgShape(shape, paint[shape.paint]!)),
            },
          ]
        : [],
  ),
});

// Un athlète du groupe au format des figures SVG : les composants qui posaient l'ancienne figure posent celle-ci
// sans changement.
export const svgPoseFigure = (
  id: AthleteId,
  face: Face,
  pose: Pose,
  paint: AthletePaint,
  at?: Point,
  view: View = "side",
): SvgFigure => figureOf(poseNodes(id, face, pose, view), paint, at);

// La mascotte d'origine, sans dossard, cheveux courts : le même corps que le groupe.
const JUMPER_LOOK: Look = { hair: "crop", bib: null, face: "neutral" };
export const svgJumperFigure = (pose: Pose, paint: Paint, at?: Point): SvgFigure =>
  figureOf(drawBody(poseBody(pose), JUMPER_LOOK, "side"), paint, at);
