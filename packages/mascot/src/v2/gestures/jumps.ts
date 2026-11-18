// La pliométrie : Ninon (l'athlète de la hauteur). Chaque saut a ses trois temps : l'appui qui pousse, le vol en
// parabole (flight.ts), la réception qui amortit. Au contact, les pieds sont tenus ; les rebonds ont un contact
// bref, plus court que le vol ; une réception finale s'amortit, hanches et genoux fléchis, talons qui se posent.
// Repères : contre-mouvement rapide puis inversion sans arrêt ; saut depuis squat tenu sans rebond préparatoire ;
// rebonds de cheville à faible flexion de hanche et de genou ; réception sur l'avant-pied puis le pied entier,
// genoux dans l'axe. Durées et amplitudes réglées à l'œil, d'après les fiches du catalogue et la physique du vol :
// aucune source ouverte pour ces gestes.
import { gesture, type KeyDraft } from "../gesture";
import { BALL_X, hands, heels, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { airborne, flightFor, type Flight } from "./flight";

const ATHLETE = "highJump" as const;
const RIG = { bar: null };

// Les pieds sous les hanches, un peu ouverts.
const feet = (x = BALL_X, lift = 0): ControlPatch => ({
  footRX: x,
  footRZ: 18,
  footRYaw: 8,
  footRLift: lift,
  footLX: x,
  footLZ: -18,
  footLYaw: 8,
  footLLift: lift,
});
const BASE: ControlPatch = feet();

// Les bras : le long du corps, lancés vers l'arrière, levés devant, tenus devant à la réception, mains aux hanches.
const ARMS = {
  down: hands(6, -126, 44),
  back: hands(-22, -110, 44),
  up: hands(42, 8, 40),
  front: hands(42, -30, 36),
  hips: { ...hands(4, -92, 30), elbowRForward: -1, elbowLForward: -1, elbowROut: 0.6, elbowLOut: 0.6 },
};

// Des positions, depuis la station debout : `x` déplace le corps vers l'avant, `lift` le pose sur un support.
const at = (x: number, lift: number) => ({ ...feet(BALL_X + x, lift) });
const stand = (x = 0, lift = 0, arms = ARMS.down): ControlPatch => ({
  ...at(x, lift),
  pelvisX: x - 8,
  pelvisY: 999,
  pelvisPitch: 2,
  ...arms,
});
// Une flexion de `depth` unités : le bassin recule et descend, le buste se penche.
const crouch = (depth: number, x = 0, lift = 0, arms = ARMS.back): ControlPatch => ({
  ...at(x, lift),
  pelvisX: x - 8 - 0.5 * depth,
  pelvisY: 171 + lift - depth,
  pelvisPitch: 2 + 0.55 * depth,
  lumbar: -2,
  neck: -0.25 * depth,
  ...arms,
});
// L'impulsion : jambes tendues, sur l'avant-pied, le buste dans l'axe.
const push = (x = 0, lift = 0, arms = ARMS.up, lean = 0): ControlPatch => ({
  ...at(x, lift),
  ...heels(38),
  pelvisX: x - 4 + lean,
  pelvisY: 999,
  pelvisPitch: -2 + lean / 2,
  ...arms,
});
// Le contact de réception : l'avant-pied d'abord, genoux un peu fléchis.
const touch = (x = 0, lift = 0, arms = ARMS.front): ControlPatch => ({
  ...at(x, lift),
  // Sur un support, le pied se pose à plat : l'avant-pied n'y pivote pas.
  ...heels(lift > 0 ? 0 : 24),
  pelvisX: x - 6,
  pelvisY: 166 + lift,
  pelvisPitch: 6,
  ...arms,
});

const flightOf = (from: ControlPatch, to: ControlPatch, ms: number, phase = "flight", extra: Partial<Flight> = {}) =>
  airborne(BASE, RIG, { from, to, ms, phase, face: "effort", ...extra });
// La clé de réception, au bout du vol : sa transition est le dernier tronçon du vol.
const land = (id: string, set: ControlPatch, ms: number, extra: Partial<KeyDraft> = {}, samples = 8): KeyDraft => ({
  id,
  set,
  face: "effort",
  move: { ms: ms / samples, curve: "linear", phase: "flight" },
  ...extra,
});

// --- Saut depuis squat arrêté ---------------------------------------------------------------------------------

const SJ_FLIGHT = 460;
export const squatJump = gesture({
  key: "squat-jump",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    {
      id: "set",
      guide: 0,
      set: crouch(46, 0, 0, ARMS.hips),
      hold: 600,
      move: { ms: 650, curve: "impulsion", phase: "reset" },
    },
    {
      id: "steady",
      guide: 1,
      set: crouch(46, 0, 0, ARMS.hips),
      hold: 500,
      move: { ms: 120, curve: "linear", phase: "hold" },
    },
    {
      id: "takeoff",
      guide: 2,
      set: push(0, 0, ARMS.hips),
      face: "effort",
      still: true,
      move: { ms: 220, curve: "elan", phase: "push" },
    },
    ...flightOf(push(0, 0, ARMS.hips), touch(0, 0, ARMS.hips), SJ_FLIGHT),
    land("touchdown", touch(0, 0, ARMS.hips), SJ_FLIGHT),
    {
      id: "absorb",
      guide: 3,
      set: crouch(34, 0, 0, ARMS.hips),
      hold: 350,
      move: { ms: 180, curve: "reception", phase: "landing" },
    },
    { id: "standing", set: stand(0, 0, ARMS.hips), hold: 300, move: { ms: 500, curve: "impulsion", phase: "reset" } },
  ],
});

