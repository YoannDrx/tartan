import { gesture } from "../gesture";
import { type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { SIDES } from "../solve";

const heelsOnPads = (x: number): ControlPatch => ({
  footRX: x,
  footLX: x,
  footRZ: 19,
  footLZ: -19,
  footRYaw: 0,
  footLYaw: 0,
  footRLift: 24,
  footLLift: 24,
  footRHeel: -28,
  footLHeel: -28,
  kneeRForward: 0.5,
  kneeLForward: 0.5,
  kneeRUp: 1,
  kneeLUp: 1,
});
const bridge = {
  ...heelsOnPads(96),
  pelvisX: -15,
  pelvisY: 70,
  pelvisPitch: -114,
  neck: 18,
  handRPin: 1,
  handLPin: 1,
  handRX: 8,
  handLX: 8,
  handRY: 13,
  handLY: 13,
  handRZ: 51,
  handLZ: -51,
  elbowRForward: 0.5,
  elbowLForward: 0.5,
  elbowROut: 1,
  elbowLOut: 1,
};
const low = { ...bridge, pelvisX: -6, pelvisY: 35, pelvisPitch: -94, neck: 4 };
export const hamstringSlider = gesture({
  key: "hamstring-slider",
  athlete: "discus",
  rig: { bar: null },
  keys: [
    { id: "start", guide: 0, set: low, hold: 500, move: { ms: 650, phase: "lower", curve: "reception" } },
    { id: "bridge", set: bridge, hold: 360, move: { ms: 660, phase: "lift", curve: "elan" } },
    {
      id: "extend",
      guide: 1,
      set: { ...bridge, ...heelsOnPads(156) },
      slide: SIDES,
      hold: 420,
      move: { ms: 840, phase: "extend", curve: "reception" },
    },
    {
      id: "curl",
      guide: 2,
      set: bridge,
      slide: SIDES,
      hold: 620,
      move: { ms: 850, phase: "curl", curve: "reception" },
    },
  ],
  props: (_, b) =>
    SIDES.map((s): Prop => ({
      native: "side",
      at: b.legs[s].heel.z,
      half: 13,
      paint: "plate",
      shape: { kind: "rect", x: b.legs[s].heel.x - 14, y: -5, width: 33, height: 5, radius: 2 },
    })),
  views: ["side", "top"],
});
