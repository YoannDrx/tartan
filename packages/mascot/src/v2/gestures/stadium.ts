// Les trois lignes d'une fiche de stade correspondent à l'installation, au geste puis au retour.
import { gesture, type MotionClip, type KeyDraft } from "../gesture";
import { hands, heels, stance, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { FIGURE } from "../body";
import { racked, CLEAN_GRIP } from "./clean";
import { strideClip } from "./stride";
import { airborne } from "./flight";

const rig = { bar: null };
const positioned = (
  id: string,
  guide: number | undefined,
  set: ControlPatch,
  hold: number,
  ms: number,
  extra: Partial<KeyDraft> = {},
): KeyDraft => ({
  id,
  guide,
  set,
  hold,
  move: { ms, phase: id, curve: "impulsion" },
  ...extra,
});
const rack = (depth: number, pitch: number) => {
  const posture = { ...stance(45, 25, 12.5), pelvisY: depth, pelvisPitch: pitch, neck: -10, armsLong: 0 };
  return racked({ ...posture, pelvisX: -racked({ ...posture, pelvisX: 0 }).barX! });
};
const cleanHold = gesture({
  key: "clean-front-rack",
  athlete: "poleVault",
  rig: { bar: { grip: CLEAN_GRIP, hold: "hands" } },
  keys: [
    positioned("rack", 0, rack(999, 4), 650, 650),
    positioned("reception", 1, rack(64, 18), 1350, 850),
    positioned("stand", 2, rack(999, 4), 420, 650),
  ],
});
const snap = gesture({
  key: "snap-down",
  athlete: "highJump",
  rig,
  keys: [
    positioned("raise", 0, { pelvisY: 999, ...heels(30), ...hands(30, 12, 40) }, 700, 600),
    positioned("catch", 1, { pelvisY: 122, pelvisX: -30, pelvisPitch: 26, ...hands(48, -35, 36) }, 650, 220),
    positioned("stabilize", 2, { pelvisY: 122, pelvisX: -30, pelvisPitch: 26, ...hands(48, -35, 36) }, 950, 100),
  ],
});
const seated = {
  pelvisY: 30,
  pelvisX: 0,
  pelvisPitch: 4,
  footRX: 155,
  footRZ: 18,
  footRYaw: 0,
  footLX: 120,
  footLZ: -30,
  footLYaw: 0,
  ...hands(50, -40, 32),
};
const dorsiflex = (degrees: number): ControlPatch => {
  const radians = (degrees * Math.PI) / 180,
    lever = FIGURE.foot.ball + FIGURE.foot.heel;
  return {
    ...seated,
    footRHeel: -degrees,
    footRLift: lever * Math.sin(radians),
    footRX: seated.footRX - lever * (1 - Math.cos(radians)),
  };
};
const band = gesture({
  key: "band-dorsiflexion",
  athlete: "longJump",
  rig,
  keys: [
    positioned("heel-down", 0, dorsiflex(0), 680, 360, { air: ["R"] }),
    positioned("pull", 1, dorsiflex(22), 520, 680, { air: ["R"] }),
    positioned("release", 2, dorsiflex(0), 500, 950, { air: ["R"] }),
  ],
  props: (_, body) => [
    { native: "side", paint: "iron", at: 18, half: 6, shape: { kind: "rect", x: 258, y: -20, width: 10, height: 20 } },
    {
      native: "side",
      paint: "band",
      front: true,
      at: 18,
      half: 2,
      shape: {
        kind: "line",
        from: { x: 263, y: -10 },
        to: { x: body.legs.R.ball.x, y: -body.legs.R.ball.y - 5 },
        width: 4,
      },
    },
  ],
});
const cone = (x: number, z: number): Prop => ({
  native: "side",
  paint: "cone",
  at: z,
  half: 7,
  shape: {
    kind: "poly",
    points: [
      { x: x - 10, y: 0 },
      { x: x - 2, y: -22 },
      { x: x + 2, y: -22 },
      { x: x + 10, y: 0 },
    ],
  },
});
const running = strideClip({
  key: "cone-high-knees",
  athlete: "hurdles",
  cadence: 155,
  step: 50,
  flight: 0.32,
  knee: 78,
  heel: 100,
  lean: 0,
  arms: 0.9,
  sink: 4,
  reach: 10,
  guides: [0, undefined, 1, 2],
});
const cones: MotionClip = {
  ...running,
  props: (t, body) => [
    ...running.props(t, body),
    ...[-2, -1, 0, 1, 2].map((i) => ({ ...cone(i * 100 - t * 100, -48), scroll: true })),
  ],
};
// Chaque pas passe par un double appui. Le pied porteur conserve ses coordonnées au sol.
const walking = (key: string, raised: number, loaded: boolean) => {
  const pose = (right: number, left: number, liftR = 0, liftL = 0): ControlPatch => ({
    pelvisX: (right + left) / 2 - 12,
    pelvisY: 162,
    pelvisPitch: 3,
    footRX: right,
    footLX: left,
    footRZ: 16,
    footLZ: -16,
    footRYaw: 0,
    footLYaw: 0,
    footRLift: liftR,
    footLLift: liftL,
    footRHeel: liftR * 0.55,
    footLHeel: liftL * 0.55,
    ...hands(loaded ? 5 : 32, loaded ? -104 : -60, 36),
  });
  return gesture({
    key,
    athlete: loaded ? "discus" : "hurdles",
    rig,
    keys: [
      positioned("ready", 0, pose(-42, -72), 480, 1, { move: { ms: 1, phase: "reset", curve: "linear", cut: true } }),
      positioned("left-swing", 1, pose(-42, -32, 0, raised), 150, 250, { air: ["L"] }),
      positioned("left-lands", undefined, pose(-42, 12), 90, 250),
      positioned("right-swing", undefined, pose(6, 12, raised), 150, 250, { air: ["R"] }),
      positioned("right-lands", 2, pose(58, 12), 480, 250),
    ],
  });
};
const walk = walking("step-over-cone", 55, false);
const steps: MotionClip = { ...walk, props: () => [cone(-17, -6), cone(34, 12)] };
const loadedWalk = walking("kb-suitcase", 16, true);
const carry: MotionClip = {
  ...loadedWalk,
  props: (t, body) => {
    const hand = body.arms.R.hand;
    return [
      ...loadedWalk.props(t, body),
      {
        native: "side",
        paint: "iron",
        at: hand.z,
        half: 8,
        front: true,
        shape: {
          kind: "curve",
          from: { x: hand.x - 8, y: -hand.y + 12 },
          control: { x: hand.x, y: -hand.y - 12 },
          to: { x: hand.x + 8, y: -hand.y + 12 },
          width: 4,
        },
      },
      {
        native: "side",
        paint: "iron",
        at: hand.z,
        half: 12,
        front: true,
        shape: { kind: "disc", x: hand.x, y: -hand.y + 18, radius: 12 },
      },
    ];
  },
};
const support = (side: "R" | "L", x: number, z: number, flex: number): ControlPatch => {
  const free = side === "L" ? "R" : "L";
  return {
    pelvisX: x - 10,
    pelvisY: 163 - flex,
    pelvisZ: z,
    pelvisPitch: 7,
    footRX: x,
    footLX: x,
    footRYaw: 0,
    footLYaw: 0,
    footRZ: z + 16,
    footLZ: z - 16,
    [`foot${free}X`]: x + 33,
    [`foot${free}Lift`]: 56,
    [`foot${free}Heel`]: 18,
    ...hands(28, -60, 34),
  };
};
const jumpLink = (key: string, hop: boolean): MotionClip => {
  const first = support("L", -110, -12, 10),
    push = support("L", -110, -12, 0),
    landing = hop ? support("L", 0, -12, 14) : support("R", 64, 14, 14);
  const end = support("R", 98, -12, 20);
  const flight = (from: ControlPatch, to: ControlPatch, ms: number, id: string) =>
    airborne({}, rig, { from, to, ms, id, phase: "flight", samples: 8 });
  const keys: KeyDraft[] = [
    positioned("approach", 0, first, 480, 1, {
      air: ["R"],
      move: { ms: 1, phase: "reset", curve: "linear", cut: true },
    }),
    positioned("takeoff", 1, push, 80, 220, { air: ["R"] }),
    ...flight(push, landing, 350, "takeoff"),
    positioned("contact", hop ? undefined : 2, landing, hop ? 90 : 500, 350 / 8, { air: [hop ? "R" : "L"] }),
  ];
  if (hop) keys.push(...flight(landing, end, 385, "step"), positioned("balance", 2, end, 900, 385 / 8, { air: ["L"] }));
  return gesture({
    key,
    athlete: "highJump",
    rig,
    keys,
    views: ["side", "front"],
    props: () => (hop ? [] : [cone(-130, -64), cone(-38, -54), cone(55, -20)]),
  });
};
export const STADIUM_GESTURES: MotionClip[] = [
  jumpLink("curve-pop-up", false),
  jumpLink("hop-step-stick", true),
  cones,
  snap,
  cleanHold,
  carry,
  band,
  steps,
];