// --- Saut vertical avec contre-mouvement ----------------------------------------------------------------------

const CMJ_FLIGHT = 500;
export const countermovementJump = gesture({
  key: "countermovement-jump",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    { id: "standing", guide: 0, set: stand(), hold: 600, move: { ms: 600, curve: "impulsion", phase: "reset" } },
    {
      id: "dip",
      guide: 1,
      set: crouch(44),
      face: "effort",
      still: true,
      move: { ms: 300, curve: "elan", phase: "dip" },
    },
    {
      id: "takeoff",
      guide: 2,
      set: push(),
      face: "effort",
      still: true,
      move: { ms: 230, curve: "elan", phase: "push" },
    },
    ...flightOf(push(), touch(), CMJ_FLIGHT),
    land("touchdown", touch(), CMJ_FLIGHT),
    {
      id: "absorb",
      guide: 3,
      set: crouch(36, 0, 0, ARMS.front),
      hold: 400,
      move: { ms: 190, curve: "reception", phase: "landing" },
    },
  ],
});

// --- Sauts genoux poitrine ------------------------------------------------------------------------------------

const TUCK_FLIGHT = 560;
// Au sommet : les genoux montent vers la poitrine, les pieds sous les fesses, le buste un peu en avant.
const TUCK: ControlPatch = {
  footRLift: 82,
  footLLift: 82,
  footRX: 26,
  footLX: 26,
  pelvisPitch: 14,
  footRHeel: 20,
  footLHeel: 20,
};
const tuckFlight = flightOf(push(), touch(), TUCK_FLIGHT, "flight", { apex: TUCK });
tuckFlight[3] = { ...tuckFlight[3]!, id: "tuck", guide: 2, still: true };
export const tuckJump = gesture({
  key: "tuck-jump",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    { id: "standing", guide: 0, set: stand(), hold: 600, move: { ms: 600, curve: "impulsion", phase: "reset" } },
    { id: "dip", set: crouch(30), face: "effort", still: true, move: { ms: 260, curve: "elan", phase: "dip" } },
    {
      id: "takeoff",
      guide: 1,
      set: push(),
      face: "effort",
      still: true,
      move: { ms: 200, curve: "elan", phase: "push" },
    },
    ...tuckFlight,
    land("touchdown", touch(), TUCK_FLIGHT),
    {
      id: "absorb",
      guide: 3,
      set: crouch(36, 0, 0, ARMS.front),
      hold: 400,
      move: { ms: 190, curve: "reception", phase: "landing" },
    },
  ],
});

// --- Sauts verticaux répétés et rebonds de cheville -----------------------------------------------------------

// Un rebond : la réception, un contact bref (le bas, puis l'impulsion), et le vol suivant.
const rebound = (index: number, depth: number, flight: number, contact: number, extra: Partial<KeyDraft> = {}) => {
  const low: ControlPatch = { ...crouch(depth, 0, 0, ARMS.front), ...heels(depth < 12 ? 16 : 6) };
  return [
    {
      id: `bottom-${index}`,
      set: low,
      face: "effort" as const,
      still: true,
      ...extra,
      move: { ms: contact * 0.45, curve: "reception" as const, phase: "contact" },
    },
    {
      id: `takeoff-${index}`,
      set: push(),
      face: "effort" as const,
      move: { ms: contact * 0.55, curve: "elan" as const, phase: "contact" },
    },
    ...flightOf(push(), touch(), flight, "flight", { id: `flight-${index}` }),
    land(`touchdown-${index}`, touch(), flight),
  ];
};

