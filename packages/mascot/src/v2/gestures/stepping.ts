// Les déplacements latéraux d'Inès : pas croisés, montée d'escaliers en pas croisés, transfert en squat large.
// L'athlète regarde vers +x et se déplace sur le côté (+z, sa droite) : ces gestes se lisent d'abord de face.
// - Pas croisés : un pied croise devant l'autre, l'autre s'ouvre ; le même pied croise derrière, l'autre s'ouvre ;
//   le bassin tourne un peu, les épaules restent relâchées. Quatre pas vers la droite, quatre vers la gauche.
// - Escaliers en pas croisés : le pied éloigné croise devant pour se poser sur la marche suivante, l'autre monte
//   à la suivante en passant derrière ; la descente se fait en pas chassés simples, chaque appui à plat.
// - Transfert en squat large : pieds écartés, le bassin passe d'un côté à l'autre en fléchissant la jambe de ce
//   côté, talon au sol, l'autre jambe allongée.
// Positions et rythmes réglés à l'œil d'après les fiches du catalogue : aucune source ouverte pour ces gestes.
import { gesture, type KeyDraft } from "../gesture";
import { BALL_X, type ControlPatch } from "../pose";
import type { Prop } from "../props";

const ATHLETE = "tripleJump" as const;
const RIG = { bar: null };

type Feet = { R: [number, number]; L: [number, number] };
// Les pieds : (x, z) de chaque avant-pied. La hauteur et l'ouverture des pointes à part.
const feetAt = ({ R, L }: Feet, lift: { R?: number; L?: number } = {}): ControlPatch => ({
  footRX: R[0],
  footRZ: R[1],
  footRYaw: 6,
  footRLift: lift.R ?? 0,
  footLX: L[0],
  footLZ: L[1],
  footLYaw: 6,
  footLLift: lift.L ?? 0,
});
const HOME = 16;
const X = BALL_X;

// --- Pas croisés ----------------------------------------------------------------------------------------------

const CROSS = 22;
const OPEN = 52;
// Le bassin au-dessus du milieu des pieds, un peu bas, tourné de `turn` degrés.
const body = (feet: Feet, turn: number, extra: ControlPatch = {}): ControlPatch => ({
  ...feetAt(feet),
  pelvisX: (feet.R[0] + feet.L[0]) / 2 - 8,
  pelvisZ: (feet.R[1] + feet.L[1]) / 2,
  pelvisY: 164,
  pelvisYaw: turn,
  pelvisPitch: 4,
  neck: -2,
  ...extra,
});
// Un pied en l'air, à mi-chemin, levé.
const flying = (from: Feet, to: Feet, side: "R" | "L", turn: number): ControlPatch => {
  const mid: Feet = { ...to, [side]: [(from[side][0] + to[side][0]) / 2, (from[side][1] + to[side][1]) / 2] } as Feet;
  return { ...body(mid, turn), ...feetAt(mid, { [side]: 12 }), pelvisY: 162 };
};

// Les positions successives des pieds vers la droite, puis vers la gauche.
const start: Feet = { R: [X, HOME], L: [X, -HOME] };
const s1: Feet = { R: start.R, L: [X + 16, HOME + CROSS] };
const s2: Feet = { R: [X, s1.L[1] + OPEN], L: s1.L };
const s3: Feet = { R: s2.R, L: [X - 16, s2.R[1] + CROSS] };
const s4: Feet = { R: [X, s3.L[1] + OPEN], L: s3.L };
// Retour : le pied droit croise à son tour.
const r1: Feet = { R: [X + 16, s4.L[1] - CROSS], L: s4.L };
const r2: Feet = { R: r1.R, L: [X, r1.R[1] - OPEN] };
const r3: Feet = { R: [X - 16, r2.L[1] - CROSS], L: r2.L };
const r4: Feet = { R: r3.R, L: start.L };
// Le dernier pas ramène exactement au départ.
const end: Feet = start;

