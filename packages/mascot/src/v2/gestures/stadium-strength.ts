import { FIGURE } from "../body";
import { gesture, type KeyDraft } from "../gesture";
import { hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { dumbbells } from "./gym";

const rig = { bar: null };
const key = (
  id: string,
  guide: number,
  set: ControlPatch,
  hold: number,
  air: KeyDraft["air"] = [],
  ms = 740,
): KeyDraft => ({
  id,
  guide,
  set,
  air,
  hold,
  move: { ms, phase: id, curve: "reception" },
});
const stepProp: Prop = {
  native: "front",
  at: 2,
  half: 54,
  paint: "step",
  shape: { kind: "rect", x: -55, y: -28, width: 53, height: 28 },
};
const stand = {
  footRZ: 23,
  footLZ: -22,
  footRX: 8,
  footLX: 8,
  footRYaw: 0,
  footLYaw: 0,
  footRLift: 28,
  footLLift: 31,
  pelvisZ: 17,
  pelvisX: -12,
  pelvisY: 186,
  ...hands(24, -67, 40),
};
const stepDown = gesture({
  key: "lateral-step-down",
  athlete: "discus",
  rig,
  base: stand,
  views: ["front", "side"],
  keys: [
    key("stand", 0, {}, 500, ["L"]),
    key("touch", 1, { pelvisY: 155, pelvisX: -32, pelvisPitch: 15, footLLift: 9, footLHeel: -12 }, 550, ["L"]),
    key("rise", 2, {}, 460, ["L"]),
  ],
  props: () => [stepProp],
});
const hike = gesture({
  key: "hip-hike-step",
  athlete: "discus",
  rig,
  base: stand,
  views: ["front", "side"],
  keys: [
    key("level", 0, {}, 450, ["L"]),
    key("lower", 1, { pelvisRoll: 10, pelvisY: 180, footLLift: 15 }, 500, ["L"]),
    key("raise", 2, { pelvisRoll: -5, footLLift: 40 }, 600, ["L"]),
  ],
  props: () => [stepProp],
});
const split = {
  footRX: 58,
  footLX: -81,
  footRZ: 24,
  footLZ: -24,
  footRYaw: 4,
  footLYaw: -3,
  footLHeel: 45,
  pelvisX: -11,
  pelvisPitch: 5,
  ...hands(36, -56, 35),
};
const iso = gesture({
  key: "split-squat-iso",
  athlete: "discus",
  rig,
  base: split,
  views: ["side", "front"],
  keys: [
    key("start", 0, { pelvisY: 154 }, 500),
    key("hold", 1, { pelvisY: 115, pelvisPitch: 9 }, 1550),
    key("stand", 2, { pelvisY: 154 }, 480),
  ],
});
const stagger = {
  footRX: 20,
  footLX: -40,
  footRZ: 22,
  footLZ: -22,
  footLHeel: 34,
  footRYaw: 2,
  footLYaw: 2,
  pelvisX: -6,
  pelvisZ: 7,
  ...hands(12, -100, 44),
};
const rdl = gesture({
  key: "kickstand-rdl",
  athlete: "discus",
  rig,
  base: stagger,
  keys: [
    key("stand", 0, { pelvisY: 163 }, 550),
    key("hinge", 1, { pelvisX: -53, pelvisY: 141, pelvisPitch: 54, neck: -24, ...hands(76, -65, 46) }, 550),
    key("finish", 2, { pelvisY: 163 }, 500),
  ],
  props: (_, b) => dumbbells(b),
  views: ["side", "front"],
});
const wall: Prop = {
  native: "side",
  at: 0,
  half: 54,
  paint: "iron",
  shape: { kind: "rect", x: 82, y: -250, width: 6, height: 250 },
};
const heldWall = {
  handRPin: 1,
  handLPin: 1,
  handRX: 82,
  handLX: 82,
  handRY: 203,
  handLY: 203,
  handRZ: 32,
  handLZ: -32,
};
const bent = {
  ...heldWall,
  pelvisY: 146,
  pelvisX: -4,
  pelvisPitch: 9,
  footRX: 12,
  footRZ: 14,
  footRYaw: 0,
  footLX: -25,
  footLZ: -22,
  footLLift: 27,
  footLHeel: 28,
};
const soleus = gesture({
  key: "soleus-wall-hold",
  athlete: "discus",
  rig,
  base: bent,
  keys: [
    key("bend", 0, {}, 460, ["L"]),
    key("raise", 1, { footRHeel: 28, pelvisY: 158, pelvisX: 0 }, 1400, ["L"]),
    key("lower", 2, {}, 520, ["L"]),
  ],
  props: () => [wall],
  views: ["side", "front"],
});
const platform: Prop = {
  native: "side",
  at: 14,
  half: 21,
  paint: "step",
  shape: { kind: "rect", x: -33, y: -24, width: 87, height: 24 },
};
const ankle = gesture({
  key: "ankle-rock-step",
  athlete: "highJump",
  rig,
  base: {
    ...heldWall,
    footRX: 15,
    footRZ: 14,
    footRYaw: 0,
    footRLift: 24,
    footLX: -47,
    footLZ: -18,
    footLYaw: 0,
    pelvisX: -15,
    pelvisY: 160,
    pelvisPitch: 8,
  },
  keys: [
    key("ready", 0, {}, 420, ["R"]),
    key("rock", 1, { pelvisX: -12, pelvisY: 162, pelvisPitch: 10 }, 600, ["R"]),
    key("heel-up", 2, { pelvisY: 167, footRHeel: 30 }, 700, ["R"]),
  ],
  props: () => [platform, wall],
  views: ["side", "front"],
});
function ankleBand(inward: boolean) {
  const sign = inward ? -1 : 1,
    anchorZ = inward ? 125 : -85,
    lever = FIGURE.foot.ball + FIGURE.foot.heel;
  const turn = (degrees: number): ControlPatch => {
    const angle = (degrees * Math.PI) / 180;
    return { footRYaw: degrees, footRX: 117 + lever * Math.cos(angle), footRZ: 21 + lever * Math.sin(angle) };
  };
  const anchor: Prop = {
    native: "top",
    at: 5,
    half: 5,
    paint: "iron",
    shape: { kind: "rect", x: 151, y: anchorZ - 5, width: 10, height: 10 },
  };
  return gesture({
    key: inward ? "band-inversion" : "band-eversion",
    athlete: "highJump",
    rig,
    base: {
      pelvisY: 42,
      pelvisX: 0,
      pelvisPitch: 4,
      footRLift: 5,
      footLX: 119,
      footLZ: -27,
      footLYaw: 0,
      ...hands(48, -43, 32),
    },
    keys: [
      key("center", 0, turn(0), 520, ["R"]),
      key("turn", 1, turn(sign * 16), 540, ["R"]),
      key("release", 2, turn(0), 550, ["R"]),
    ],
    props: (_, b) => [
      anchor,
      {
        native: "top",
        at: 7,
        half: 2,
        paint: "band",
        front: true,
        shape: { kind: "line", from: { x: 156, y: anchorZ }, to: { x: b.legs.R.ball.x, y: b.legs.R.ball.z }, width: 4 },
      },
    ],
    views: ["top", "front", "side"],
  });
}
export const stadiumStrength = [stepDown, hike, iso, rdl, soleus, ankle, ankleBand(false), ankleBand(true)];