const RVJ_FLIGHT = 440;
export const repeatedVerticalJumps = gesture({
  key: "repeated-vertical-jumps",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    { id: "standing", guide: 0, set: stand(), hold: 600, move: { ms: 600, curve: "impulsion", phase: "reset" } },
    { id: "dip", set: crouch(34), face: "effort", still: true, move: { ms: 260, curve: "elan", phase: "dip" } },
    {
      id: "takeoff",
      guide: 1,
      set: push(),
      face: "effort",
      still: true,
      move: { ms: 210, curve: "elan", phase: "push" },
    },
    ...flightOf(push(), touch(), RVJ_FLIGHT),
    land("touchdown", touch(), RVJ_FLIGHT),
    ...rebound(1, 26, RVJ_FLIGHT, 230, { guide: 2 }),
    {
      id: "absorb",
      guide: 3,
      set: crouch(36, 0, 0, ARMS.front),
      hold: 400,
      move: { ms: 190, curve: "reception", phase: "landing" },
    },
  ],
});

// Les rebonds de cheville : genoux presque tendus, c'est la cheville qui pousse ; vols bas et contacts brefs.
const POGO_FLIGHT = 280;
const pogoTouch = (): ControlPatch => ({ ...touch(0, 0, ARMS.down), pelvisY: 999, ...heels(26) });
const pogoLow = (): ControlPatch => ({ ...stand(0, 0, ARMS.down), pelvisY: 170.5, pelvisX: -9, ...heels(10) });
const pogoPush = (): ControlPatch => ({ ...push(0, 0, ARMS.down), ...heels(40) });
const pogo = (index: number, extra: Partial<KeyDraft> = {}): KeyDraft[] => [
  {
    id: `bottom-${index}`,
    set: pogoLow(),
    still: index === 1,
    ...extra,
    move: { ms: 75, curve: "reception", phase: "contact" },
  },
  { id: `takeoff-${index}`, set: pogoPush(), move: { ms: 85, curve: "elan", phase: "contact" } },
  ...airborne(BASE, RIG, {
    from: pogoPush(),
    to: pogoTouch(),
    ms: POGO_FLIGHT,
    phase: "flight",
    samples: 8,
    id: `flight-${index}`,
  }),
  land(`touchdown-${index}`, pogoTouch(), POGO_FLIGHT, {}, 8),
];
export const pogoJumps = gesture({
  key: "pogo-jumps",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    { id: "standing", guide: 0, set: stand(), hold: 500, move: { ms: 300, curve: "impulsion", phase: "reset" } },
    { id: "takeoff", set: pogoPush(), move: { ms: 220, curve: "impulsion", phase: "push" } },
    ...airborne(BASE, RIG, {
      from: pogoPush(),
      to: pogoTouch(),
      ms: POGO_FLIGHT,
      phase: "flight",
      samples: 8,
      id: "flight-0",
    }),
    land("touchdown-0", pogoTouch(), POGO_FLIGHT, { guide: 1, still: true }, 8),
    ...pogo(1, { guide: 2 }),
    ...pogo(2),
    {
      id: "absorb",
      guide: 3,
      set: { ...stand(), pelvisY: 160 },
      hold: 400,
      move: { ms: 160, curve: "reception", phase: "landing" },
    },
  ],
});

// --- Fentes sautées -------------------------------------------------------------------------------------------

