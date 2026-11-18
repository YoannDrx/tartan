// Le relèvement : un geste du premier moteur, repris tel qu'il est et rejoué par le nouveau corps.
// Le premier moteur décrit des angles dans le plan de l'image. Ici, chaque clé garde ces angles (l'inclinaison du
// buste, de la cuisse, du tibia, du bras, de l'avant-bras) et les applique aux segments du nouveau corps, plus
// longs et autrement proportionnés. Puis les appuis sont déduits : ce qui touchait le sol ou restait immobile
// devient un pied planté, une main posée, et le bassin se place d'après l'appui principal. La barre tenue devient
// une vraie barre, à deux mains. La vue qui n'existait pas (la face d'un geste de profil) vient de la projection.
// Un geste relevé garde le rythme du premier moteur : il n'a pas la dynamique d'un geste écrit à la main.
import { GEAR, type ExerciseClip, type GearShape } from "../exercise";
import type { Geometry } from "../props";
import {
  chain,
  skeletonOf,
  type Anchor as V1Anchor,
  type Bone,
  type BoneId,
  type Point,
  type Pose,
  type View,
} from "../skeleton";
import { BARBELL, FIGURE, LIMITS } from "./body";
import { gesture, type KeyDraft, type MotionClip } from "./gesture";
import { span } from "./ik";
import { BALL_X, STAND, type Controls } from "./pose";
import type { GestureView } from "./project";
import type { Prop } from "./props";
import { skin } from "./skin";
import { SIDES, SLACK, solve, type Rig, type Side, type Solved } from "./solve";
import { add, cross, degrees, dot, length, normalize, pitch, scale, sub, vec, type Frame, type Vec3 } from "./vec";

// Le rapport des tailles : la hauteur de la hanche debout, du nouveau corps à l'ancien.
const OLD = { thigh: 62, shin: 62, ankle: 16, torso: 88, forearm: 46 };
export const SCALE = (FIGURE.ankle + FIGURE.shin + FIGURE.thigh) / (OLD.ankle + OLD.shin + OLD.thigh);
const S = SCALE;

// La hauteur de repos de chaque appui de l'ancien corps au-dessus du sol (exercise.ts).
const REST: Record<V1Anchor, number> = {
  footA: 16,
  footB: 16,
  handA: 15,
  handB: 15,
  pelvis: 24,
  head: 44,
  shoulder: 30,
};
const ANCHORS = [
  "footA",
  "footB",
  "pelvis",
  "shoulder",
  "handA",
  "handB",
  "head",
] as const satisfies readonly V1Anchor[];
// En dessous de cette hauteur libre, un appui touche le sol ; en dessous de ce déplacement, il n'a pas bougé.
const TOUCH = 2.5;
const STILL = 0.8;

// --- L'ancien corps, articulation par articulation -----------------------------------------------------

