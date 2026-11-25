// Les sauts à la barre : Ninon. Un élan court en foulées, l'avant-dernier appui plus bas, l'appel sur le pied
// gauche, genou droit et bras lancés vers le haut ; en l'air, le corps tourne le dos à la barre et la franchit
// tête la première, sur le dos, le bassin au plus haut, puis les jambes passent ; réception sur le haut du dos,
// sur le tapis. Le vol suit la gravité (flight.ts) : montée jusqu'au franchissement, puis descente jusqu'au tapis.
// L'élan complet ajoute deux foulées à l'élan réduit. Le geste ne revient pas à son départ : la lecture repart
// d'un coup. La courbe de l'élan, vue de profil, n'est pas montrée. Réglé à l'œil d'après les fiches du catalogue
// et la physique du vol : aucune source ouverte pour ce geste.
import { gesture, type KeyDraft } from "../gesture";
import { hands, heels, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { airborne, footFromPelvis, GRAVITY, kneesForward, settle } from "./flight";

const RIG = { bar: null };
const CLEAR_HEEL = 38;
const LAND_HEEL = -60;
const BAR = { x: 40, y: 236 };
const MAT = { from: 6, to: 300, top: 64 };
const TAKEOFF = -46;

// Une foulée d'élan : le pied `side` posé en `x`, le bassin un peu en arrière (le contact) ou au-dessus (l'appui).
export const approachStride = (side: "R" | "L", x: number, phase: "touch" | "push", low = 0): ControlPatch => {
  const other = side === "R" ? "L" : "R";
  const pelvis = phase === "touch" ? x - 30 : x + 22;
  return {
    [`foot${side}X`]: x,
    [`foot${side}Z`]: side === "R" ? 14 : -14,
    [`foot${side}Lift`]: 0,
    [`foot${side}Heel`]: phase === "touch" ? 0 : 34,
    // La jambe libre : derrière au contact, genou devant à l'appui.
    [`foot${other}X`]: phase === "touch" ? pelvis - 46 : pelvis + 26,
    [`foot${other}Z`]: other === "R" ? 14 : -14,
    [`foot${other}Lift`]: phase === "touch" ? 44 : 52,
    [`foot${other}Heel`]: phase === "touch" ? 50 : 20,
    pelvisX: pelvis,
    pelvisY: (phase === "touch" ? 160 : 999) - low,
    pelvisPitch: 8,
    neck: -6,
    ...(side === "L" ? { handRForward: 34, handLForward: -30 } : { handRForward: -30, handLForward: 34 }),
    handRUp: -100,
    handLUp: -100,
    handROut: 40,
    handLOut: 40,
  };
};
const strideFlight = (from: ControlPatch, to: ControlPatch, id: string): KeyDraft[] =>
  airborne({}, RIG, { from, to, ms: 150, samples: 3, phase: "approach", id });
const touchKey = (id: string, set: ControlPatch, other: "R" | "L", extra: Partial<KeyDraft> = {}): KeyDraft => ({
  id,
  set,
  air: [other],
  move: { ms: 70, curve: "linear", phase: "approach" },
  ...extra,
});

// L'appel : le pied gauche planté devant, le buste un peu en arrière, puis l'impulsion, genou droit et bras levés.
// Les jambes placées dans le repère du bassin (vers l'avant, vers le haut, vers l'extérieur), genoux vers l'avant.
const withLegs = (patch: ControlPatch, legs: Partial<Record<"R" | "L", [number, number, number]>>): ControlPatch => {
  let set = { ...patch };
  for (const [side, [forward, up, out]] of Object.entries(legs) as ["R" | "L", [number, number, number]][])
    set = { ...set, ...footFromPelvis({}, set, RIG, side, forward, up, out) };
  return { ...set, ...kneesForward(set) };
};
const plant = withLegs(
  {
    ...approachStride("L", TAKEOFF, "touch", 10),
    pelvisX: TAKEOFF - 38,
    pelvisPitch: -6,
    pelvisYaw: 34,
    ...hands(10, -60, 40),
  },
  { R: [-34, -126, 14] },
);
const drive = withLegs(
  {
    footLX: TAKEOFF,
    footLZ: -14,
    footLLift: 0,
    ...heels(0),
    footLHeel: 40,
    pelvisX: TAKEOFF - 6,
    pelvisY: 999,
    pelvisPitch: -4,
    pelvisYaw: 84,
    neck: -4,
    ...hands(40, 20, 50),
  },
  { R: [44, -66, 16] },
);
// Au-dessus de la barre : sur le dos, la tête passée, le bassin au plus haut, le dos cambré, les jambes pendantes.
const CLEAR_Y = BAR.y + 14;
const clearance = withLegs(
  {
    pelvisX: BAR.x + 4,
    pelvisY: CLEAR_Y,
    pelvisYaw: 180,
    pelvisPitch: -78,
    lumbar: -14,
    thoracic: -12,
    neck: 6,
    footRHeel: CLEAR_HEEL,
    footLHeel: CLEAR_HEEL,
    footRYaw: 188,
    footLYaw: -172,
    ...hands(0, -20, 100),
  },
  { R: [-58, -100, 16], L: [-58, -100, 16] },
);
// Sur le tapis : sur le haut du dos, les hanches fléchies, les jambes en l'air.
const LANDED_Y = MAT.top + 20;
const landed = withLegs(
  {
    pelvisX: BAR.x + 104,
    pelvisY: LANDED_Y + 14,
    pelvisYaw: 180,
    pelvisPitch: -96,
    lumbar: 10,
    thoracic: 10,
    neck: 18,
    footRHeel: LAND_HEEL,
    footLHeel: LAND_HEEL,
    footRYaw: 188,
    footLYaw: -172,
    ...hands(20, -40, 60),
  },
  { R: [80, -110, 18], L: [80, -110, 18] },
);

// Les durées de vol que donne la gravité : de l'impulsion au sommet, du sommet au tapis.
const rise = (CLEAR_Y - settle({}, drive, RIG).pelvisY) * 1.0;
const UP = 1000 * Math.sqrt((2 * rise) / GRAVITY);
const DOWN = 1000 * Math.sqrt((2 * (CLEAR_Y - settle({}, landed, RIG).pelvisY)) / GRAVITY);

const props = (): Prop[] => [
  {
    paint: "mat",
    shape: { kind: "rect", x: MAT.from, y: -MAT.top, width: MAT.to - MAT.from, height: MAT.top, radius: 8 },
    native: "side",
    at: 0,
    half: 150,
  },
  {
    paint: "post",
    shape: { kind: "rect", x: BAR.x - 4, y: -BAR.y - 40, width: 8, height: BAR.y + 40, radius: 2 },
    native: "side",
    at: -170,
    half: 4,
  },
  {
    paint: "bar",
    shape: { kind: "disc", x: BAR.x, y: -BAR.y, radius: 4 },
    native: "side",
    at: 0,
    half: 170,
    front: true,
  },
];

const highJumpOf = (key: string, strides: number) => {
  // L'élan : des foulées alternées jusqu'à l'avant-dernier appui (droit, plus bas), puis l'appel (gauche).
  const STEP = 150;
  const contacts: { side: "R" | "L"; x: number }[] = [];
  for (let i = strides; i >= 1; i -= 1) contacts.push({ side: i % 2 === 1 ? "R" : "L", x: TAKEOFF - i * STEP });
  const start = contacts[0]!.x;
  const ready: ControlPatch = {
    footRX: start,
    footRZ: 14,
    footLX: start - 40,
    footLZ: -14,
    pelvisX: start - 20,
    pelvisY: 999,
    pelvisPitch: 6,
  };
  const keys: KeyDraft[] = [
    { id: "ready", guide: 0, set: ready, hold: 700, move: { ms: 200, curve: "linear", phase: "reset", cut: true } },
  ];
  let previous: ControlPatch = ready;
  contacts.forEach(({ side, x }, index) => {
    const other = side === "R" ? "L" : "R";
    const last = index === contacts.length - 1;
    const low = last ? 12 : 0;
    const touch = approachStride(side, x, "touch", low);
    const push = approachStride(side, x, "push", low);
    if (index > 0) keys.push(...strideFlight(previous, touch, `approach-${index}`));
    keys.push(
      touchKey(`touch-${index}`, touch, other, {
        ...(index === 0 ? { move: { ms: 420, curve: "impulsion", phase: "approach" } } : {}),
        ...(index === 1 ? { guide: 1, still: true } : {}),
      }),
      { id: `push-${index}`, set: push, air: [other], move: { ms: 170, curve: "linear", phase: "approach" } },
    );
    previous = push;
  });
  keys.push(
    ...strideFlight(previous, plant, "penultimate"),
    { id: "plant", set: plant, air: ["R"], move: { ms: 80, curve: "linear", phase: "approach" } },
    {
      id: "takeoff",
      guide: 2,
      set: drive,
      air: ["R"],
      face: "effort",
      still: true,
      move: { ms: 210, curve: "elan", phase: "takeoff" },
    },
    ...airborne({}, RIG, {
      from: drive,
      to: clearance,
      ms: UP,
      samples: 5,
      phase: "rise",
      face: "effort",
      rotate: true,
    }),
    {
      id: "clearance",
      set: clearance,
      air: ["R", "L"],
      face: "effort",
      still: true,
      move: { ms: UP / 5, curve: "linear", phase: "rise" },
    },
    ...airborne({}, RIG, {
      from: clearance,
      to: landed,
      ms: DOWN,
      samples: 5,
      phase: "fall",
      face: "effort",
      rotate: true,
    }),
    {
      id: "landing",
      guide: 3,
      set: landed,
      air: ["R", "L"],
      hold: 700,
      face: "joy",
      move: { ms: DOWN / 5, curve: "linear", phase: "fall" },
    },
  );
  // De face, la barre passerait devant l'athlète pendant tout l'élan : de profil, puis de dessus.
  return gesture({ key, athlete: "highJump", rig: RIG, keys, props, views: ["side", "top"] });
};

export const highJumpShort = highJumpOf("high-jump-short", 3);
export const highJumpFull = highJumpOf("high-jump-full", 5);