// Une fente, le pied `front` devant : le pied arrière sur l'avant-pied, les deux genoux fléchis.
const STRIDE = 70;
const lunge = (front: "R" | "L", depth: number, phase: "set" | "push" | "touch"): ControlPatch => {
  const back = front === "R" ? "L" : "R";
  const rise = phase === "push" ? 0 : depth;
  return {
    [`foot${front}X`]: BALL_X + STRIDE,
    [`foot${front}Z`]: front === "R" ? 18 : -18,
    [`foot${front}Heel`]: phase === "set" ? 0 : 22,
    [`foot${back}X`]: BALL_X - STRIDE,
    [`foot${back}Z`]: back === "R" ? 18 : -18,
    [`foot${back}Heel`]: 48,
    pelvisX: -4,
    pelvisY: phase === "push" ? 999 : 160 - rise,
    pelvisPitch: 4,
    ...(phase === "push" ? ARMS.up : ARMS.front),
  };
};
const SPLIT_FLIGHT = 460;
// En l'air, les jambes passent l'une devant l'autre sous le bassin, sans se croiser, un peu remontées.
const SWITCH: ControlPatch = { footRLift: 26, footLLift: 26 };
export const splitJumps = gesture({
  key: "split-jumps",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    {
      id: "lunge",
      guide: 0,
      set: lunge("R", 22, "set"),
      hold: 600,
      move: { ms: 450, curve: "reception", phase: "landing" },
    },
    {
      id: "dip",
      guide: 1,
      set: lunge("R", 40, "set"),
      face: "effort",
      still: true,
      move: { ms: 280, curve: "elan", phase: "dip" },
    },
    { id: "takeoff", set: lunge("R", 0, "push"), face: "effort", move: { ms: 220, curve: "elan", phase: "push" } },
    ...flightOf(lunge("R", 0, "push"), lunge("L", 6, "touch"), SPLIT_FLIGHT, "flight", { apex: SWITCH }).map(
      (key, index) => (index === 3 ? { ...key, id: "switch", guide: 2, still: true } : key),
    ),
    land("touchdown", lunge("L", 6, "touch"), SPLIT_FLIGHT),
    {
      id: "absorb",
      guide: 3,
      set: lunge("L", 34, "set"),
      hold: 400,
      move: { ms: 200, curve: "reception", phase: "landing" },
    },
    { id: "dip-back", set: lunge("L", 40, "set"), face: "effort", move: { ms: 200, curve: "elan", phase: "dip" } },
    { id: "takeoff-back", set: lunge("L", 0, "push"), face: "effort", move: { ms: 220, curve: "elan", phase: "push" } },
    ...flightOf(lunge("L", 0, "push"), lunge("R", 6, "touch"), SPLIT_FLIGHT, "flight", {
      apex: SWITCH,
      id: "switch-back",
    }),
    land("touchdown-back", lunge("R", 6, "touch"), SPLIT_FLIGHT),
    {
      id: "absorb-back",
      set: lunge("R", 34, "set"),
      hold: 400,
      move: { ms: 200, curve: "reception", phase: "landing" },
    },
  ],
});

// --- Saut en longueur sans élan -------------------------------------------------------------------------------

// Un saut vers l'avant : le geste ne revient pas à son départ, la lecture repart d'un coup.
const BROAD = 290;
const BROAD_FLIGHT = 540;
// Au sommet, les jambes passent devant le bassin pour préparer la réception.
const REACH: ControlPatch = { footRX: 18, footLX: 18, footRLift: 14, footLLift: 14, pelvisPitch: 10 };
export const standingBroadJump = gesture({
  key: "standing-broad-jump",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    {
      id: "standing",
      guide: 0,
      set: stand(),
      hold: 600,
      move: { ms: 200, curve: "linear", phase: "reset", cut: true },
    },
    {
      id: "dip",
      guide: 1,
      set: crouch(52),
      face: "effort",
      hold: 150,
      move: { ms: 420, curve: "impulsion", phase: "dip" },
    },
    {
      id: "takeoff",
      guide: 2,
      set: push(0, 0, ARMS.up, 26),
      face: "effort",
      still: true,
      move: { ms: 320, curve: "elan", phase: "push" },
    },
    ...flightOf(push(0, 0, ARMS.up, 26), touch(BROAD, 0, ARMS.front), BROAD_FLIGHT, "flight", { apex: REACH }),
    land("touchdown", touch(BROAD, 0, ARMS.front), BROAD_FLIGHT),
    {
      id: "absorb",
      guide: 3,
      set: crouch(50, BROAD, 0, ARMS.front),
      hold: 450,
      move: { ms: 220, curve: "reception", phase: "landing" },
    },
    { id: "landed", set: stand(BROAD), hold: 500, move: { ms: 600, curve: "impulsion", phase: "recover" } },
  ],
});

// --- Saut sur boîte -------------------------------------------------------------------------------------------

