// Une seule morphologie partout : les anciennes poses (les épreuves, le film d'accueil, le jeu, les cartes, les
// e-mails) habillent désormais le corps du nouveau moteur, de 6,8 têtes. L'ancienne pose donne les directions du
// buste, de la tête et des membres ; les pieds et les mains se posent aux points de l'ancien squelette quand le
// nouveau membre les atteint, pour que les appuis restent à leur place. Un membre trop court ne se tend pas dans le
// vide : le bassin porte un appui un peu loin, et un bras reprend les angles de l'ancien geste. L'objet tenu (la
// perche, le disque) suit la main (`poseHands`). Le corps est mis à l'échelle de l'ancien par la hauteur de la
// hanche : les jambes ont la même longueur, la tête est plus petite.
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
import { liftToReach, span } from "./ik";
import { SIDES, SLACK, solve, type Side, type Solved } from "./solve";
import {
  add,
  along,
  cross,
  distance,
  dot,
  mix,
  normalize,
  pitch,
  roll,
  scale,
  sub,
  vec,
  WORLD,
  yaw,
  type Vec3,
} from "./vec";

const out = (side: Side) => (side === "R" ? 1 : -1);
// Le corps est résolu loin au-dessus du sol : aucun pied n'y est posé, la pointe suit le pied (solve.ts). Le dessin
// le redescend de cette hauteur.
const LIFT = 1000;

// Une ancienne pose qui dit où une main tient un objet, autour du bassin, à la place de la main de l'ancien
// squelette (la main du bas sur la perche). L'ancien dessin l'ignore ; le nouveau corps y pose la main.
export type HeldPose = Pose & { grip?: Partial<Record<"handA" | "handB", Point>> };

// La portée d'un bras et d'une jambe tendus, à la souplesse près que garde le moteur (solve.ts).
const ARM_REACH = span(FIGURE.upperArm, FIGURE.forearm + FIGURE.hand, SLACK.arm) - 0.01;
const LEG_REACH = span(FIGURE.thigh, FIGURE.shin, SLACK.leg) - 0.01;

// Ce qu'une jambe peut manquer de son appui et que le bassin porte en descendant d'autant (solve.ts).
const LEG_SLACK = 14;

// La cible d'un membre, depuis son épaule ou sa hanche : le point de l'ancien squelette s'il est à portée, ou à
// `slack` près quand le bassin peut descendre jusqu'à lui. Au-delà, le membre ne se tend pas dans le vide : il
// reprend peu à peu les angles de l'ancien geste (`free`), à sa propre longueur.
const within = (root: Vec3, pinned: Vec3, free: Vec3, reach: number, slack = 0) => {
  const over = distance(root, pinned) - reach;
  if (over <= 0 || (over <= slack && liftToReach(root, pinned, reach) !== null)) return pinned;
  const target = mix(pinned, free, Math.min(1, Math.max(0, (over - slack) / (0.08 * reach))));
  const far = distance(root, target);
  return far > reach ? add(root, scale(sub(target, root), reach / far)) : target;
};

