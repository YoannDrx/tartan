// Le geste d'un exercice du catalogue : un athlète du groupe, de profil (ou de face quand le geste se lit de face),
// qui enchaîne les positions du guide en boucle.
// Une position par ligne du guide (installation, puis chaque étape) : la lecture et le texte avancent ensemble.
import { clamp, sample, samplePose, type Frame, type Key } from "./clip";
import { pinned, type EventId, type Stage } from "./event";
import { POSES } from "./poses";
import type { Geometry, PropRole } from "./props";
import type { Face } from "./rig";
import { BODY, jointPositions, type Anchor, type Point, type Pose, type View } from "./skeleton";

// Ce que les exercices posent dans la scène. Les couleurs viennent des jetons de design.
// Les accessoires des épreuves (tapis, barre de saut) servent aussi aux exercices tirés d'une épreuve.
export type GearRole = "floor" | "plate" | "iron" | "bench" | "box" | "band" | "ball" | "cone" | "step" | PropRole;
export type GearPaint = Record<GearRole, string>;
// `front` : dessiné devant l'athlète. Sinon derrière lui.
// `scroll` : un repère qui défile, hors du cadrage du geste.
export type GearShape = Geometry & { paint: GearRole; front?: boolean; scroll?: boolean };

// La scène commune : assez large pour un corps allongé, assez haute pour des bras tendus au-dessus d'une barre.
export const GYM: Stage = { width: 640, height: 440, ground: 400 };
const MIDDLE = GYM.width / 2;

// La hauteur, au-dessus du sol, du point d'accroche quand il touche le sol : la cheville au-dessus de la semelle,
// le centre de la main, le bassin assis, le sommet de l'épaule… arrondis sur le dessin, pas sur l'anatomie.
const REST: Record<Anchor, number> = { footA: 16, footB: 16, handA: 15, handB: 15, pelvis: 24, head: 44, shoulder: 30 };

// Une position du guide. `pose` : ce qui change par rapport à la station debout.
// `on` : l'appui qui ne bouge pas (un pied, les mains, le bassin) ; par défaut le pied avant.
// `at` : où se trouve cet appui ; par défaut au sol, au milieu de la scène, décalé de `x`.
// `root` : la position du bassin, quand rien ne touche le sol (un saut).
export type Position = {
  pose: Partial<Pose>;
  on?: Anchor;
  x?: number;
  at?: Point;
  root?: Point;
  face?: Face;
  // La part de son temps où la position est tenue, avant de passer à la suivante.
  hold?: number;
  // Des clés de passage vers la position suivante : une extension, une phase d'envol.
  via?: Omit<Position, "via" | "hold">[];
};

type Placed = { t: number; pose: Pose; root: Point; support: { anchor: Anchor; at: Point } | null; face: Face };

export type ExerciseClip = {
  key: string;
  athlete: EventId;
  stage: Stage;
  // Durée d'une boucle à vitesse réelle, en millisecondes.
  duration: number;
  // Une plage de temps par ligne du guide, dans l'ordre : installation, puis étapes.
  positions: readonly { from: number; to: number }[];
  // L'image tenue de chaque position : la frise du mouvement réduit.
  stills: readonly number[];
  // Le cadre qui contient tout le geste, au format 3:2 : `x y largeur hauteur`, prêt pour un viewBox.
  view: string;
  frame(t: number): Frame;
  gear(t: number): GearShape[];
  face(t: number): Face;
  // Faux pour un geste qui finit ailleurs qu'il ne commence (un saut à la barre) : la lecture repart du début.
  loop: boolean;
  // L'inclinaison de toute la scène, en degrés : une côte. Le rendu la tourne autour du centre du cadre.
  tilt: number;
  // Le point de vue : de profil, de face (pas chassés, élévations latérales), de dos (allongé sur le ventre).
  // Le rendu prend le squelette et le visage qui lui correspondent (`athleteRig(id, face, facing)`).
  facing: View;
  // La série de relecture : les gestes vus de face arrivés après la validation des familles se valident à part,
  // pour qu'aucun ne soit présenté comme relu avant que le fondateur l'ait vu. Absent : la première série.
  batch?: MotionBatch;
};