type Matrix = [number, number, number, number, number, number];
const then = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const turned = (m: Matrix, angle: number) => {
  const a = (angle * Math.PI) / 180;
  return then(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
};

type Limb = "A" | "B";
type OldJoints = { pelvis: Point; neck: Point; head: Point } & Record<
  `${"shoulder" | "elbow" | "hand" | "hip" | "knee" | "ankle"}${Limb}`,
  Point
>;

const oldJoints = (pose: Pose, root: Point, view: View): OldJoints => {
  const bones = new Map<BoneId, Bone>(skeletonOf(view).map((bone) => [bone.id, bone]));
  const body = then(turned([1, 0, 0, 1, root.x, root.y], pose.rot), [pose.flip * pose.sx, 0, 0, pose.sy, 0, 0]);
  const at = (id: BoneId, point: Point = { x: 0, y: 0 }): Point => {
    let m = body;
    for (const step of chain(bones.get(id)!, pose, bones))
      m = "move" in step ? then(m, [1, 0, 0, 1, step.move.x, step.move.y]) : "turn" in step ? turned(m, step.turn) : m;
    return { x: m[0] * point.x + m[2] * point.y + m[4], y: m[1] * point.x + m[3] * point.y + m[5] };
  };
  const limb = (side: Limb) => ({
    [`shoulder${side}`]: at(`upperArm${side}`),
    [`elbow${side}`]: at(`forearm${side}`),
    [`hand${side}`]: at(`forearm${side}`, { x: 0, y: OLD.forearm }),
    [`hip${side}`]: at(`thigh${side}`),
    [`knee${side}`]: at(`shin${side}`),
    [`ankle${side}`]: at(`shin${side}`, { x: 0, y: OLD.shin }),
  });
  return {
    pelvis: root,
    neck: at("torso", { x: 0, y: -OLD.torso }),
    head: at("head"),
    ...limb("A"),
    ...limb("B"),
  } as OldJoints;
};

const anchorOf = (joints: OldJoints, anchor: V1Anchor): Point =>
  anchor === "footA"
    ? joints.ankleA
    : anchor === "footB"
      ? joints.ankleB
      : anchor === "handA"
        ? joints.handA
        : anchor === "handB"
          ? joints.handB
          : anchor === "shoulder"
            ? joints.neck
            : joints[anchor];

// --- Du plan de l'image à l'espace -------------------------------------------------------------------------

// La vue où l'ancien geste a été dessiné : de profil, de face, ou de dessus (l'ancien « dos », couché sur le ventre).
const nativeOf = (view: View): GestureView => (view === "side" ? "side" : view === "front" ? "front" : "top");

// Un déplacement dans l'image (x vers la droite, y vers le bas) devient un déplacement dans l'espace.
const lifted = (native: GestureView, dx: number, dy: number): Vec3 =>
  native === "side" ? vec(dx, -dy, 0) : native === "front" ? vec(0, -dy, -dx) : vec(dx, 0, dy);

// Le côté A de l'ancien corps est le plus proche de profil, et à droite de l'image de face.
const sideOf = (native: GestureView, limb: Limb): Side =>
  (native === "front" ? limb === "B" : limb === "A") ? "R" : "L";
const limbOf = (native: GestureView, side: Side): Limb => (sideOf(native, "A") === side ? "A" : "B");
const out = (side: Side) => (side === "R" ? 1 : -1);

// Un repère, en trois angles : pivot, inclinaison sur le côté, bascule vers l'avant (l'ordre de solve.ts).
const anglesOf = ({ u, s }: Frame) => {
  const rolled = -Math.asin(Math.min(1, Math.max(-1, s.y)));
  const turn = Math.abs(Math.cos(rolled)) > 1e-4 ? Math.atan2(-s.x, s.z) : 0;
  const ahead = vec(Math.cos(turn), 0, Math.sin(turn));
  const across = vec(-Math.sin(turn), 0, Math.cos(turn));
  const up = add(vec(0, Math.cos(rolled), 0), scale(across, Math.sin(rolled)));
  return { yaw: degrees(turn), roll: degrees(rolled), pitch: degrees(Math.atan2(dot(u, ahead), dot(u, up))) };
};

// --- Une clé de l'ancien geste ---------------------------------------------------------------------------

type OldKey = {
  // L'instant dans la boucle, et la part de boucle tenue (zéro : une traversée).
  t: number;
  hold: number;
  joints: OldJoints;
  flip: number;
  clear: Record<V1Anchor, number>;
  fixed: Record<V1Anchor, boolean>;
};

const spread = (a: OldJoints, b: OldJoints) =>
  Math.max(
    ...(Object.keys(a) as (keyof OldJoints)[]).map((name) => Math.hypot(a[name].x - b[name].x, a[name].y - b[name].y)),
  );

// Les instants à relever. Autour de chaque position du guide, l'ancien moteur tient à peu près la pose : c'est une
// tenue. Entre deux tenues, des traversées régulières. Un geste sans tenue (une course) est relevé à pas serré.
const keyTimes = (clip: ExerciseClip): { t: number; hold: number }[] => {
  const at = (t: number) => {
    const { pose, root } = clip.frame(((t % 1) + 1) % 1);
    return oldJoints(pose, root, clip.facing);
  };
  const step = 1 / 400;
  const holds: { from: number; to: number; t: number }[] = [];
  for (const still of clip.stills) {
    const pose = at(still);
    let [from, to] = [still, still];
    while (from - step >= 0 && still - from < 0.2 && spread(at(from - step), pose) < 4) from -= step;
    while (to + step <= 1 && to - still < 0.2 && spread(at(to + step), pose) < 4) to += step;
    if (to - from >= 0.03 && (holds.length === 0 || from > holds[holds.length - 1]!.to))
      holds.push({ from, to, t: still });
  }
  if (holds.length === 0) {
    const count = clip.loop ? 64 : 65;
    return Array.from({ length: count }, (_, i) => ({ t: (i / 64) * (clip.loop ? 1 : 0.999), hold: 0 }));
  }
  if (holds[0]!.from < 0.02) holds[0]!.from = 0;
  const keys: { t: number; hold: number }[] = [];
  const between = (from: number, to: number) => {
    const pieces = Math.max(1, Math.round((to - from) * 32));
    for (let i = 1; i < pieces; i += 1) keys.push({ t: from + ((to - from) * i) / pieces, hold: 0 });
  };
  if (holds[0]!.from > 0) {
    keys.push({ t: 0, hold: 0 });
    between(0, holds[0]!.from);
  }
  holds.forEach((hold, index) => {
    keys.push({ t: hold.from, hold: hold.to - hold.from });
    between(hold.to, holds[index + 1]?.from ?? 1);
  });
  if (!clip.loop) keys.push({ t: 0.999, hold: 0 });
  return keys;
};

const oldKeys = (clip: ExerciseClip): OldKey[] => {
  const ground = clip.stage.ground;
  const keys = keyTimes(clip).map(({ t, hold }): OldKey => {
    // Une tenue se relève en son milieu : là où l'ancien moteur dérive le moins.
    const { pose, root } = clip.frame(t + hold / 2);
    const joints = oldJoints(pose, root, clip.facing);
    const clear = {} as Record<V1Anchor, number>;
    for (const anchor of ANCHORS)
      clear[anchor] = clip.facing === "back" ? 0 : ground - REST[anchor] - anchorOf(joints, anchor).y;
    return { t, hold, joints, flip: pose.flip, clear, fixed: {} as Record<V1Anchor, boolean> };
  });
  const count = keys.length;
  keys.forEach((key, index) => {
    const near = [
      keys[index - 1] ?? (clip.loop ? keys[count - 1] : undefined),
      keys[index + 1] ?? (clip.loop ? keys[0] : undefined),
    ];
    for (const anchor of ANCHORS) {
      const here = anchorOf(key.joints, anchor);
      key.fixed[anchor] = near.some((other) => {
        if (!other || other === key) return false;
        const there = anchorOf(other.joints, anchor);
        return Math.hypot(here.x - there.x, here.y - there.y) < STILL && spread(key.joints, other.joints) > 3;
      });
    }
  });
  return keys;
};

// --- Le nouveau corps, avec les angles de l'ancien ----------------------------------------------------------

type Shape = {
  // Le repère du buste, celui du bassin, et ce que chaque segment du dos fléchit entre les deux.
  frame: Frame;
  pelvis: Frame;
  bend: number;
  neck: Vec3;
  head: Vec3;
  nod: number;
  arms: Record<Side, { shoulder: Vec3; elbow: Vec3; hand: Vec3; bend: Vec3 }>;
  legs: Record<Side, { hip: Vec3; knee: Vec3; ankle: Vec3; shin: Vec3 }>;
};

const LOWER_ARM = FIGURE.forearm + FIGURE.hand;

// Les positions du nouveau corps autour de son bassin, segment par segment, dans les directions de l'ancien.
const shapeOf = (key: OldKey, native: GestureView): Shape => {
  const { joints } = key;
  const toward = (from: Point, to: Point) => normalize(lifted(native, to.x - from.x, to.y - from.y));
  const u = toward(joints.pelvis, joints.neck);
  // Le côté droit du corps : hors du plan de profil ; dans le plan de face ou de dessus.
  const facing = native === "side" ? null : native === "front" ? vec(1, 0, 0) : vec(0, -1, 0);
  const s = facing ? normalize(cross(facing, u)) : vec(0, 0, key.flip < 0 ? -1 : 1);
  const frame: Frame = { f: normalize(cross(u, s)), u, s };
  const thighs = SIDES.map((side) =>
    toward(joints[`hip${limbOf(native, side)}`], joints[`knee${limbOf(native, side)}`]),
  );
  // La hanche ne se plie ni ne s'étend sans fin : au-delà, c'est le dos qui s'arrondit ou se creuse, et le bassin
  // bascule d'autant. Le haut du buste garde l'inclinaison de l'ancien geste.
  const flexions = thighs.map((thigh) => degrees(Math.atan2(dot(thigh, frame.f), -dot(thigh, frame.u))));
  const over = Math.max(0, Math.max(...flexions) - 118);
  const under = Math.max(0, -18 - Math.min(...flexions));
  const bend = over > 0 && under === 0 ? Math.min(over, 50) : under > 0 && over === 0 ? -Math.min(under, 24) : 0;
  const pelvis = pitch(frame, -bend);
  const neck = add(
    add(scale(pelvis.u, FIGURE.pelvis), scale(pitch(frame, -bend / 2).u, FIGURE.lumbar)),
    scale(u, FIGURE.thorax),
  );
  const gaze = toward(joints.neck, joints.head);
  const arms = {} as Shape["arms"];
  const legs = {} as Shape["legs"];
  // Deux segments ne se replient pas au-delà de leur amplitude : le second s'arrête à `most` degrés du premier.
  const capped = (first: Vec3, second: Vec3, most: number) => {
    const flexion = degrees(Math.acos(Math.min(1, Math.max(-1, dot(first, second)))));
    if (flexion <= most) return second;
    const aside = normalize(sub(second, scale(first, dot(first, second))));
    const angle = (most * Math.PI) / 180;
    return add(scale(first, Math.cos(angle)), scale(aside, Math.sin(angle)));
  };
  for (const side of SIDES) {
    const limb = limbOf(native, side);
    const shoulder = add(neck, add(scale(u, -FIGURE.shoulderDrop), scale(s, out(side) * FIGURE.shoulder)));
    let upper = toward(joints[`shoulder${limb}`], joints[`elbow${limb}`]);
    // Le bras ne part pas plus loin derrière le buste que l'épaule ne le permet : ce qui dépasse passe sur le
    // côté, comme un bras qui fait un cercle.
    const [back, down, aside] = [-dot(upper, frame.f), -dot(upper, frame.u), out(side) * dot(upper, frame.s)];
    const most = down > 0 ? down * Math.tan((58 * Math.PI) / 180) : -down * Math.tan((25 * Math.PI) / 180);
    if (back > most)
      upper = normalize(
        add(
          scale(frame.s, out(side) * Math.sqrt(aside * aside + back * back - most * most)),
          add(scale(frame.f, -most), scale(frame.u, -down)),
        ),
      );
    const lower = capped(upper, toward(joints[`elbow${limb}`], joints[`hand${limb}`]), 146);
    const elbow = add(shoulder, scale(upper, FIGURE.upperArm));
    const hand = add(elbow, scale(lower, LOWER_ARM));
    const reach = sub(hand, shoulder);
    const along = normalize(reach);
    // Le côté où le coude se plie : celui de l'ancien coude s'il est net, sinon vers l'arrière du bras.
    const off = sub(sub(elbow, shoulder), scale(along, dot(sub(elbow, shoulder), along)));
    const natural = add(scale(cross(frame.s, along), -1), scale(frame.s, 0.4 * out(side)));
    const weight = Math.min(1, length(off) / 12);
    const bend = normalize(add(scale(normalize(off), weight), scale(normalize(natural), 1 - weight + 0.2)));
    arms[side] = { shoulder, elbow, hand, bend };

    const hip = scale(s, out(side) * FIGURE.hip);
    const thigh = toward(joints[`hip${limb}`], joints[`knee${limb}`]);
    const shin = capped(thigh, toward(joints[`knee${limb}`], joints[`ankle${limb}`]), 150);
    const knee = add(hip, scale(thigh, FIGURE.thigh));
    legs[side] = { hip, knee, ankle: add(knee, scale(shin, FIGURE.shin)), shin };
  }
  return {
    frame,
    pelvis,
    bend,
    neck,
    head: add(neck, scale(gaze, FIGURE.neck)),
    nod: degrees(Math.atan2(dot(gaze, frame.f), dot(gaze, frame.u))),
    arms,
    legs,
  };
};

// Le pied : son repère, et où sont l'avant-pied et le point le plus bas de la semelle par rapport à la cheville.
type Foot = { flat: boolean; frame: Frame; ball: Vec3; low: number };
const footOf = (shape: Shape, side: Side, planted: boolean, kneeling: boolean, toeOut: number): Foot => {
  const up = scale(shape.legs[side].shin, -1);
  // Le pied dans l'axe du tibia : la pointe du côté où le genou se plie.
  const ahead = normalize(cross(shape.frame.s, shape.legs[side].shin));
  const upright = up.y > 0.64 && Math.abs(ahead.y) < 0.77;
  let frame: Frame;
  if (planted && upright && !kneeling) {
    const level = normalize(vec(ahead.x, 0, ahead.z));
    const angle = Math.atan2(level.z, level.x) + (out(side) * toeOut * Math.PI) / 180;
    const f = vec(Math.cos(angle), 0, Math.sin(angle));
    const level0: Frame = { f, u: vec(0, 1, 0), s: cross(f, vec(0, 1, 0)) };
    // Un tibia très incliné vers l'avant décolle le talon : la cheville ne fléchit pas au-delà de son amplitude.
    const lean = degrees(Math.atan2(dot(up, f), up.y));
    frame = lean > 36 ? pitch(level0, lean - 34) : level0;
  } else {
    const neutral: Frame = { f: ahead, u: up, s: cross(ahead, up) };
    // À genoux, le cou-de-pied s'allonge vers le sol ; en l'air, la cheville se relâche un peu et la pointe tombe.
    frame = kneeling ? pitch(neutral, 46) : planted ? neutral : pitch(neutral, 12);
  }
  const { foot } = FIGURE;
  const ball = add(scale(frame.f, foot.ball), scale(frame.u, -FIGURE.ankle));
  const heel = add(scale(frame.f, -foot.heel), scale(frame.u, -FIGURE.ankle));
  const toe = add(scale(frame.f, foot.toe), scale(frame.u, -FIGURE.ankle));
  return { flat: planted && upright && !kneeling, frame, ball, low: Math.min(ball.y, heel.y, toe.y) };
};

// La hauteur de repos d'un appui du nouveau corps : la cheville au-dessus de la semelle, le centre de la main,
// le bassin assis, le haut du dos couché, la tête posée.
const restOf = (anchor: V1Anchor, shape: Shape, feet: Record<Side, Foot>, native: GestureView): number => {
  if (anchor === "footA" || anchor === "footB") return -feet[sideOf(native, anchor === "footA" ? "A" : "B")].low;
  // La main posée : assez haut pour que ni les doigts d'un bras tendu vers le sol, ni un avant-bras à plat, ne
  // passent dessous.
  if (anchor === "handA" || anchor === "handB") return HAND_REST;
  // Le tronc repose sur son côté le plus bas : le dos, le ventre ou le flanc.
  if (anchor === "pelvis") return 17.5 + FIGURE.hip * Math.abs(shape.pelvis.s.y);
  if (anchor === "head") return FIGURE.head;
  return 20 + 20 * Math.abs(shape.frame.s.y) - 3 * shape.frame.f.y;
};

const offsetOf = (anchor: V1Anchor, shape: Shape, native: GestureView): Vec3 =>
  anchor === "pelvis"
    ? vec(0, 0, 0)
    : anchor === "shoulder"
      ? shape.neck
      : anchor === "head"
        ? shape.head
        : anchor === "footA" || anchor === "footB"
          ? shape.legs[sideOf(native, anchor === "footA" ? "A" : "B")].ankle
          : shape.arms[sideOf(native, anchor === "handA" ? "A" : "B")].hand;

const HAND_REST = 9.8;

// --- La barre et le matériel -------------------------------------------------------------------------------

type BarFound = { rig: NonNullable<Rig["bar"]>; shapes: Set<number> };

// Une barre : un disque de fonte centré sur la main, à chaque clé. Elle est sur le dos si la main reste derrière
// la nuque, tenue à deux mains sinon. La prise est large pour l'arraché, un peu plus que les épaules ailleurs.
const findBar = (clip: ExerciseClip, keys: readonly OldKey[]): BarFound | null => {
  if (clip.facing !== "side") return null;
  const shapes = new Set<number>();
  let back = true;
  for (const key of keys) {
    const gear = clip.gear(key.t + key.hold / 2);
    const hand = key.joints.handA;
    const plate = gear.findIndex(
      (shape) =>
        shape.kind === "disc" && shape.paint === "plate" && Math.hypot(shape.x - hand.x, shape.y - hand.y) < 1.5,
    );
    if (plate < 0) return null;
    shapes.add(plate);
    const hub = gear.findIndex(
      (shape) =>
        shape.kind === "disc" &&
        shape.paint === "iron" &&
        shape.radius === GEAR.hub &&
        Math.hypot(shape.x - hand.x, shape.y - hand.y) < 1.5,
    );
    if (hub >= 0) shapes.add(hub);
    const behind = (hand.x - key.joints.neck.x) * (key.flip < 0 ? -1 : 1);
    if (Math.hypot(hand.x - key.joints.neck.x, hand.y - key.joints.neck.y) > 34 || behind > 4) back = false;
  }
  // Une barre qui ne bouge pas est une barre fixe : on s'y suspend, on ne la porte pas.
  const first = keys[0]!.joints.handA;
  if (!keys.some((key) => Math.hypot(key.joints.handA.x - first.x, key.joints.handA.y - first.y) > 3)) return null;
  const grip = back ? 72 : /snatch|overhead-squat/.test(clip.key) ? 102 : 58;
  return { rig: { grip, hold: back ? "back" : "hands" }, shapes };
};

// L'épaisseur d'un accessoire de part et d'autre du plan où il est dessiné, selon ce qu'il est.
const DEPTH: Partial<Record<GearShape["paint"], number>> = {
  bench: 26,
  box: 46,
  step: 64,
  cone: 12,
  iron: 6,
  band: 3,
  mat: 120,
  matTop: 120,
  sand: 90,
  board: 60,
  bar: 150,
  post: 4,
  hurdle: 60,
  lane: 34,
  foul: 60,
  pole: 3,
};

type Hold = { anchor: V1Anchor; side: Side | null } | null;

// --- Le relèvement -----------------------------------------------------------------------------------------

export const liftClip = (clip: ExerciseClip): MotionClip => {
  const native = nativeOf(clip.facing);
  const ground = clip.stage.ground;
  const middle = clip.stage.width / 2;
  const keys = oldKeys(clip);
  const count = keys.length;
  const bar = findBar(clip, keys);
  const rig: Rig = { bar: bar?.rig ?? null };

  // Un point de l'ancienne scène, dans l'espace : agrandi autour du milieu du sol.
  const placed = (point: Point, height: number): Vec3 =>
    native === "side"
      ? vec(S * (point.x - middle), height, 0)
      : native === "front"
        ? vec(-8, height, -S * (point.x - middle))
        : vec(S * (point.x - middle), height, S * (point.y - ground + 140));

  // Pieds serrés ou écartés : un geste à deux pieds côte à côte les pose à la largeur des épaules, pointes ouvertes.
  const together = keys.filter((key) => key.clear.footA < TOUCH && key.clear.footB < TOUCH);
  const beside = together.filter((key) => Math.abs(key.joints.ankleA.x - key.joints.ankleB.x) < 22);
  const paired = together.length > 0 && beside.length >= together.length / 2;
  const [wide, toeOut] = native !== "side" ? [0, 6] : paired ? [26, 12] : [FIGURE.hip, 4];

  const shapes = keys.map((key) => shapeOf(key, native));
  const grounded = (key: OldKey, anchor: V1Anchor) => key.fixed[anchor] || key.clear[anchor] < TOUCH;
  const feet = keys.map((key, index) => {
    const of = (side: Side) => {
      const limb = limbOf(native, side);
      // Un genou au sol : l'ancien corps le pose à la hauteur du rayon de sa jambe.
      const kneeling = native !== "top" && ground - 15 - key.joints[`knee${limb}`].y < 4;
      return footOf(shapes[index]!, side, grounded(key, limb === "A" ? "footA" : "footB"), kneeling, toeOut);
    };
    return { R: of("R"), L: of("L") };
  });

  // L'appui principal de chaque clé : celui que l'ancien moteur tenait immobile, sinon le plus bas qui touche.
  const supports = keys.map((key): V1Anchor | null => {
    const lowest = (among: readonly V1Anchor[]) =>
      among.length === 0 ? null : among.reduce((a, b) => (key.clear[b] < key.clear[a] - 0.5 ? b : a));
    return (
      lowest(ANCHORS.filter((anchor) => key.fixed[anchor])) ??
      lowest(ANCHORS.filter((anchor) => key.clear[anchor] < TOUCH))
    );
  });

  const pelvises = keys.map((key, index): Vec3 => {
    const support = supports[index];
    const shape = shapes[index]!;
    if (!support) return placed(key.joints.pelvis, S * (ground - key.joints.pelvis.y));
    const rest = restOf(support, shape, feet[index]!, native);
    const target = placed(anchorOf(key.joints, support), rest + S * Math.max(0, key.clear[support]));
    const offset = offsetOf(support, shape, native);
    // Hors du plan de l'image, le bassin reste au milieu.
    return native === "side"
      ? vec(target.x - offset.x, target.y - offset.y, 0)
      : native === "front"
        ? vec(-8, target.y - offset.y, target.z - offset.z)
        : vec(target.x - offset.x, 18, target.z - offset.z);
  });

  // Les appuis des pieds et des mains : la place de chacun à chaque clé, puis une seule place par appui tenu.
  type Contact = { on: boolean; at: Vec3; flat: boolean };
  const contacts = (limb: "foot" | "hand", side: Side): Contact[] => {
    const anchor = `${limb}${limbOf(native, side)}` as V1Anchor;
    const found = keys.map((key, index): Contact => {
      const shape = shapes[index]!;
      // Un pied se repère par son avant-pied : c'est lui qui reste en place quand le talon se lève.
      const foot = limb === "foot" ? feet[index]![side] : null;
      const reach = foot ? foot.ball : vec(0, 0, 0);
      const free = add(pelvises[index]!, offsetOf(anchor, shape, native));
      if (!grounded(key, anchor)) return { on: false, at: add(free, reach), flat: false };
      // L'appui garde la hauteur de l'ancien geste (le sol, une boîte, une barre). Le long du sol, il est là où
      // les angles repris le mènent : le nouveau corps n'a pas les proportions de l'ancien.
      const height = restOf(anchor, shape, feet[index]!, native) + S * Math.max(0, key.clear[anchor]);
      // Deux pieds côte à côte : le second se pose à hauteur du premier, celui que l'ancien geste tenait fixe.
      const support = supports[index];
      const level =
        foot &&
        paired &&
        (support === "footA" || support === "footB") &&
        grounded(key, "footA") &&
        grounded(key, "footB")
          ? pelvises[index]!.x + offsetOf(support, shape, native).x
          : free.x;
      const at =
        native === "side"
          ? vec(level, height, limb === "foot" ? out(side) * wide : free.z)
          : native === "front"
            ? vec(limb === "foot" ? -BALL_X : free.x, height, free.z)
            : vec(free.x, free.y, free.z);
      return { on: true, at: add(at, reach), flat: foot ? foot.flat : true };
    });
    // Un appui qui dure : la même place à toutes ses clés, celle de la première. Seul un pied à plat (ou une
    // main) tient ainsi ; un pied sur la pointe ou sur le talon est réglé clé par clé.
    const held = (a: Contact, b: Contact | undefined) =>
      !!b && a.on && b.on && a.flat && b.flat && length(sub(a.at, b.at)) < 14;
    for (let index = 1; index < count; index += 1)
      if (held(found[index]!, found[index - 1])) found[index]!.at = found[index - 1]!.at;
    if (clip.loop && held(found[0]!, found[count - 1])) {
      // La boucle se referme : le premier appui est celui de la fin.
      const start = found[0]!.at;
      for (let index = 0; index < count && found[index]!.at === start; index += 1)
        found[index]!.at = found[count - 1]!.at;
    }
    return found;
  };
  const footContacts = { R: contacts("foot", "R"), L: contacts("foot", "L") };
  const handContacts = { R: contacts("hand", "R"), L: contacts("hand", "L") };

  // Le matériel : ce que l'ancien geste dessine, agrandi ; ce qui tenait à une main ou à un pied suit le nouveau corps.
  const HOLDERS = [
    "handA",
    "handB",
    "footA",
    "footB",
    "pelvis",
    "shoulder",
    "head",
  ] as const satisfies readonly V1Anchor[];
  const pointsOf = (shape: GearShape): Point[] =>
    shape.kind === "line"
      ? [shape.from, shape.to]
      : shape.kind === "curve"
        ? [shape.from, shape.control, shape.to]
        : shape.kind === "poly"
          ? [...shape.points]
          : [{ x: shape.x, y: shape.y }];
  const samples = keys.map((key) => ({ joints: key.joints, gear: clip.gear(key.t + key.hold / 2) }));
  const steady = samples.every((sample) => sample.gear.length === samples[0]!.gear.length);
  const holders: Hold[][] = (samples[0]?.gear ?? []).map((shape, index) =>
    pointsOf(shape).map((_, at): Hold => {
      if (!steady) return null;
      for (const anchor of HOLDERS) {
        const offsets = samples.map((sample) => {
          const point = pointsOf(sample.gear[index]!)[at]!;
          const holder = anchorOf(sample.joints, anchor);
          return { x: point.x - holder.x, y: point.y - holder.y, holder };
        });
        const tied = offsets.every((offset) => Math.hypot(offset.x - offsets[0]!.x, offset.y - offsets[0]!.y) < 1);
        const moves = offsets.some(
          (offset) => Math.hypot(offset.holder.x - offsets[0]!.holder.x, offset.holder.y - offsets[0]!.holder.y) > 3,
        );
        if (tied && moves)
          return {
            anchor,
            side:
              anchor === "handA" || anchor === "footA"
                ? sideOf(native, "A")
                : anchor === "handB" || anchor === "footB"
                  ? sideOf(native, "B")
                  : null,
          };
      }
      return null;
    }),
  );

  // Un objet (un kettlebell, un ballon) tenu dans des mains qui ne se quittent pas : il se tient à deux mains.
  const joined =
    native === "side" &&
    !bar &&
    keys.every(
      (key) => Math.hypot(key.joints.handA.x - key.joints.handB.x, key.joints.handA.y - key.joints.handB.y) < 12,
    ) &&
    holders.some(
      (held, index) =>
        held.some((hold) => hold?.anchor === "handA") &&
        !(
          samples[0]!.gear[index]!.kind === "disc" &&
          (samples[0]!.gear[index] as { radius: number }).radius === GEAR.dumbbell
        ),
    );

  const armReach = (grip: number) =>
    Math.sqrt(Math.max(1, span(FIGURE.upperArm, LOWER_ARM, SLACK.arm) ** 2 - (grip - FIGURE.shoulder) ** 2)) * 0.995;

  const controls = keys.map((key, index): Controls => {
    const shape = shapes[index]!;
    const pelvis = pelvises[index]!;
    const turn = anglesOf(shape.pelvis);
    const c: Controls = {
      ...STAND,
      pelvisX: pelvis.x,
      pelvisY: pelvis.y,
      pelvisZ: pelvis.z,
      pelvisYaw: turn.yaw,
      pelvisRoll: turn.roll,
      pelvisPitch: turn.pitch,
      lumbar: shape.bend / 2,
      thoracic: shape.bend / 2,
      neck: Math.min(LIMITS.neck[1], Math.max(LIMITS.neck[0], 0.6 * shape.nod)),
      head: Math.min(30, Math.max(-30, 0.4 * shape.nod)),
    };
    for (const side of SIDES) {
      const k = out(side);
      // Le pied : planté, il est à sa place d'appui ; libre, au bout de la jambe.
      const foot = feet[index]![side];
      const contact = footContacts[side][index]!;
      const ball = contact.at;
      const ankle = sub(ball, foot.ball);
      const angles = anglesOf(foot.frame);
      c[`foot${side}X`] = ball.x;
      c[`foot${side}Z`] = ball.z;
      c[`foot${side}Lift`] = foot.flat || native === "top" ? Math.max(0, ball.y) : ball.y;
      c[`foot${side}Yaw`] = k * angles.yaw;
      c[`foot${side}Roll`] = k * angles.roll;
      c[`foot${side}Heel`] = angles.pitch;
      // Le genou se plie vers l'avant de la cuisse : jamais à l'envers.
      const chord = normalize(sub(ankle, add(pelvis, shape.legs[side].hip)));
      const bend = cross(shape.pelvis.s, chord);
      // À plat, le genou suit la pointe du pied : il s'ouvre du même angle.
      const open = foot.flat ? (k * toeOut * Math.PI) / 180 : 0;
      c[`knee${side}Forward`] = bend.x * Math.cos(open) - bend.z * Math.sin(open);
      c[`knee${side}Up`] = bend.y;
      c[`knee${side}Side`] = k * (bend.x * Math.sin(open) + bend.z * Math.cos(open));

      // La main : libre, elle suit le buste ; posée, elle tient à sa place dans la scène.
      const arm = shape.arms[side];
      const touch = handContacts[side][index]!;
      const hand = vec(touch.at.x, Math.max(HAND_REST, touch.at.y), touch.at.z);
      const reach = sub(hand, add(pelvis, shape.neck));
      c[`hand${side}Forward`] = dot(reach, shape.frame.f);
      c[`hand${side}Up`] = dot(reach, shape.frame.u);
      // Un objet tenu à deux mains : elles se rejoignent au milieu du corps.
      c[`hand${side}Out`] = joined ? 6 : k * dot(reach, shape.frame.s);
      c[`hand${side}Pin`] = touch.on ? 1 : 0;
      c[`hand${side}X`] = hand.x;
      c[`hand${side}Y`] = hand.y;
      c[`hand${side}Z`] = hand.z;
      c[`elbow${side}Forward`] = dot(arm.bend, shape.frame.f);
      c[`elbow${side}Up`] = dot(arm.bend, shape.frame.u);
      c[`elbow${side}Out`] = k * dot(arm.bend, shape.frame.s) + (bar ? 0.5 : 0);
    }
    if (bar) {
      // La barre est dans la main la plus proche de l'ancien geste, jamais plus loin que les bras ne portent.
      const arm = shape.arms[sideOf(native, "A")];
      const from = add(pelvis, vec(arm.shoulder.x, arm.shoulder.y, 0));
      const reach = sub(add(pelvis, vec(arm.hand.x, arm.hand.y, 0)), from);
      const most = armReach(bar.rig.grip);
      const held = add(from, scale(reach, Math.min(1, most / Math.max(1e-6, length(reach)))));
      c.barX = held.x;
      c.barY = Math.max(BARBELL.plate, held.y);
      if (bar.rig.hold === "back") {
        const racked = solve(c, { bar: null });
        const rack = add(racked.neck, add(scale(racked.frames.thorax.f, -15), scale(racked.frames.thorax.u, -3)));
        c.barX = rack.x;
        c.barY = rack.y;
      }
    }
    const solved = () => solve(c, bar?.rig.hold === "back" ? { bar: null } : rig);
    const lowest = (body: Solved, keep: (id: string) => boolean) =>
      Math.min(
        ...skin(body)
          .parts.filter((part) => keep(part.id))
          .flatMap((part) => part.spheres.map(({ c: at, r }) => at.y - r)),
      );
    for (let pass = 0; pass < 2; pass += 1) {
      const body = solved();
      // Un pied qui n'est pas à plat (sur la pointe, sur le talon, en l'air) se règle sur la chaussure dessinée :
      // en appui, elle touche juste ; libre, elle ne passe pas sous le sol.
      for (const side of SIDES) {
        if (feet[index]![side].flat) continue;
        const anchor = `foot${limbOf(native, side)}` as V1Anchor;
        const low = lowest(body, (id) => id === `shoe${side}`);
        const wanted = grounded(key, anchor) ? S * Math.max(0, key.clear[anchor]) : Math.max(low, 0);
        c[`foot${side}Lift`] += wanted - low;
      }
      // Ce qui passerait sous le sol remonte le bassin : un dos, une tête, un coude, un genou posés. Une marge
      // d'une unité, pour que le corps ne s'enfonce pas entre deux clés.
      const sink =
        Math.min(
          lowest(body, (id) => !id.startsWith("shoe") && !id.startsWith("plate") && !id.startsWith("bar")),
          body.head.y - FIGURE.head,
        ) - 1;
      if (sink < 0) {
        c.pelvisY -= sink;
        if (bar) c.barY -= sink;
      }
    }
    return c;
  });

  // Les angles restent continus d'une clé à l'autre : un corps qui tourne ne repart pas en arrière.
  const ANGLES = ["pelvisYaw", "pelvisPitch", "footRYaw", "footLYaw", "footRHeel", "footLHeel"] as const;
  for (let index = 1; index < count; index += 1)
    for (const name of ANGLES) {
      const [here, before] = [controls[index]!, controls[index - 1]!];
      here[name] -= 360 * Math.round((here[name] - before[name]) / 360);
    }
  // La direction du genou est donnée dans la scène, pas par rapport au pied : l'ouverture du pied s'en retranche.
  for (const c of controls) for (const side of SIDES) c[`knee${side}Out`] = -c[`foot${side}Yaw`];

  // Un pied reste en appui d'une clé à la suivante s'il y est exactement au même endroit.
  const sameFoot = (a: Controls, b: Controls, side: Side) =>
    (["X", "Z", "Lift", "Yaw", "Roll"] as const).every(
      (name) => Math.abs(a[`foot${side}${name}`] - b[`foot${side}${name}`]) < 1e-9,
    );
  const airborne = (index: number, side: Side) => {
    if (!footContacts[side][index]!.on) return true;
    const near = [
      controls[index - 1] ?? (clip.loop ? controls[count - 1] : undefined),
      controls[index + 1] ?? (clip.loop ? controls[0] : undefined),
    ];
    return !near.some((other) => other && other !== controls[index] && sameFoot(controls[index]!, other, side));
  };

  const guides = clip.stills.map((still) =>
    keys.reduce(
      (best, key, index) =>
        Math.abs(key.t + key.hold / 2 - still) < Math.abs(keys[best]!.t + keys[best]!.hold / 2 - still) ? index : best,
      0,
    ),
  );
  const drafts = keys.map((key, index): KeyDraft => {
    const before = keys[(index - 1 + count) % count]!;
    const elapsed = index === 0 ? 1 - (before.t + before.hold) : key.t - (before.t + before.hold);
    const cut = !clip.loop && index === 0;
    const guide = guides.indexOf(index);
    const air = SIDES.filter((side) => {
      if (airborne(index, side)) return true;
      // Un appui qui change de place sans quitter le sol entre deux clés : la seconde ne compte pas comme appui.
      const last = index > 0 ? index - 1 : clip.loop ? count - 1 : -1;
      const previous = controls[last];
      return (
        !!previous &&
        footContacts[side][last]!.on &&
        !airborne(last, side) &&
        !sameFoot(previous, controls[index]!, side)
      );
    });
    return {
      id: `k${index}`,
      set: controls[index]!,
      ...(key.hold > 0 ? { hold: Math.max(1, key.hold * clip.duration) } : {}),
      move: {
        ms: cut ? 1 : Math.max(1, elapsed * clip.duration),
        curve: "linear",
        phase: `p${index}`,
        ...(cut ? { cut: true } : {}),
      },
      face: clip.face(key.t + key.hold / 2),
      ...(air.length > 0 ? { air } : {}),
      ...(guide >= 0 ? { guide, still: true } : {}),
    };
  });

  // Un point du nouveau corps, dans le plan de l'image d'origine (x vers la droite, y vers le bas), et sa profondeur.
  const flat = (point: Vec3) =>
    native === "side"
      ? { x: point.x, y: -point.y, at: point.z }
      : native === "front"
        ? { x: -point.z, y: -point.y, at: point.x }
        : { x: point.x, y: point.z, at: point.y };
  const holderPoint = (body: Solved, hold: NonNullable<Hold>, side: Side | null): Vec3 =>
    hold.anchor === "pelvis"
      ? body.pelvis
      : hold.anchor === "shoulder"
        ? body.neck
        : hold.anchor === "head"
          ? body.head
          : hold.anchor === "footA" || hold.anchor === "footB"
            ? body.legs[side ?? hold.side!].ankle
            : body.arms[side ?? hold.side!].hand;

  const props = (t: number, body: Solved): Prop[] => {
    const time = ((t % 1) + 1) % 1;
    const gear = clip.gear(time);
    if (gear.every((shape) => shape.paint === "floor")) return [];
    const { pose, root } = clip.frame(time);
    const joints = oldJoints(pose, root, clip.facing);
    const result: Prop[] = [];
    gear.forEach((shape, index) => {
      if (shape.paint === "floor" || bar?.shapes.has(index)) return;
      const held = steady ? (holders[index] ?? []) : [];
      // Un haltère dans la main la plus proche : l'autre main en tient un aussi.
      const pair =
        shape.kind === "disc" && shape.radius === GEAR.dumbbell && native === "side" && held[0]?.anchor === "handA";
      for (const side of pair ? SIDES : [null]) {
        let at = 0;
        let follows = false;
        const move = (point: Point, n: number): Point => {
          const hold = held[n] ?? null;
          if (!hold)
            return native === "top"
              ? { x: S * (point.x - middle), y: S * (point.y - ground + 140) }
              : { x: S * (point.x - middle), y: S * (point.y - ground) };
          const anchor = flat(holderPoint(body, hold, side));
          const origin = anchorOf(joints, hold.anchor);
          at = anchor.at;
          follows = true;
          return { x: anchor.x + S * (point.x - origin.x), y: anchor.y + S * (point.y - origin.y) };
        };
        const geometry: Geometry =
          shape.kind === "line"
            ? {
                kind: "line",
                from: move(shape.from, 0),
                to: move(shape.to, 1),
                width: shape.width * S,
                ...(shape.cap ? { cap: shape.cap } : {}),
              }
            : shape.kind === "curve"
              ? {
                  kind: "curve",
                  from: move(shape.from, 0),
                  control: move(shape.control, 1),
                  to: move(shape.to, 2),
                  width: shape.width * S,
                }
              : shape.kind === "poly"
                ? { kind: "poly", points: shape.points.map(move) }
                : shape.kind === "disc"
                  ? { kind: "disc", ...move(shape, 0), radius: shape.radius * S }
                  : {
                      kind: "rect",
                      ...move(shape, 0),
                      width: shape.width * S,
                      height: shape.height * S,
                      radius: (shape.radius ?? 0) * S,
                    };
        const half =
          shape.kind !== "disc"
            ? (DEPTH[shape.paint] ?? 20)
            : follows
              ? Math.min(14, shape.radius * S * 0.6)
              : shape.paint === "ball"
                ? shape.radius * S
                : 10;
        // Une ligne qui traverse toute la scène est un décor : elle ne compte pas dans le cadrage.
        const backdrop = shape.kind === "line" && !follows && Math.abs(shape.to.x - shape.from.x) > 300;
        result.push({
          paint: shape.paint,
          shape: geometry,
          native,
          // Tenu à deux mains, l'objet est au milieu du corps.
          at: follows ? (joined ? body.pelvis.z : at) : 0,
          half,
          ...(shape.front ? { front: true } : {}),
          ...(shape.scroll || backdrop ? { scroll: true } : {}),
        });
      }
    });
    return result;
  };

  return gesture({ key: clip.key, athlete: clip.athlete, rig, keys: drafts, props, floor: true });
};