// L'épaule telle que le moteur la placera, le bassin à l'origine (solve.ts) : la portée se mesure depuis elle.
const shoulderOf = (c: Controls, side: Side) => {
  const pelvis = pitch(roll(yaw(WORLD, c.pelvisYaw), c.pelvisRoll), c.pelvisPitch);
  const lumbar = pitch(pelvis, c.lumbar);
  const thorax = pitch(lumbar, c.thoracic);
  const chest = add(scale(pelvis.u, FIGURE.pelvis), scale(lumbar.u, FIGURE.lumbar));
  const neck = add(chest, scale(thorax.u, FIGURE.thorax));
  return along(neck, thorax, 0, -FIGURE.shoulderDrop + FIGURE.shrug * c.shrug, out(side) * FIGURE.shoulder);
};

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
  // Une jambe un peu courte pour son appui : le bassin descend jusqu'à lui, et les épaules avec lui.
  let drop = 0;
  for (const side of SIDES) {
    const limb = limbOf(native, side);
    const k = out(side);
    // Le pied : sa cheville au point de l'ancienne cheville, à la largeur des hanches, perpendiculaire au tibia.
    const foot = footOf(shape, side, true, false, 4);
    const old = at(joints[`ankle${limb}`]);
    const leg = shape.legs[side];
    const ankle = within(
      leg.hip,
      native === "side" ? vec(old.x, old.y, k * FIGURE.hip) : old,
      leg.ankle,
      LEG_REACH,
      LEG_SLACK,
    );
    if (distance(leg.hip, ankle) > LEG_REACH) drop = Math.min(drop, liftToReach(leg.hip, ankle, LEG_REACH) ?? 0);
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
  }
  for (const side of SIDES) {
    const limb = limbOf(native, side);
    const k = out(side);
    // La main : le bras reprend les angles de l'ancien bras, à sa propre longueur, depuis la nouvelle épaule. Le
    // nouveau bras est plus long pour son buste : posé à l'ancienne main, il se plierait en anse. L'objet tenu suit la
    // main (`poseHands`) ; une prise imposée par la scène (`grip`, la main du bas sur la perche) est tenue telle quelle.
    const arm = shape.arms[side];
    const shoulder = add(shoulderOf(c, side), vec(0, drop, 0));
    const free = add(shoulder, sub(arm.hand, arm.shoulder));
    const held = (pose as HeldPose).grip?.[`hand${limb}`];
    const grip = held ? at(held) : null;
    const hand = grip
      ? within(shoulder, native === "side" ? vec(grip.x, grip.y, arm.hand.z) : grip, free, ARM_REACH)
      : within(shoulder, free, free, ARM_REACH);
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

// Une image se résout une fois : la scène y lit les mains pour poser l'objet tenu, puis dessine le corps.
const recent = new Map<string, Solved>();
const bodyOf = (pose: Pose, view: View): Solved => {
  const key = `${view}:${JSON.stringify(pose)}`;
  let body = recent.get(key);
  if (!body) {
    body = poseBody(pose, view);
    if (recent.size >= 24) recent.delete(recent.keys().next().value!);
    recent.set(key, body);
  }
  return body;
};

// Les nœuds à dessiner, autour du bassin, dans les unités du nouveau corps.
export const poseNodes = (id: AthleteId, face: Face, pose: Pose, view: View = "side"): DrawNode[] =>
  drawBody(bodyOf(pose, view), lookFor(id, face), gestureViewOf(view));

// De l'unité du nouveau corps à celle des anciennes scènes : la hauteur de la hanche se conserve.
export const POSE_SCALE = 1 / SCALE;
const round = (value: number) => Math.round(value * 1000) / 1000;
// La transformation qui pose le corps dans une ancienne scène : le bassin en `at`, à l'échelle de l'ancien corps.
export const poseRoot = (at?: Point, size = 1) =>
  `translate(${round(at?.x ?? 0)} ${round((at?.y ?? 0) + LIFT * POSE_SCALE * size)}) scale(${round(POSE_SCALE * size)})`;

// Où sont les mains du nouveau corps dans une ancienne scène de profil, le bassin en `root`, sous les noms de
// l'ancien squelette (A, le côté proche). Un objet tenu (la perche, le disque) se pose sur elles : c'est l'objet qui
// suit la main, jamais l'inverse.
// La scène y lit aussi les épaules et la portée d'un bras tendu, pour choisir une prise que la main atteint.
export const poseHands = (
  pose: Pose,
  root: Point,
): { handA: Point; handB: Point; shoulderA: Point; shoulderB: Point; reach: number } => {
  const body = bodyOf(pose, "side");
  const place = (point: Vec3): Point => ({
    x: root.x + point.x * POSE_SCALE,
    y: root.y - (point.y - LIFT) * POSE_SCALE,
  });
  const [a, b] = limbOf("side", "R") === "A" ? (["R", "L"] as const) : (["L", "R"] as const);
  return {
    handA: place(body.arms[a].hand),
    handB: place(body.arms[b].hand),
    shoulderA: place(body.arms[a].shoulder),
    shoulderB: place(body.arms[b].shoulder),
    reach: ARM_REACH * POSE_SCALE,
  };
};

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
