// Les appuis sont indiqués dans l’ordre de la fiche, depuis le pied gauche.
// Les durées règlent la lecture de l’animation, sans constituer une prescription.
import { gesture, type KeyDraft } from "../gesture";
import { hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import type { Side } from "../solve";
import { airborne } from "./flight";

const rig = { bar: null };
type Contact = Side | "both";
type Landing = { on: Contact; x: number; ms: number };
const other = (side: Side): Side => (side === "L" ? "R" : "L");

function contact(on: Contact, x: number, depth: number): ControlPatch {
  const pose: ControlPatch = {
    pelvisX: x - 12 - depth / 3,
    pelvisY: 168 - depth,
    pelvisPitch: 5 + depth / 3,
    footRX: x,
    footLX: x,
    footRZ: 15,
    footLZ: -15,
    footRYaw: 2,
    footLYaw: 2,
    ...hands(30, -68, 33),
  };
  if (on === "both") return { ...pose, ...hands(52, -49, 32) };
  const free = other(on);
  return {
    ...pose,
    [`foot${free}X`]: x + 32,
    [`foot${free}Lift`]: 60,
    [`foot${free}Heel`]: 18,
    [`hand${on}Forward`]: 52,
    [`hand${free}Forward`]: -10,
  };
}

function mark(x: number, width: number, paint: Prop["paint"]): Prop {
  return { native: "side", paint, at: 0, half: 40, shape: { kind: "rect", x: x - width / 2, y: 0, width, height: 3 } };
}

function bounds(
  key: string,
  from: number,
  landings: Landing[],
  { sand = false, zones = false, approach = false }: { sand?: boolean; zones?: boolean; approach?: boolean } = {},
) {
  let on: Contact = approach ? "R" : "L";
  let x = from;
  const keys: KeyDraft[] = [
    {
      id: "start",
      guide: 0,
      set: contact(on, x, 10),
      hold: 420,
      air: [other(on)],
      move: { ms: 1, phase: "reset", curve: "linear", cut: true },
    },
  ];
  for (const [i, landing] of landings.entries()) {
    const last = i === landings.length - 1;
    const push = contact(on, x, 0);
    const receive = contact(landing.on, landing.x, last ? 25 : 12);
    const free: Side[] = on === "both" ? [] : [other(on)];
    keys.push({
      id: `push-${i}`,
      guide: i === (approach ? 1 : 0) ? 1 : undefined,
      set: push,
      air: free,
      hold: 28,
      move: { ms: 105, phase: "takeoff", curve: "impulsion" },
    });
    keys.push(
      ...airborne({}, rig, { from: push, to: receive, ms: landing.ms, id: `flight-${i}`, phase: "flight", samples: 8 }),
    );
    keys.push({
      id: `contact-${i}`,
      guide: last ? 2 : undefined,
      set: receive,
      air: landing.on === "both" ? [] : [other(landing.on)],
      hold: last ? 720 : 65,
      move: { ms: landing.ms / 8, phase: "flight", curve: "linear" },
    });
    on = landing.on;
    x = landing.x;
  }
  const props = [mark(approach ? landings[0]!.x : from, 12, "board")];
  if (sand) props.push(mark(x + 12, 105, "sand"));
  if (zones) props.push(...landings.map((landing) => mark(landing.x, 49, "lane")));
  return gesture({ key, athlete: "longJump", rig, keys, props: () => props, views: ["side", "front"] });
}

const left = (x: number, ms: number): Landing => ({ on: "L", x, ms });
const right = (x: number, ms: number): Landing => ({ on: "R", x, ms });
const both = (x: number, ms: number): Landing => ({ on: "both", x, ms });

// Le pied libre transfère le poids entre les deux marques gauches. Ce pas de marche ne compte pas comme une marque.
function walkMarks() {
  let feet = { L: -90, R: -110 };
  function pose(lifted?: Side, height = 0): ControlPatch {
    return {
      footLX: feet.L,
      footRX: feet.R,
      footLZ: -15,
      footRZ: 15,
      footRYaw: 0,
      footLYaw: 0,
      pelvisX: (feet.R + feet.L) / 2 - 12,
      pelvisY: 164,
      pelvisPitch: 4,
      ...hands(25, -83, 34),
      ...(lifted ? { [`foot${lifted}Lift`]: height, [`foot${lifted}Heel`]: height * 0.4 } : {}),
    };
  }
  const keys: KeyDraft[] = [
    {
      id: "first-mark",
      guide: 0,
      set: pose(),
      hold: 570,
      move: { ms: 1, curve: "linear", phase: "reset", cut: true },
    },
  ];
  function step(side: Side, x: number, id: string, guide?: number) {
    const start = feet[side];
    feet = { ...feet, [side]: (start + x) / 2 };
    keys.push({ id: id + "-swing", set: pose(side, 22), air: [side], move: { ms: 255, phase: "walk", curve: "elan" } });
    feet = { ...feet, [side]: x };
    keys.push({
      id,
      guide,
      set: pose(),
      hold: guide === undefined ? 145 : 410,
      move: { ms: 265, phase: "walk", curve: "reception" },
    });
  }
  step("R", -56, "transfer");
  step("L", -26, "second-left", 1);
  step("R", 14, "right-mark");
  step("L", 55, "finish-left");
  step("R", 55, "feet-together", 2);
  return gesture({
    key: "triple-walk",
    athlete: "longJump",
    rig,
    keys,
    views: ["side", "top"],
    props: () => [-90, -26, 14, 55].map((x) => mark(x, 10, "lane")),
  });
}

export const tripleJumps = [
  walkMarks(),
  bounds("step-jump-sand", -96, [right(-10, 345), both(93, 420)], { sand: true }),
  bounds("short-triple", -170, [left(-128, 190), left(-45, 340), right(38, 328), both(135, 410)], {
    approach: true,
    sand: true,
  }),
  bounds("double-hop-step", -125, [left(-46, 320), left(34, 318), right(110, 338)]),
  bounds("triple-rhythm-zones", -120, [left(-39, 345), right(32, 315), both(117, 380)], { sand: true, zones: true }),
  bounds("step-switch-stick", -40, [right(44, 375)]),
  bounds("hop-runout", -140, [left(-105, 175), left(-35, 330), right(13, 205), left(66, 194), right(121, 192)], {
    approach: true,
  }),
];
