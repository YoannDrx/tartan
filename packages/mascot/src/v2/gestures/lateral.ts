// Les gestes latéraux que le premier moteur ne dessinait que de face, écrits en trois dimensions pour que le
// profil soit juste aussi : élévations latérales, marche latérale avec élastique, pas chassés entre plots, bonds
// du patineur. Positions et rythmes réglés à l'œil d'après les fiches du catalogue : aucune source ouverte.
import { gesture, type KeyDraft } from "../gesture";
import { BALL_X, elbows, hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import type { Solved } from "../solve";
import { airborne } from "./flight";
import { dumbbells } from "./gym";

const RIG = { bar: null };

// --- Élévations latérales -------------------------------------------------------------------------------------

// Debout, haltères en main, coudes légèrement fléchis ; les bras montent sur les côtés, un peu devant le buste,
// jusqu'à hauteur d'épaule, sans hausser les épaules ; la descente est plus lente que la montée.
const raiseBase: ControlPatch = {
  footRZ: 22,
  footLZ: -22,
  pelvisY: 999,
  pelvisPitch: 3,
  ...elbows(-0.5, 0.5, 0.2),
};
const armsAt = (lift: number): ControlPatch => {
  // De bras le long du corps (0) à bras à l'horizontale (1), sur un arc : la main reste à bout de bras.
  const angle = (lift * 82 * Math.PI) / 180;
  const reach = 116;
  return hands(10 + 30 * lift, -8 - reach * Math.cos(angle), 38 + reach * Math.sin(angle));
};
export const lateralRaise = gesture({
  key: "lateral-raise",
  athlete: "discus",
  rig: RIG,
  base: raiseBase,
  keys: [
    { id: "down", guide: 0, set: armsAt(0.05), hold: 600, move: { ms: 450, curve: "reception", phase: "down" } },
    { id: "rising", guide: 1, set: armsAt(0.55), still: true, move: { ms: 420, curve: "elan", phase: "up" } },
    {
      id: "top",
      guide: 2,
      set: armsAt(1),
      hold: 350,
      face: "effort",
      move: { ms: 420, curve: "reception", phase: "up" },
    },
    { id: "lowering", guide: 3, set: armsAt(0.5), still: true, move: { ms: 700, curve: "elan", phase: "down" } },
  ],
  props: (_, body) => dumbbells(body),
  views: ["front", "side"],
});

// --- Pas latéraux ---------------------------------------------------------------------------------------------

type Feet = { R: number; L: number };
// Une position de pas latéral : les pieds en z, le bassin entre eux, en flexion légère.
const sideStance = (feet: Feet, depth: number, extra: ControlPatch = {}): ControlPatch => ({
  footRX: BALL_X,
  footRZ: feet.R,
  footRYaw: 8,
  footLX: BALL_X,
  footLZ: feet.L,
  footLYaw: 8,
  pelvisZ: (feet.R + feet.L) / 2,
  pelvisX: -10 - depth / 3,
  pelvisY: 171 - depth,
  pelvisPitch: 4 + depth / 2,
  neck: -depth / 4,
  ...hands(30, -60, 30),
  ...elbows(-0.5, -1, 0.4),
  ...extra,
});
// Un pas : le pied `side` se lève, va à sa nouvelle place, se pose.
const sideStep = (
  id: string,
  from: Feet,
  to: Feet,
  side: "R" | "L",
  depth: number,
  ms: number,
  phase: string,
  extra: Partial<KeyDraft> = {},
): KeyDraft[] => {
  const mid: Feet = { ...to, [side]: (from[side] + to[side]) / 2 };
  return [
    {
      id: `${id}-air`,
      set: { ...sideStance(mid, depth + 2), [`foot${side}Lift`]: 10 },
      air: [side],
      move: { ms: ms / 2, curve: "elan", phase },
    },
    { id, set: sideStance(to, depth), move: { ms: ms / 2, curve: "reception", phase }, ...extra },
  ];
};

// La marche latérale avec élastique : en flexion, des petits pas sans que les genoux rentrent.
const BAND_STEP = 34;
const bandWalk = (): KeyDraft[] => {
  const keys: KeyDraft[] = [];
  let feet: Feet = { R: 24, L: -24 };
  const depth = 30;
  keys.push({
    id: "ready",
    guide: 0,
    set: sideStance(feet, depth),
    hold: 500,
    move: { ms: 400, curve: "reception", phase: "close" },
  });
  for (let i = 0; i < 3; i += 1) {
    const open: Feet = { R: feet.R + BAND_STEP, L: feet.L };
    keys.push(...sideStep(`open-${i}`, feet, open, "R", depth, 420, "open", i === 0 ? { guide: 1, still: true } : {}));
    const close: Feet = { R: open.R, L: open.L + BAND_STEP };
    keys.push(
      ...sideStep(`close-${i}`, open, close, "L", depth, 420, "close", i === 0 ? { guide: 2, still: true } : {}),
    );
    feet = close;
  }
  keys.push({
    id: "turn",
    guide: 3,
    set: sideStance(feet, depth),
    hold: 400,
    move: { ms: 200, curve: "reception", phase: "close" },
  });
  for (let i = 0; i < 3; i += 1) {
    const open: Feet = { R: feet.R, L: feet.L - BAND_STEP };
    keys.push(...sideStep(`back-open-${i}`, feet, open, "L", depth, 420, "open"));
    const close: Feet = { R: open.R - BAND_STEP, L: open.L };
    keys.push(...sideStep(`back-close-${i}`, open, close, "R", depth, 420, "close"));
    feet = close;
  }
  // Le dernier pas ramène à la position de départ : la clé finale est la première.
  return keys.slice(0, -1);
};
// L'élastique, juste au-dessus des genoux, vu de face.
const band = (_: number, body: Solved): Prop[] => {
  const above = (side: "R" | "L") => {
    const { knee, hip } = body.legs[side];
    return { x: -(knee.z + (hip.z - knee.z) * 0.18), y: -(knee.y + (hip.y - knee.y) * 0.18), depth: knee.x + 6 };
  };
  const [r, l] = [above("R"), above("L")];
  return [
    {
      paint: "band",
      shape: { kind: "line", from: { x: r.x, y: r.y }, to: { x: l.x, y: l.y }, width: 5 },
      native: "front",
      at: (r.depth + l.depth) / 2,
      half: 3,
      front: true,
    },
  ];
};
export const lateralBandWalk = gesture({
  key: "lateral-band-walk",
  athlete: "longJump",
  rig: RIG,
  keys: bandWalk(),
  props: band,
  views: ["front", "side"],
});

// --- Pas chassés entre plots ----------------------------------------------------------------------------------

const CONE = 150;
const cones = (): Prop[] =>
  [-1, 1].map((k) => ({
    paint: "cone",
    shape: {
      kind: "poly",
      points: [
        { x: -k * CONE - 14, y: 0 },
        { x: -k * CONE + 14, y: 0 },
        { x: -k * CONE, y: -40 },
      ],
    },
    native: "front",
    at: 30,
    half: 14,
  }));
const SHUFFLE = 44;
const shuffle = (): KeyDraft[] => {
  const keys: KeyDraft[] = [];
  let feet: Feet = { R: -CONE + 70, L: -CONE + 22 };
  const depth = 26;
  keys.push({
    id: "ready",
    guide: 0,
    set: sideStance(feet, depth),
    hold: 450,
    move: { ms: 300, curve: "reception", phase: "brake" },
  });
  for (let i = 0; i < 3; i += 1) {
    const open: Feet = { R: feet.R + SHUFFLE, L: feet.L };
    keys.push(
      ...sideStep(`push-${i}`, feet, open, "R", depth, 260, "shuffle", i === 0 ? { guide: 1, still: true } : {}),
    );
    const close: Feet = { R: open.R, L: open.L + SHUFFLE };
    keys.push(
      ...sideStep(`close-${i}`, open, close, "L", depth, 240, "shuffle", i === 0 ? { guide: 2, still: true } : {}),
    );
    feet = close;
  }
  keys.push({
    id: "brake",
    guide: 3,
    set: sideStance(feet, depth + 10),
    hold: 300,
    move: { ms: 200, curve: "reception", phase: "brake" },
  });
  for (let i = 0; i < 3; i += 1) {
    const open: Feet = { R: feet.R, L: feet.L - SHUFFLE };
    keys.push(...sideStep(`back-push-${i}`, feet, open, "L", depth, 260, "shuffle"));
    const close: Feet = { R: open.R - SHUFFLE, L: open.L };
    keys.push(...sideStep(`back-close-${i}`, open, close, "R", depth, 240, "shuffle"));
    feet = close;
  }
  return keys.slice(0, -1);
};
export const coneSideShuffle = gesture({
  key: "cone-side-shuffle",
  athlete: "tripleJump",
  rig: RIG,
  keys: shuffle(),
  props: cones,
  views: ["front", "side"],
});

// --- Bonds latéraux du patineur -------------------------------------------------------------------------------

// Sur une jambe, l'autre croisée derrière ; une poussée latérale, un vol, une réception sur l'autre jambe, genou
// souple, puis le retour.
const SKATE = 72;
const skater = (side: "R" | "L", phase: "land" | "low" | "push"): ControlPatch => {
  const k = side === "R" ? 1 : -1;
  const other = side === "R" ? "L" : "R";
  const z = k * SKATE;
  const depth = phase === "low" ? 46 : phase === "land" ? 24 : 0;
  return {
    [`foot${side}X`]: BALL_X,
    [`foot${side}Z`]: z,
    [`foot${side}Yaw`]: 8,
    [`foot${side}Lift`]: 0,
    ...(phase === "push" ? { [`foot${side}Heel`]: 36 } : {}),
    // La jambe libre croisée derrière la jambe d'appui.
    [`foot${other}X`]: BALL_X - 54,
    [`foot${other}Z`]: z - k * 10,
    [`foot${other}Lift`]: 26,
    [`foot${other}Heel`]: 40,
    pelvisZ: z - k * 12,
    pelvisX: -12 - depth / 3,
    pelvisY: phase === "push" ? 999 : 168 - depth,
    pelvisPitch: 8 + depth / 3,
    pelvisRoll: k * 6,
    ...hands(28, -70, 36),
  };
};
const SKATE_FLIGHT = 340;
const leap = (from: "R" | "L", to: "R" | "L", id: string, extra: Partial<KeyDraft> = {}): KeyDraft[] => [
  {
    id: `${id}-push`,
    set: skater(from, "push"),
    air: [to],
    face: "effort",
    move: { ms: 200, curve: "elan", phase: "push" },
  },
  ...airborne({}, RIG, { from: skater(from, "push"), to: skater(to, "land"), ms: SKATE_FLIGHT, phase: "flight", id }),
  {
    id: `${id}-land`,
    set: skater(to, "land"),
    air: [from],
    move: { ms: SKATE_FLIGHT / 8, curve: "linear", phase: "flight" },
    ...extra,
  },
];
export const lateralSkaterBound = gesture({
  key: "lateral-skater-bound",
  athlete: "highJump",
  rig: RIG,
  keys: [
    {
      id: "ready",
      guide: 0,
      set: skater("L", "low"),
      hold: 500,
      air: ["R"],
      move: { ms: 240, curve: "reception", phase: "landing" },
    },
    ...leap("L", "R", "to-right", { guide: 1, still: true }),
    {
      id: "right-low",
      guide: 2,
      set: skater("R", "low"),
      hold: 450,
      air: ["L"],
      face: "effort",
      move: { ms: 240, curve: "reception", phase: "landing" },
    },
    ...leap("R", "L", "to-left", { guide: 3, still: true }),
  ],
  views: ["front", "side"],
});