export const MOTION_BATCHES = ["face"] as const;
export type MotionBatch = (typeof MOTION_BATCHES)[number];

const place = (position: Omit<Position, "via" | "hold">, t: number, fallback: Face, view: View): Placed => {
  const pose: Pose = { ...POSES.stand, ...position.pose };
  const face = position.face ?? fallback;
  if (position.root) return { t, pose, root: position.root, support: null, face };
  const anchor = position.on ?? "footA";
  const at = position.at ?? { x: MIDDLE + (position.x ?? 0), y: GYM.ground - REST[anchor] };
  return { t, pose, root: pinned(pose, anchor, at, view), support: { anchor, at }, face };
};

const LIMBS = ["footA", "footB", "handA", "handB"] as const;

// Entre deux clés, l'interpolation peut enfoncer un pied ou une main de quelques unités : le sol repousse le corps.
const grounded = ({ pose, root }: Frame, view: View = "side"): Frame => {
  const joints = jointPositions(pose, root, view);
  const sink = Math.max(0, ...LIMBS.map((anchor) => joints[anchor].y - (GYM.ground - REST[anchor])));
  return { pose, root: { x: root.x, y: root.y - sink } };
};

const same = (a: Placed["support"], b: Placed["support"]) =>
  !!a && !!b && a.anchor === b.anchor && Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) < 0.5;

export type ExerciseDraft = {
  key: string;
  athlete: EventId;
  duration?: number;
  stage?: Stage;
  positions: readonly Position[];
  // Les accessoires à chaque image : une barre aux mains, un banc sous le dos.
  gear?: (frame: Frame, joints: Record<Anchor, Point>, t: number) => GearShape[];
  // Le visage par défaut : neutre, sauf l'effort que demande la position.
  face?: Face;
  // Le point de vue, de profil par défaut.
  facing?: View;
  batch?: MotionBatch;
};

export const exercise = (draft: ExerciseDraft): ExerciseClip => {
  const view = draft.facing ?? "side";
  const count = draft.positions.length;
  const slot = 1 / count;
  const keys: Placed[] = [];
  const positions: { from: number; to: number }[] = [];
  const stills: number[] = [];
  draft.positions.forEach((position, index) => {
    const start = index * slot;
    const held = start + slot * (position.hold ?? 0.45);
    const first = place(position, start, draft.face ?? "neutral", view);
    keys.push(first, { ...first, t: held });
    positions.push({ from: start, to: start + slot });
    stills.push((start + held) / 2);
    const via = position.via ?? [];
    via.forEach((step, n) =>
      keys.push(place(step, held + ((start + slot - held) * (n + 1)) / (via.length + 1), first.face, view)),
    );
  });
  // La boucle se referme sur la première position.
  keys.push({ ...keys[0]!, t: 1 });

  const poseTrack: Key<Pose>[] = keys.map(({ t, pose }) => ({ t, v: pose }));
  const rootTrack: Key<Point>[] = keys.map(({ t, root }) => ({ t, v: root }));
  const around = (t: number) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1]!.t) i += 1;
    return [keys[i]!, keys[i + 1]!] as const;
  };

  const frame = (time: number): Frame => {
    const t = clamp(time);
    const pose = samplePose(poseTrack, t);
    const [k1, k2] = around(t);
    // Un appui commun aux deux clés reste immobile : le bassin se déduit de lui à chaque image.
    const root = same(k1.support, k2.support)
      ? pinned(pose, k1.support!.anchor, k1.support!.at, view)
      : sample(rootTrack, t);
    return grounded({ pose, root }, view);
  };

  const gearAt = (time: number): GearShape[] => {
    const t = clamp(time);
    const current = frame(t);
    return [
      {
        kind: "line",
        from: { x: 0, y: GYM.ground + 6 },
        to: { x: GYM.width, y: GYM.ground + 6 },
        width: 4,
        cap: "butt",
        paint: "floor",
      },
      ...(draft.gear?.(current, jointPositions(current.pose, current.root, view), t) ?? []),
    ];
  };

  return {
    key: draft.key,
    athlete: draft.athlete,
    stage: draft.stage ?? GYM,
    duration: draft.duration ?? 4000,
    positions,
    stills,
    frame,
    view: framing(frame, gearAt, view),
    facing: view,
    ...(draft.batch ? { batch: draft.batch } : {}),
    loop: true,
    tilt: 0,
    gear: gearAt,
    face: (time) => {
      const [k1, k2] = around(clamp(time));
      return clamp(time) - k1.t < k2.t - clamp(time) ? k1.face : k2.face;
    },
  };
};