const BOX = { from: 72, to: 168, top: 58 };
const ON_BOX = 118;
const box = (): Prop[] => [
  {
    paint: "box",
    shape: { kind: "rect", x: BOX.from, y: -BOX.top, width: BOX.to - BOX.from, height: BOX.top, radius: 4 },
    native: "side",
    at: 0,
    half: 46,
  },
];
const BOX_FLIGHT = 470;
// Debout sur la boîte, un pied redescend en arrière, puis l'autre.
const stepDown = (side: "R" | "L", done: boolean): ControlPatch => {
  const other = side === "R" ? "L" : "R";
  return {
    ...stand(ON_BOX, BOX.top),
    [`foot${side}X`]: done ? BALL_X : BALL_X + 40,
    [`foot${side}Lift`]: done ? 0 : BOX.top + 12,
    [`foot${other}X`]: BALL_X + ON_BOX,
    [`foot${other}Lift`]: BOX.top,
    pelvisX: done ? ON_BOX - 74 : ON_BOX - 34,
    pelvisY: done ? 164 + BOX.top / 2 : 168 + BOX.top,
  };
};
export const boxJump = gesture({
  key: "box-jump",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    { id: "standing", guide: 0, set: stand(), hold: 600, move: { ms: 450, curve: "reception", phase: "down" } },
    { id: "dip", set: crouch(44), face: "effort", still: true, move: { ms: 380, curve: "impulsion", phase: "dip" } },
    {
      id: "takeoff",
      guide: 1,
      set: push(0, 0, ARMS.up, 18),
      face: "effort",
      still: true,
      move: { ms: 240, curve: "elan", phase: "push" },
    },
    ...flightOf(push(0, 0, ARMS.up, 18), touch(ON_BOX, BOX.top), BOX_FLIGHT, "flight", { apex: REACH }),
    land("touchdown", touch(ON_BOX, BOX.top), BOX_FLIGHT),
    {
      id: "on-box",
      guide: 2,
      set: crouch(42, ON_BOX, BOX.top, ARMS.front),
      hold: 500,
      move: { ms: 200, curve: "reception", phase: "landing" },
    },
    { id: "tall", set: stand(ON_BOX, BOX.top), hold: 500, move: { ms: 550, curve: "impulsion", phase: "rise" } },
    {
      id: "step-back",
      guide: 3,
      set: stepDown("R", false),
      air: ["R"],
      still: true,
      move: { ms: 380, curve: "elan", phase: "down" },
    },
    { id: "right-down", set: stepDown("R", true), move: { ms: 380, curve: "reception", phase: "down" } },
    {
      id: "left-back",
      set: { ...stepDown("R", true), footLX: BALL_X + 50, footLLift: 20, pelvisX: 4, pelvisY: 172 },
      air: ["L"],
      move: { ms: 380, curve: "elan", phase: "down" },
    },
  ],
  props: box,
});

// --- Sauts en contrebas ---------------------------------------------------------------------------------------

// Debout sur une boîte basse : un pas en avant dans le vide, une réception brève, un rebond vertical, puis la
// réception stabilisée. Le geste ne revient pas sur la boîte : la lecture repart d'un coup.
const DROP = { from: -96, to: 40, top: 54 };
const dropBox = (): Prop[] => [
  {
    paint: "box",
    shape: { kind: "rect", x: DROP.from, y: -DROP.top, width: DROP.to - DROP.from, height: DROP.top, radius: 4 },
    native: "side",
    at: 0,
    half: 46,
  },
];
const LANDING_X = 96;
// La chute : la vitesse verticale nulle au départ, la durée que donne la hauteur.
const FALL = 1000 * Math.sqrt((2 * (DROP.top + 4)) / (9.81 / 0.00537));
const leaning: ControlPatch = { ...stand(0, DROP.top), pelvisX: 8, pelvisPitch: 6, ...ARMS.front };
const stepping: ControlPatch = {
  ...leaning,
  footRX: BALL_X + 40,
  footRLift: DROP.top + 6,
  footRHeel: 10,
  pelvisX: 22,
  pelvisY: 168 + DROP.top,
};
const fallFrom: ControlPatch = {
  ...stepping,
  footLX: BALL_X + 18,
  footLLift: DROP.top + 4,
  footLHeel: 20,
  pelvisX: 34,
};
export const dropJump = gesture({
  key: "drop-jump",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: (
    [
      {
        id: "on-box",
        guide: 0,
        set: stand(0, DROP.top),
        hold: 700,
        move: { ms: 200, curve: "linear", phase: "reset", cut: true },
      },
      {
        id: "step-off",
        guide: 1,
        set: stepping,
        air: ["R"],
        still: true,
        move: { ms: 420, curve: "impulsion", phase: "step" },
      },
      { id: "drop", set: fallFrom, air: ["R", "L"], move: { ms: 160, curve: "linear", phase: "step" } },
      ...flightOf(fallFrom, touch(LANDING_X), FALL, "fall", { samples: 5 }),
      land("contact", touch(LANDING_X), FALL, { guide: 2, still: true }, 5),
      ...rebound(1, 22, 460, 220).map((key) =>
        key.id === "bottom-1" ? { ...key, set: { ...crouch(22, LANDING_X, 0, ARMS.front), ...heels(6) } } : key,
      ),
      {
        id: "absorb",
        guide: 3,
        set: crouch(38, LANDING_X, 0, ARMS.front),
        hold: 500,
        move: { ms: 200, curve: "reception", phase: "landing" },
      },
    ] as KeyDraft[]
  ).map((key) => fixRebound(key)),
  props: dropBox,
});
// Le rebond du saut en contrebas se fait sur place, là où l'athlète est arrivé.
function fixRebound(key: KeyDraft): KeyDraft {
  if (!/^(takeoff-1|touchdown-1|flight-1-)/.test(key.id)) return key;
  const set = { ...key.set };
  for (const channel of ["footRX", "footLX", "pelvisX"] as const) set[channel] = (set[channel] ?? 0) + LANDING_X;
  return { ...key, set };
}