const step = (
  id: string,
  from: Feet,
  to: Feet,
  side: "R" | "L",
  turn: number,
  phase: string,
  guide?: number,
): KeyDraft[] => [
  { id: `${id}-air`, set: flying(from, to, side, turn), air: [side], move: { ms: 160, curve: "elan", phase } },
  {
    id,
    set: body(to, turn),
    ...(guide !== undefined ? { guide, still: true } : {}),
    move: { ms: 160, curve: "reception", phase },
  },
];

export const carioca = gesture({
  key: "carioca",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    { id: "ready", guide: 0, set: body(start, 0), hold: 500, move: { ms: 200, curve: "reception", phase: "open" } },
    ...step("cross-front", start, s1, "L", 22, "cross", 1),
    ...step("open", s1, s2, "R", 0, "open"),
    ...step("cross-back", s2, s3, "L", -22, "cross", 2),
    ...step("open-again", s3, s4, "R", 0, "open", 3),
    { id: "turn", set: body(s4, 0), hold: 400, move: { ms: 120, curve: "linear", phase: "open" } },
    ...step("back-front", s4, r1, "R", -22, "cross"),
    ...step("back-open", r1, r2, "L", 0, "open"),
    ...step("back-behind", r2, r3, "R", 22, "cross"),
    ...step("back-open-again", r3, r4, "L", 0, "open"),
    ...step("close", r4, end, "R", 0, "open"),
  ],
  views: ["front", "side"],
});

// --- Escaliers en pas croisés ---------------------------------------------------------------------------------

// Des marches larges et basses, vers la droite de l'athlète.
const RISE = 24;
const TREAD = 64;
const stepTop = (k: number) => k * RISE;
// Le milieu de la marche k le long de z.
const STAIR0 = 44;
const onStep = (k: number, offset = 0) => STAIR0 + (k - 1) * TREAD + TREAD / 2 + offset;
type Placed = { R: [number, number, number]; L: [number, number, number] };
const stance = ({ R, L }: Placed, turn: number, extra: ControlPatch = {}): ControlPatch => ({
  footRX: R[0],
  footRZ: R[1],
  footRLift: R[2],
  footRYaw: 6,
  footLX: L[0],
  footLZ: L[1],
  footLLift: L[2],
  footLYaw: 6,
  pelvisX: (R[0] + L[0]) / 2 - 2,
  pelvisZ: (R[1] + L[1]) / 2,
  pelvisY: 164 + (R[2] + L[2]) / 2,
  // Le pied resté plus bas se lève sur l'avant-pied.
  footRHeel: L[2] > R[2] && R[2] === 0 ? 24 : 0,
  footLHeel: R[2] > L[2] && L[2] === 0 ? 24 : 0,
  pelvisYaw: turn,
  pelvisPitch: 6,
  neck: -8,
  ...extra,
});
const swingTo = (from: Placed, to: Placed, side: "R" | "L", turn: number): ControlPatch => {
  const [a, b] = [from[side], to[side]];
  const mid: Placed = { ...to, [side]: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(a[2], b[2]) + 16] } as Placed;
  const low = Math.min(from.R[2], from.L[2], to.R[2], to.L[2]);
  // Le pied levé pointe vers le bas, dans le prolongement du tibia qui se plie.
  return { ...stance(mid, turn), [`foot${side}Heel`]: 28, pelvisY: 162 + low + (Math.max(a[2], b[2]) - low) / 2 };
};

const ground: Placed = { R: [X, HOME, 0], L: [X, -HOME, 0] };
const firstStep: Placed = { R: ground.R, L: [X + 12, onStep(1, -8), stepTop(1)] };
const secondStep: Placed = { R: [X - 6, onStep(2), stepTop(2)], L: firstStep.L };
// Descente en pas chassés : le pied droit redescend sur la première marche, puis le gauche au sol, puis le droit.
const home = ground;
const backDown: Placed = { R: [X, onStep(1, 16), stepTop(1)], L: firstStep.L };
const leftDown: Placed = { R: backDown.R, L: home.L };