// Un geste décrit image par image plutôt que par positions : une course, des rebonds, une épreuve du groupe.
// `cuts` : le début des lignes 2, 3 et 4 du guide dans la boucle.
export type MotionDraft = {
  key: string;
  athlete: EventId;
  duration?: number;
  stage?: Stage;
  frame: (t: number) => Frame;
  gear?: (frame: Frame, joints: Record<Anchor, Point>, t: number) => GearShape[];
  face?: (t: number) => Face;
  cuts?: readonly [number, number, number];
  stills?: readonly number[];
  loop?: boolean;
  view?: string;
  floor?: boolean;
  tilt?: number;
  // Le point de vue : `view` est déjà le cadre (un viewBox), d'où ce nom.
  facing?: View;
};

export const motion = (draft: MotionDraft): ExerciseClip => {
  const [a, b, c] = draft.cuts ?? [0.25, 0.5, 0.75];
  const positions = [
    { from: 0, to: a },
    { from: a, to: b },
    { from: b, to: c },
    { from: c, to: 1 },
  ];
  const facing = draft.facing ?? "side";
  const frame = (time: number) => {
    const current = draft.frame(clamp(time));
    return draft.stage ? current : grounded(current, facing);
  };
  const gearAt = (time: number): GearShape[] => {
    const t = clamp(time);
    const current = frame(t);
    const own = draft.gear?.(current, jointPositions(current.pose, current.root, facing), t) ?? [];
    return draft.floor === false
      ? own
      : [
          {
            kind: "line",
            from: { x: 0, y: GYM.ground + 6 },
            to: { x: GYM.width, y: GYM.ground + 6 },
            width: 4,
            cap: "butt",
            paint: "floor",
          },
          ...own,
        ];
  };
  return {
    key: draft.key,
    athlete: draft.athlete,
    stage: draft.stage ?? GYM,
    duration: draft.duration ?? 4000,
    positions,
    stills: draft.stills ?? positions.map(({ from, to }) => (from + to) / 2),
    view: draft.view ?? framing(frame, gearAt, facing),
    facing,
    loop: draft.loop ?? true,
    tilt: draft.tilt ?? 0,
    frame,
    gear: gearAt,
    face: draft.face ?? (() => "neutral"),
  };
};

// Les images fixes d'un geste cyclique (`cycles` foulées ou rebonds par boucle) : une par ligne du guide,
// chacune à une phase différente du cycle, pour que la frise montre le mouvement entier.
export const cycleStills = (cycles: number) =>
  [0.1, 0.35, 0.6, 0.85].map((phase, i) => {
    const [from, to] = [i / 4, (i + 1) / 4];
    let k = Math.floor(from * cycles);
    if ((k + phase) / cycles < from) k += 1;
    const t = (k + phase) / cycles;
    return t < to ? t : (from + to) / 2;
  });

// Une grandeur qui s'accumule au rythme `rate(t)` (la foulée, le chemin parcouru), mise à l'échelle pour valoir
// exactement `total` à la fin de la boucle : la boucle se referme sur une foulée entière, un repère entier.
export const accumulate = (rate: (t: number) => number, total: number, steps = 400) => {
  const table = [0];
  for (let i = 1; i <= steps; i += 1) table.push(table[i - 1]! + (rate((i - 0.5) / steps) * 1) / steps);
  const end = table[steps]!;
  return (t: number) => {
    const x = clamp(t) * steps;
    const i = Math.min(steps - 1, Math.floor(x));
    return (total * (table[i]! + (table[i + 1]! - table[i]!) * (x - i))) / end;
  };
};

