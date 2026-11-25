import { gesture, type KeyDraft } from "../gesture";
import { hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { jerking, jerkSplit } from "./jerk";

// Le bassin et les pieds reprennent la réception du jeté. L'éducatif laisse les mains libres.
const arms = { ...hands(12, -76, 34), armsLong: 0, wrist: 0 };
const start: ControlPatch = { ...jerking, pelvisX: -17, pelvisY: 999, ...arms };
const split: ControlPatch = { ...jerkSplit, ...arms, neck: 0, shrug: 0 };
const mark = (x: number, z: number): Prop => ({
  native: "top",
  at: 0,
  half: 1,
  paint: "lane",
  shape: { kind: "rect", x: x - 6, y: z - 8, width: 12, height: 16 },
});
const key = (
  id: string,
  set: ControlPatch,
  ms: number,
  hold: number,
  air: KeyDraft["air"] = [],
  guide?: number,
): KeyDraft => ({
  id,
  set,
  hold,
  air,
  guide,
  move: { ms, phase: id, curve: "reception" },
});
export const jerkFootwork = gesture({
  key: "jerk-footwork",
  athlete: "poleVault",
  rig: { bar: null },
  views: ["side", "top"],
  keys: [
    key("stand", start, 620, 520, [], 0),
    key("dip", { ...start, pelvisY: 151 }, 260, 40),
    key("push", { ...start, footRHeel: 24, footLHeel: 24 }, 280, 30),
    key("split-air", { ...split, footRX: 47, footLX: -74, footRLift: 9, footLLift: 10, pelvisY: 158 }, 180, 0, [
      "R",
      "L",
    ]),
    key("split", split, 140, 850, [], 1),
    key("front-back", { ...split, footRX: 44, footRLift: 13, pelvisX: -28 }, 300, 40, ["R"]),
    key("front-down", { ...split, footRX: 22, pelvisX: -38, pelvisPitch: 8 }, 330, 120),
    key(
      "rear-forward",
      { ...start, footRX: 22, footRZ: 28, footRYaw: 4, footLX: -52, footLLift: 12, footLHeel: 18, pelvisY: 153 },
      380,
      60,
      ["L"],
    ),
    key("rear-down", { ...start, footRX: 22, footRZ: 28, footRYaw: 4 }, 350, 100),
    key("bring-together", { ...start, footRX: 21, footRZ: 24, footRLift: 8 }, 280, 30, ["R"]),
    key("finish", start, 280, 520, [], 2),
  ],
  props: () => [mark(split.footRX!, split.footRZ!), mark(split.footLX!, split.footLZ!)],
});
