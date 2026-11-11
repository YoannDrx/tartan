// Le squelette de la mascotte, en données : une seule table pour le site, l'application et le jeu.

export const BODY = { torso: 96, shoulder: 88, neck: 132, arm: 48, forearm: 46, thigh: 62, shin: 62 };

// Une pose : l'orientation du corps entier, puis l'angle de chaque articulation, en degrés.
export type Pose = {
  rot: number;
  flip: number;
  sx: number;
  sy: number;
  lean: number;
  head: number;
  armA: number;
  elbowA: number;
  armB: number;
  elbowB: number;
  legA: number;
  kneeA: number;
  legB: number;
  kneeB: number;
};

export type Point = { x: number; y: number };

// Les angles qu'un os peut suivre. L'orientation du corps entier (rot, flip, sx, sy) n'en fait pas partie.
export type Angle = Exclude<keyof Pose, "rot" | "flip" | "sx" | "sy">;

// Ce qu'un rendu doit colorer. Les couleurs elles-mêmes viennent de l'hôte, donc des jetons de design.
export type BasePaintRole = "skin" | "tee" | "shorts" | "shoe" | "hair" | "eye";
// Un athlète du groupe porte en plus un dossard : son fond, puis son numéro.
export type PaintRole = BasePaintRole | "bib" | "mark";
export type Paint = Record<BasePaintRole, string>;
export type AthletePaint = Record<PaintRole, string>;

export type Shape =
  // Un trait à bouts ronds, de l'articulation vers le bas de l'os.
  | { kind: "limb"; length: number; width: number; paint: PaintRole }
  | { kind: "box"; x: number; y: number; width: number; height: number; radius: number; paint: PaintRole }
  | { kind: "disc"; x: number; y: number; radius: number; paint: PaintRole }
  // Une calotte : le haut d'un disque centré sur l'os, coupé par une corde horizontale.
  | { kind: "cap"; radius: number; chord: Point; paint: PaintRole }
  // Un trait à bouts ronds entre deux points : un œil plissé, une mèche, un chiffre de dossard.
  | { kind: "stroke"; from: Point; to: Point; width: number; paint: PaintRole }
  // Une part de disque, entre deux angles en degrés (sens horaire depuis la droite), fermée par sa corde.
  | { kind: "segment"; x: number; y: number; radius: number; from: number; to: number; paint: PaintRole };

export type BoneId =
  | "torso"
  | "head"
  | "eyes"
  | "upperArmA"
  | "forearmA"
  | "upperArmB"
  | "forearmB"
  | "thighA"
  | "shinA"
  | "thighB"
  | "shinB"
  // Ce qu'un athlète du groupe ajoute au corps de base (rig.ts).
  | "hairBack"
  | "bib";

export type Bone = {
  id: BoneId;
  // L'os qui le porte. `null` : il part du bassin.
  parent: BoneId | null;
  // Où il s'accroche, dans le repère de son parent.
  offset: Point;
  // L'angle de la pose qui le fait tourner, et dans quel sens.
  turn: { by: Angle; sign: 1 | -1 } | null;
  shapes: Shape[];
  // Ordre d'empilement : le plus petit est dessiné en premier, donc derrière.
  z: number;
  // Ses formes se lisent : quand le corps se retourne, elles ne passent pas en miroir.
  upright?: boolean;
};

const ORIGIN: Point = { x: 0, y: 0 };

const arm = (side: "A" | "B", z: number): Bone[] => [
  {
    id: `upperArm${side}`,
    parent: "torso",
    offset: { x: 0, y: -BODY.shoulder },
    turn: { by: `arm${side}`, sign: -1 },
    shapes: [{ kind: "limb", length: BODY.arm, width: 26, paint: "skin" }],
    z,
  },
  {
    id: `forearm${side}`,
    parent: `upperArm${side}`,
    offset: { x: 0, y: BODY.arm },
    turn: { by: `elbow${side}`, sign: -1 },
    shapes: [{ kind: "limb", length: BODY.forearm, width: 24, paint: "skin" }],
    z: z + 1,
  },
];

const leg = (side: "A" | "B", z: number): Bone[] => [
  {
    id: `thigh${side}`,
    parent: null,
    offset: ORIGIN,
    turn: { by: `leg${side}`, sign: -1 },
    shapes: [
      { kind: "limb", length: BODY.thigh, width: 32, paint: "skin" },
      { kind: "limb", length: BODY.thigh * 0.56, width: 38, paint: "shorts" },
    ],
    z,
  },
  {
    id: `shin${side}`,
    parent: `thigh${side}`,
    offset: { x: 0, y: BODY.thigh },
    turn: { by: `knee${side}`, sign: 1 },
    shapes: [
      { kind: "limb", length: BODY.shin, width: 30, paint: "skin" },
      { kind: "box", x: -18, y: BODY.shin - 8, width: 66, height: 30, radius: 15, paint: "shoe" },
    ],
    z: z + 1,
  },
];