const move = (
  id: string,
  from: Placed,
  to: Placed,
  side: "R" | "L",
  turn: number,
  phase: string,
  extra: { guide?: number; hold?: number } = {},
): KeyDraft[] => [
  { id: `${id}-air`, set: swingTo(from, to, side, turn), air: [side], move: { ms: 380, curve: "elan", phase } },
  {
    id,
    set: stance(to, turn),
    ...(extra.guide !== undefined ? { guide: extra.guide, still: true } : {}),
    ...(extra.hold ? { hold: extra.hold } : {}),
    move: { ms: 320, curve: "reception", phase },
  },
];

// Chaque marche, vue de face : de sa contremarche jusqu'au bout de l'escalier, à sa hauteur.
const flight = (): Prop[] =>
  [1, 2].map((k) => {
    const from = STAIR0 + (k - 1) * TREAD;
    const to = STAIR0 + 2 * TREAD + 40;
    return {
      paint: "step",
      shape: { kind: "rect", x: -to, y: -stepTop(k), width: to - from, height: RISE, radius: 2 },
      native: "front",
      at: 0,
      half: 70,
    } satisfies Prop;
  });

export const crossStepStairs = gesture({
  key: "cross-step-stairs",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    {
      id: "ready",
      guide: 0,
      set: stance(home, 0),
      hold: 600,
      move: { ms: 320, curve: "reception", phase: "down" },
    },
    ...move("cross-up", ground, firstStep, "L", 20, "up", { guide: 1 }),
    ...move("bring-up", firstStep, secondStep, "R", 0, "up", { guide: 2, hold: 500 }),
    ...move("down-right", secondStep, backDown, "R", 0, "down", { guide: 3 }),
    ...move("down-left", backDown, leftDown, "L", 0, "down"),
    {
      id: "down-right-air",
      set: swingTo(leftDown, home, "R", 0),
      air: ["R"],
      move: { ms: 380, curve: "elan", phase: "down" },
    },
  ],
  props: flight,
  // De profil, l'escalier passe devant l'athlète qui monte à côté de lui : de face, puis de dessus.
  views: ["front", "top"],
});

// --- Montée latérale d'escaliers ------------------------------------------------------------------------------

// Sans croiser : le pied le plus proche (le droit) monte sur la marche, l'autre le rejoint sur la même marche ;
// deux marches, puis la descente dans l'ordre inverse, le pied gauche d'abord.
const stepOne: Placed = { R: [X, onStep(1, 6), stepTop(1)], L: ground.L };
const stepOneBoth: Placed = { R: stepOne.R, L: [X, onStep(1, -26), stepTop(1)] };
const stepTwo: Placed = { R: [X, onStep(2, 6), stepTop(2)], L: stepOneBoth.L };
const stepTwoBoth: Placed = { R: stepTwo.R, L: [X, onStep(2, -26), stepTop(2)] };
export const lateralStairWalk = gesture({
  key: "lateral-stair-walk",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    { id: "ready", guide: 0, set: stance(home, 0), hold: 600, move: { ms: 320, curve: "reception", phase: "down" } },
    ...move("lead-up", ground, stepOne, "R", 0, "up", { guide: 1 }),
    ...move("follow-up", stepOne, stepOneBoth, "L", 0, "up", { guide: 2 }),
    ...move("lead-up-again", stepOneBoth, stepTwo, "R", 0, "up"),
    ...move("follow-up-again", stepTwo, stepTwoBoth, "L", 0, "up", { guide: 3, hold: 400 }),
    ...move("down-left", stepTwoBoth, { R: stepTwo.R, L: stepOneBoth.L }, "L", 0, "down"),
    ...move("down-right", { R: stepTwo.R, L: stepOneBoth.L }, stepOneBoth, "R", 0, "down"),
    ...move("down-left-again", stepOneBoth, { R: stepOne.R, L: ground.L }, "L", 0, "down"),
    {
      id: "down-right-air",
      set: swingTo({ R: stepOne.R, L: ground.L }, home, "R", 0),
      air: ["R"],
      move: { ms: 380, curve: "elan", phase: "down" },
    },
  ],
  props: flight,
  views: ["front", "top"],
});
