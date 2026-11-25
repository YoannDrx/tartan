import { gesture, type KeyDraft } from "../gesture";
import { hands, stance, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import type { Side, Solved } from "../solve";
import type { Vec3 } from "../vec";

const rig = { bar: null };
const base = { ...stance(28, 14, 10), pelvisY: 999, pelvisPitch: 2, wrist: 0 };
const rack = { handRForward: 24, handRUp: -8, handROut: 32, elbowRForward: 0.6, elbowRUp: -1 };
const hold = (id: string, set: ControlPatch, guide?: number, air: Side[] = [], ms = 650): KeyDraft => ({
  id,
  set,
  guide,
  air,
  hold: 320,
  move: { ms, phase: id, curve: "impulsion" },
});

// Le centre de la prise reste au sommet de l'anse. En rack la masse passe du côté de l'avant-bras.
function bell(grip: Vec3, offset: number, drop: number): Prop[] {
  const x = grip.x + offset;
  return [
    {
      native: "side",
      paint: "iron",
      front: true,
      at: grip.z,
      half: 8,
      shape: {
        kind: "curve",
        from: { x: x - 8, y: -grip.y + drop - 5 },
        control: { x: grip.x - offset, y: -grip.y - drop + 5 },
        to: { x: x + 8, y: -grip.y + drop - 5 },
        width: 4,
      },
    },
    {
      native: "side",
      paint: "iron",
      front: true,
      at: grip.z,
      half: 12,
      shape: { kind: "disc", x, y: -grip.y + drop, radius: 12 },
    },
  ];
}
const rackedBell = (b: Solved, side: Side) => bell(b.arms[side].hand, -10, 15);

const march = gesture({
  key: "kb-rack-march",
  athlete: "discus",
  rig,
  base: { ...base, ...rack },
  keys: [
    hold("rack", {}, 0),
    hold("right-knee", { footRX: 47, footRLift: 66, footRHeel: 16, pelvisZ: -11 }, 1, ["R"]),
    hold("both-feet", {}),
    hold("left-knee", { footLX: 47, footLLift: 66, footLHeel: 16, pelvisZ: 11 }, undefined, ["L"]),
    hold("stand", {}, 2),
  ],
  props: (_, b) => rackedBell(b, "R"),
  views: ["front", "side"],
});
const squat = gesture({
  key: "kb-front-rack-squat",
  athlete: "discus",
  rig,
  base: { ...base, ...stance(45, 24, 14), ...hands(24, -8, 32), elbowRForward: 0.6, elbowLForward: 0.6 },
  keys: [
    hold("rack", {}, 0),
    hold("squat", { pelvisY: 108, pelvisX: -44, pelvisPitch: 19 }, 1, [], 950),
    hold("stand", {}, 2, [], 850),
  ],
  props: (_, b) => [...rackedBell(b, "R"), ...rackedBell(b, "L")],
  views: ["front", "side"],
});
const low = { pelvisY: 87, pelvisPitch: 51, pelvisX: -49, handRPin: 1, handRX: 9, handRY: 30, handRZ: 1 };
const clean = gesture({
  key: "kb-dead-clean",
  athlete: "discus",
  rig,
  base: { ...base, ...stance(54, 26, 10) },
  keys: [
    { ...hold("floor", low, 0), move: { ms: 1, phase: "reset", curve: "linear", cut: true } },
    hold(
      "lift",
      { pelvisY: 143, pelvisX: -27, pelvisPitch: 29, handRPin: 1, handRX: 14, handRY: 89, handRZ: 13 },
      undefined,
      [],
      480,
    ),
    hold("extend", { handRForward: 22, handRUp: -60, handROut: 27, pelvisY: 999 }, 1, [], 350),
    hold("receive", { ...rack, pelvisY: 152 }, undefined, [], 420),
    hold("rack", rack, 2),
  ],
  props: (_, b) => {
    const turn = Math.min(1, Math.max(0, (b.arms.R.hand.y - b.chest.y + 40) / 45));
    return bell(b.arms.R.hand, -10 * turn, 18 - 3 * turn);
  },
  views: ["side", "front"],
});

// Les deux mains tiennent les cornes. Elles suivent ensemble le contour de la tête, y compris au retour.
const haloGrip = (x: number, up: number, z: number): ControlPatch => ({
  handRForward: x,
  handLForward: x,
  handRUp: up,
  handLUp: up,
  handROut: z + 8,
  handLOut: 8 - z,
});
const front = haloGrip(43, -12, 0),
  right = haloGrip(0, 29, 47),
  back = haloGrip(-38, 35, 0),
  left = haloGrip(0, 29, -47);
const halo = gesture({
  key: "kb-halo",
  athlete: "discus",
  rig,
  base,
  keys: [
    hold("front", front, 0),
    hold("right", right),
    hold("behind", back, 1),
    hold("left", left),
    hold("return", front),
    hold("reverse-left", left),
    hold("reverse-behind", back),
    hold("reverse-right", right),
    hold("finish", front, 2),
  ],
  props: (_, b) => {
    const a = b.arms.R.hand,
      c = b.arms.L.hand;
    return bell({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, z: (a.z + c.z) / 2 }, 0, 16);
  },
  views: ["top", "front", "side"],
});
export const stadiumKettlebells = [march, clean, halo, squat];