// Les os, parents avant enfants. Le côté B passe derrière le corps, le côté A devant.
export const SKELETON: readonly Bone[] = [
  {
    id: "torso",
    parent: null,
    offset: ORIGIN,
    turn: { by: "lean", sign: 1 },
    shapes: [
      { kind: "box", x: -36, y: -BODY.torso - 8, width: 72, height: BODY.torso + 24, radius: 28, paint: "tee" },
      { kind: "box", x: -37, y: -14, width: 74, height: 34, radius: 16, paint: "shorts" },
    ],
    z: 6,
  },
  {
    id: "head",
    parent: "torso",
    offset: { x: 0, y: -BODY.neck },
    turn: { by: "head", sign: 1 },
    shapes: [
      { kind: "disc", x: 0, y: 0, radius: 44, paint: "skin" },
      { kind: "cap", radius: 44, chord: { x: 43, y: -10 }, paint: "hair" },
    ],
    z: 7,
  },
  {
    id: "eyes",
    parent: "head",
    offset: ORIGIN,
    turn: null,
    shapes: [
      { kind: "disc", x: 15, y: 6, radius: 6, paint: "eye" },
      { kind: "disc", x: 31, y: 6, radius: 6, paint: "eye" },
    ],
    z: 8,
  },
  ...arm("A", 9),
  ...arm("B", 2),
  ...leg("A", 4),
  ...leg("B", 0),
];

// Les mêmes os, dans l'ordre où les rendus les dessinent.
export const STACK: readonly Bone[] = [...SKELETON].sort((a, b) => a.z - b.z);

const BY_ID = new Map(SKELETON.map((bone) => [bone.id, bone]));

// Le chemin du bassin jusqu'à un os : une suite de décalages et de rotations, à appliquer dans l'ordre.
// `mirror` retourne l'os sur lui-même, pour qu'un numéro reste lisible sur un corps vu de dos.
export type Step = { move: Point } | { turn: number } | { mirror: true };

// `among` : les os où chercher le parent. Par défaut le corps de base ; un athlète du groupe donne les siens.
export const chain = (bone: Bone, pose: Pose, among: ReadonlyMap<BoneId, Bone> = BY_ID): Step[] => {
  const steps: Step[] = bone.parent ? chain(among.get(bone.parent)!, pose, among) : [];
  if (bone.offset.x !== 0 || bone.offset.y !== 0) steps.push({ move: bone.offset });
  if (bone.turn) steps.push({ turn: bone.turn.sign * pose[bone.turn.by] });
  if (bone.upright && pose.flip < 0) steps.push({ mirror: true });
  return steps;
};

// Matrice affine [a, b, c, d, e, f] : x' = a·x + c·y + e, y' = b·x + d·y + f.
type Matrix = [number, number, number, number, number, number];

const then = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const moved = (m: Matrix, { x, y }: Point) => then(m, [1, 0, 0, 1, x, y]);
const turned = (m: Matrix, degrees: number) => {
  const angle = (degrees * Math.PI) / 180;
  return then(m, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
};
const place = (m: Matrix, { x, y }: Point): Point => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

// Les points d'accroche des accessoires. Un pied s'accroche à la cheville, au bout du tibia.
export const ANCHORS = {
  pelvis: { bone: null, at: ORIGIN },
  head: { bone: "head", at: ORIGIN },
  handA: { bone: "forearmA", at: { x: 0, y: BODY.forearm } },
  handB: { bone: "forearmB", at: { x: 0, y: BODY.forearm } },
  footA: { bone: "shinA", at: { x: 0, y: BODY.shin } },
  footB: { bone: "shinB", at: { x: 0, y: BODY.shin } },
} satisfies Record<string, { bone: BoneId | null; at: Point }>;
export type Anchor = keyof typeof ANCHORS;

// Cinématique directe : où se trouvent les mains, les pieds, la tête et le bassin pour une pose donnée,
// dans le repère de la scène quand `root` donne la position du bassin, autour de lui sinon.
export const jointPositions = (pose: Pose, root: Point = ORIGIN): Record<Anchor, Point> => {
  const body = then(turned(moved([1, 0, 0, 1, 0, 0], root), pose.rot), [pose.flip * pose.sx, 0, 0, pose.sy, 0, 0]);
  const out = {} as Record<Anchor, Point>;
  for (const name of Object.keys(ANCHORS) as Anchor[]) {
    const { bone, at } = ANCHORS[name];
    const steps = bone ? chain(BY_ID.get(bone)!, pose) : [];
    const matrix = steps.reduce(
      (m, step) => ("move" in step ? moved(m, step.move) : "turn" in step ? turned(m, step.turn) : m),
      body,
    );
    out[name] = place(matrix, at);
  }
  return out;
};