// La hauteur du bassin debout, pieds à plat au milieu de la scène.
export const STAND_ROOT: Point = pinned(POSES.stand, "footA", { x: MIDDLE, y: GYM.ground - 16 });
// Le bassin d'un corps en l'air : `height` au-dessus de sa hauteur debout, décalé de `dx`.
export const air = (height: number, dx = 0): Point => ({ x: STAND_ROOT.x + dx, y: STAND_ROOT.y - height });

// Des repères au sol qui défilent vers l'arrière : l'athlète avance sans quitter le centre de la scène,
// et la boucle se referme sans retour en arrière. `distance` : le chemin parcouru en une boucle.
export const marks = (t: number, distance: number, every = 160, paint: GearRole = "lane"): GearShape[] =>
  track(t * distance, every, paint);

// Les mêmes repères, décalés d'une distance parcourue quelconque (une course qui accélère).
export const track = (offset: number, every = 160, paint: GearRole = "lane"): GearShape[] => {
  const shift = ((offset % every) + every) % every;
  return Array.from({ length: Math.ceil(GYM.width / every) + 2 }, (_, i) => {
    const x = i * every - shift;
    return { kind: "rect", x, y: GYM.ground + 2, width: 26, height: 8, radius: 2, paint, scroll: true } as GearShape;
  });
};

// Le cadre du geste : les appuis et les accessoires de toute la boucle, une marge pour la tête et les pieds,
// puis élargi au format 3:2 autour de leur centre, sans descendre sous le sol de plus que la marge.
const framing = (frame: (t: number) => Frame, gear: (t: number) => GearShape[], view: View) => {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (point: Point, pad: number) => {
    xs.push(point.x - pad, point.x + pad);
    ys.push(point.y - pad, point.y + pad);
  };
  for (let i = 0; i <= 64; i += 1) {
    const { pose, root } = frame(i / 64);
    const joints = jointPositions(pose, root, view);
    add(joints.head, 64);
    for (const anchor of ["handA", "handB", "pelvis"] as const) add(joints[anchor], 28);
    for (const anchor of ["footA", "footB"] as const) add(joints[anchor], 52);
    for (const shape of gear(i / 64).filter((item) => !item.scroll)) {
      if (shape.kind === "disc") add({ x: shape.x, y: shape.y }, shape.radius + 6);
      else if (shape.kind === "rect") {
        add({ x: shape.x, y: shape.y }, 6);
        add({ x: shape.x + shape.width, y: shape.y + shape.height }, 6);
      } else if (shape.kind === "poly") shape.points.forEach((point) => add(point, 6));
    }
  }
  const [left, right, top] = [Math.min(...xs), Math.max(...xs), Math.min(...ys)];
  const bottom = Math.min(Math.max(...ys), GYM.ground + 24);
  let [width, height] = [right - left, bottom - top];
  if (width / height < 1.5) width = height * 1.5;
  else height = width / 1.5;
  const x = (left + right) / 2 - width / 2;
  const y = bottom - height;
  const r = (value: number) => Math.round(value);
  return `${r(x)} ${r(y)} ${r(width)} ${r(height)}`;
};

// La position tenue d'une ligne du guide : l'instant à montrer quand la lecture est arrêtée sur elle.
export const positionAt = (clip: ExerciseClip, t: number) => {
  const index = clip.positions.findIndex((position) => t < position.to);
  return index < 0 ? clip.positions.length - 1 : index;
};

// --- Accessoires ---------------------------------------------------------------------------------

// Les dimensions, dans les unités du squelette (une cuisse mesure 62).
export const GEAR = { plate: 30, hub: 7, dumbbell: 13, kettlebell: 17, ball: 22, bench: 52, box: 70 };