// --- Bonds unipodaux ------------------------------------------------------------------------------------------

// Sur la jambe droite, la gauche repliée derrière ; de petits bonds sur place, le pied revenant sous le bassin.
const HOP_FLIGHT = 300;
const tucked: ControlPatch = { footLX: BALL_X - 46, footLLift: 46, footLHeel: 40, footLZ: -14 };
const oneLeg = (patch: ControlPatch): ControlPatch => ({ ...patch, ...tucked, pelvisX: (patch.pelvisX ?? -6) + 2 });
const hopPush = oneLeg({ ...push(0, 0, ARMS.front), ...heels(36), footLHeel: 40 });
const hopTouch = oneLeg({ ...touch(0, 0, ARMS.front), footLHeel: 40 });
const hopLow = oneLeg({ ...crouch(20, 0, 0, ARMS.front), footRHeel: 4, footLHeel: 40 });
// Le pied gauche suit le bassin en l'air : sa hauteur se compte depuis lui, comme pour le droit.
const hop = (index: number, extra: Partial<KeyDraft> = {}): KeyDraft[] => [
  {
    id: `hop-bottom-${index}`,
    set: hopLow,
    air: ["L"],
    ...extra,
    move: { ms: 110, curve: "reception", phase: "contact" },
  },
  { id: `hop-takeoff-${index}`, set: hopPush, air: ["L"], move: { ms: 120, curve: "elan", phase: "contact" } },
  ...airborne(BASE, RIG, {
    from: hopPush,
    to: hopTouch,
    ms: HOP_FLIGHT,
    phase: "flight",
    samples: 6,
    id: `hop-${index}`,
  }),
  land(`hop-touch-${index}`, hopTouch, HOP_FLIGHT, { air: ["L"] }, 6),
];
export const singleLegHops = gesture({
  key: "single-leg-hops",
  athlete: ATHLETE,
  rig: RIG,
  base: BASE,
  keys: [
    { id: "standing", set: stand(), hold: 500, move: { ms: 450, curve: "reception", phase: "reset" } },
    {
      id: "one-leg",
      guide: 0,
      set: oneLeg({ ...stand(), pelvisY: 168 }),
      hold: 500,
      air: ["L"],
      move: { ms: 450, curve: "impulsion", phase: "set" },
    },
    { id: "hop-set", guide: 1, set: hopLow, air: ["L"], still: true, move: { ms: 280, curve: "elan", phase: "dip" } },
    { id: "hop-takeoff-0", set: hopPush, air: ["L"], move: { ms: 150, curve: "elan", phase: "contact" } },
    ...airborne(BASE, RIG, { from: hopPush, to: hopTouch, ms: HOP_FLIGHT, phase: "flight", samples: 6, id: "hop-0" }),
    land("hop-touch-0", hopTouch, HOP_FLIGHT, { air: ["L"], guide: 2, still: true }, 6),
    ...hop(1),
    {
      id: "settle",
      guide: 3,
      set: hopLow,
      air: ["L"],
      hold: 400,
      move: { ms: 160, curve: "reception", phase: "landing" },
    },
  ],
});
