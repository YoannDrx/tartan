import { gesture, type KeyDraft } from "../gesture";
import { hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import type { Side, Solved } from "../solve";
import { airborne } from "./flight";
import { approachStride } from "./high-jump";

type Point = { x: number; z: number };
type Step = { side: Side; to: Point; lift?: number };
const rig = { bar: null };
const cone = (x: number, z: number): Prop => ({
  native: "side",
  at: z,
  half: 6,
  paint: "cone",
  shape: {
    kind: "poly",
    points: [
      { x: x - 7, y: 0 },
      { x, y: -16 },
      { x: x + 7, y: 0 },
    ],
  },
});
const stripe = (x: number, z: number, lateral = false): Prop => ({
  native: "top",
  at: 0,
  half: 1,
  paint: "lane",
  shape: {
    kind: "rect",
    x: x - (lateral ? 60 : 2),
    y: z - (lateral ? 2 : 48),
    width: lateral ? 120 : 4,
    height: lateral ? 4 : 96,
  },
});
const bandPost = (x: number, z: number, height: number): Prop => ({
  native: "side",
  paint: "iron",
  at: z,
  half: 5,
  shape: { kind: "rect", x: x - 4, y: -height, width: 8, height },
});
function wicket(key: string, xs: number[], timings: number[], props: Prop[]) {
  const keys: KeyDraft[] = [];
  for (const [i, x] of xs.entries()) {
    const side = i % 2 ? "R" : "L",
      free: Side = i % 2 ? "L" : "R",
      touch = approachStride(side, x, "touch");
    const ms = timings[i]!;
    if (i)
      keys.push(
        ...airborne({}, rig, {
          from: approachStride(free, xs[i - 1]!, "push"),
          to: touch,
          ms,
          phase: "flight",
          id: `flight-${i}`,
          samples: 5,
        }),
      );
    keys.push(
      {
        id: `plant-${i}`,
        guide: i === 0 ? 0 : i === 2 ? 1 : undefined,
        hold: i === 0 ? 340 : 25,
        air: [free],
        set: touch,
        move: i
          ? { ms: ms / 5, curve: "linear", phase: "flight" }
          : { ms: 1, phase: "reset", curve: "linear", cut: true },
      },
      {
        id: `push-${i}`,
        guide: i === xs.length - 1 ? 2 : undefined,
        set: approachStride(side, x, "push"),
        air: [free],
        hold: i === xs.length - 1 ? 340 : 20,
        move: { ms, phase: "drive", curve: "impulsion" },
      },
    );
  }
  return gesture({ key, athlete: "hurdles", rig, keys, props: () => props, views: ["side", "top"] });
}

type StepsOptions = {
  key: string;
  start: Record<Side, Point>;
  steps: Step[];
  props: (t: number, b: Solved) => Prop[];
  mode?: "jack" | "resisted" | "pallof";
};
function walk({ key, start, steps, props, mode }: StepsOptions) {
  const feet = { ...start };
  function posture(side: Side | undefined, lift: number): ControlPatch {
    const midZ = (feet.R.z + feet.L.z) / 2,
      wide = Math.max(0, Math.min(1, (feet.R.z - feet.L.z - 34) / 42));
    return {
      pelvisX: (feet.R.x + feet.L.x) / 2 - 12,
      pelvisZ: midZ,
      pelvisY: mode === "resisted" ? 157 : 160,
      pelvisPitch: mode === "resisted" ? 9 : 3,
      footRX: feet.R.x,
      footLX: feet.L.x,
      footRZ: feet.R.z,
      footLZ: feet.L.z,
      footRYaw: 0,
      footLYaw: 0,
      footRLift: side === "R" ? lift : 0,
      footLLift: side === "L" ? lift : 0,
      footRHeel: side === "R" ? lift * 0.55 : 0,
      footLHeel: side === "L" ? lift * 0.55 : 0,
      ...(mode === "jack"
        ? hands(9, -94 * Math.cos(wide * Math.PI), 35 + 85 * Math.sin(wide * Math.PI))
        : mode === "pallof"
          ? hands(81, -36, 7)
          : hands(25, -78, 36)),
    };
  }
  const keys: KeyDraft[] = [
    {
      id: "start",
      set: posture(undefined, 0),
      guide: 0,
      hold: 350,
      move: { ms: 1, phase: "reset", curve: "linear", cut: true },
    },
  ];
  for (const [i, step] of steps.entries()) {
    const before = feet[step.side],
      land = step.to;
    feet[step.side] = { x: (before.x + land.x) / 2 + (mode === "resisted" ? 20 : 0), z: (before.z + land.z) / 2 };
    keys.push({
      id: `lift-${i}`,
      set: posture(step.side, step.lift ?? 14),
      air: [step.side],
      hold: mode === "resisted" ? 180 : 35,
      guide: i === 1 ? 1 : undefined,
      move: { ms: 240, phase: "lift", curve: "elan" },
    });
    feet[step.side] = land;
    keys.push({
      id: `place-${i}`,
      set: posture(undefined, 0),
      hold: i === steps.length - 1 ? 440 : 75,
      guide: i === steps.length - 1 ? 2 : undefined,
      move: { ms: 260, phase: "place", curve: "reception" },
    });
  }
  return gesture({
    key,
    athlete: "hurdles",
    rig,
    keys,
    props,
    views: mode === "resisted" ? ["side", "front"] : ["front", "top", "side"],
  });
}
const home = { R: { x: 0, z: 17 }, L: { x: 0, z: -17 } };
const lateral = (side: Side, z: number, x = 0): Step => ({ side, to: { x, z } });
const lateralSteps = [
  lateral("R", 62),
  lateral("L", 35),
  lateral("R", 107),
  lateral("L", 80),
  lateral("L", 35),
  lateral("R", 62),
  lateral("L", -17),
  lateral("R", 17),
];
const insideOutside: Step[] = [];
for (const x of [-48, 34]) {
  insideOutside.push(
    lateral("R", 12, x),
    lateral("L", -12, x + 11),
    lateral("R", 50, x + 30),
    lateral("L", -50, x + 41),
  );
}
const jack = [lateral("R", 65), lateral("R", 17), lateral("L", -65), lateral("L", -17)];
const bandWalk: Step[] = ["R", "L", "R", "L"].map((side, i) => ({
  side: side as Side,
  to: { x: -54 + i * 42, z: side === "R" ? 17 : -17 },
  lift: 53,
}));
export const stadiumFootwork = [
  wicket(
    "wicket-run",
    [-153, -114, -67, -12, 43, 98],
    [195, 190, 170, 165, 165, 165],
    [-94, -39, 16, 71].map((x) => stripe(x, 0)),
  ),
  wicket(
    "wicket-exit",
    [-145, -93, -41, 11, 71, 140],
    [180, 180, 180, 180, 168, 158],
    [-119, -67, -15].map((x) => stripe(x, 0)),
  ),
  wicket(
    "cone-rhythm-change",
    [-152, -107, -62, -17, 28, 73, 118],
    [215, 215, 210, 175, 158, 158, 158],
    [-42, 90].flatMap((x) => [cone(x, -45), cone(x, 45)]),
  ),
  walk({
    key: "lateral-wickets",
    start: home,
    steps: lateralSteps,
    props: () => [23, 70].map((z) => stripe(0, z, true)),
  }),
  walk({
    key: "cone-fast-in-out",
    start: { R: { x: -85, z: 17 }, L: { x: -85, z: -17 } },
    steps: insideOutside,
    props: () => [-79, -8, 69].flatMap((x) => [cone(x, -31), cone(x, 31)]),
  }),
  walk({ key: "step-jack", start: home, steps: jack, mode: "jack", props: () => [] }),
  walk({
    key: "band-resisted-march",
    start: { R: { x: -95, z: 17 }, L: { x: -95, z: -17 } },
    steps: bandWalk,
    mode: "resisted",
    props: (_, b) => [
      bandPost(-215, 0, 171),
      {
        native: "side",
        at: 0,
        half: 3,
        paint: "band",
        shape: { kind: "line", from: { x: -215, y: -160 }, to: { x: b.pelvis.x - 8, y: -b.pelvis.y }, width: 5 },
      },
    ],
  }),
  walk({
    key: "band-pallof-step",
    start: home,
    steps: [lateral("R", 62), lateral("L", 35), lateral("L", -17), lateral("R", 17)],
    mode: "pallof",
    props: (_, b) => [
      bandPost(80, -128, 214),
      {
        native: "front",
        at: b.arms.R.hand.x,
        half: 2,
        paint: "band",
        front: true,
        shape: { kind: "line", from: { x: 128, y: -206 }, to: { x: -b.arms.L.hand.z, y: -b.arms.L.hand.y }, width: 4 },
      },
    ],
  }),
];