// Une barre vue de profil : le disque côté spectateur, centré sur la main, et le manchon.
// Devant le visage (barre devant les épaules, bras tendus au-dessus), il passe derrière la tête pour que le visage
// reste lisible. Sur la nuque (squat arrière), il reste devant : derrière, la tête le cacherait entièrement.
export const barbell = (hand: Point, head?: Point): GearShape[] => {
  const front = !head || Math.hypot(hand.x - head.x, hand.y - head.y) > 44 + GEAR.plate || hand.x < head.x - 8;
  return [
    { kind: "disc", x: hand.x, y: hand.y, radius: GEAR.plate, paint: "plate", front },
    { kind: "disc", x: hand.x, y: hand.y, radius: GEAR.hub, paint: "iron", front },
  ];
};

// Un haltère court vu de profil : un disque par main.
export const dumbbell = (hand: Point): GearShape[] => [
  { kind: "disc", x: hand.x, y: hand.y, radius: GEAR.dumbbell, paint: "iron", front: true },
];

// Un kettlebell sous la main : la boule, et l'anse dans la main.
export const kettlebell = (hand: Point): GearShape[] => [
  { kind: "disc", x: hand.x, y: hand.y + GEAR.kettlebell + 4, radius: GEAR.kettlebell, paint: "iron", front: true },
  {
    kind: "line",
    from: { x: hand.x - 9, y: hand.y + 8 },
    to: { x: hand.x + 9, y: hand.y + 8 },
    width: 6,
    paint: "iron",
    front: true,
  },
];

export const medicineBall = (at: Point): GearShape[] => [
  { kind: "disc", x: at.x, y: at.y, radius: GEAR.ball, paint: "ball", front: true },
];

// Un banc plat : le plateau à `top` au-dessus du sol, de `from` à `to`, et ses deux pieds.
export const bench = (from: number, to: number, top = GEAR.bench): GearShape[] => [
  { kind: "rect", x: from, y: GYM.ground - top, width: to - from, height: 14, radius: 4, paint: "bench" },
  { kind: "rect", x: from + 12, y: GYM.ground - top + 10, width: 10, height: top - 4, paint: "iron" },
  { kind: "rect", x: to - 22, y: GYM.ground - top + 10, width: 10, height: top - 4, paint: "iron" },
];

export const box = (from: number, width: number, height = GEAR.box): GearShape[] => [
  { kind: "rect", x: from, y: GYM.ground - height, width, height: height + 4, radius: 5, paint: "box" },
];

// Un élastique tendu entre un point fixe et la main.
export const band = (anchor: Point, hand: Point): GearShape[] => [
  { kind: "line", from: anchor, to: hand, width: 5, paint: "band" },
];

export const cone = (x: number): GearShape => ({
  kind: "poly",
  points: [
    { x: x - 16, y: GYM.ground + 4 },
    { x: x - 4, y: GYM.ground - 30 },
    { x: x + 4, y: GYM.ground - 30 },
    { x: x + 16, y: GYM.ground + 4 },
  ],
  paint: "cone",
});

// Une volée de marches qui monte vers la droite à partir de `from`.
export const stairs = (from: number, count: number, rise = 26, run = 64): GearShape => ({
  kind: "poly",
  points: [
    { x: from, y: GYM.ground + 4 },
    ...Array.from({ length: count }, (_, i) => [
      { x: from + i * run, y: GYM.ground - (i + 1) * rise },
      { x: from + (i + 1) * run, y: GYM.ground - (i + 1) * rise },
    ]).flat(),
    { x: from + count * run, y: GYM.ground + 4 },
  ],
  paint: "step",
});

// Le haut d'une marche ou d'une boîte, pour y poser un appui.
export const stepTop = (from: number, index: number, rise = 26, run = 64): Point => ({
  x: from + index * run + run / 2,
  y: GYM.ground - (index + 1) * rise - REST.footA,
});

export const ground = (anchor: Anchor, x = 0): Point => ({ x: MIDDLE + x, y: GYM.ground - REST[anchor] });
export const above = (anchor: Anchor, height: number, x = 0): Point => ({
  x: MIDDLE + x,
  y: GYM.ground - height - REST[anchor],
});
export { BODY, MIDDLE };
