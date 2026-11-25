import { gesture, type KeyDraft } from "../gesture";
import { STAND, hands, type ControlPatch } from "../pose";
import type { Prop } from "../props";
import { solve } from "../solve";
import { turningStride } from "./curve-drills";
import { airborne } from "./flight";
import { approachStride } from "./high-jump";

const rig = { bar: null };
const reset = { ms: 1, phase: "reset", curve: "linear", cut: true } as const;
const key = (
  id: string,
  set: ControlPatch,
  guide: number | undefined,
  hold: number,
  ms: number,
  air: KeyDraft["air"] = [],
): KeyDraft => ({
  id,
  set,
  guide,
  hold,
  air,
  move: { ms, phase: id, curve: "impulsion" },
});

const line = (x: number, width = 6): Prop => ({
  native: "side",
  paint: "lane",
  at: 0,
  half: 46,
  shape: { kind: "rect", x: x - width / 2, y: 0, width, height: 2 },
});

function walking(scissors: boolean) {
  const pose = (right: number, left: number, upR: number, upL: number, hipY: number): ControlPatch => ({
    footRX: right,
    footLX: left,
    footRZ: 20,
    footLZ: -15,
    footRYaw: 0,
    footLYaw: 0,
    footRLift: upR,
    footLLift: upL,
    footRHeel: upR ? upR * 0.68 : Math.max(0, (left - right) * 0.36),
    footLHeel: upL ? upL * 0.68 : Math.max(0, (right - left) * 0.36),
    pelvisX: (right + left) / 2 - 12,
    pelvisY: hipY,
    pelvisPitch: scissors ? 2 : 5,
    ...hands(23, -76, 33),
  });
  const keys: KeyDraft[] = scissors
    ? [
        { ...key("oblique", pose(-70, -51, 0, 0, 161), 0, 520, 1), move: reset },
        key("lead-leg", pose(-12, -51, 59, 0, 165), 1, 260, 480, ["R"]),
        key("lead-down", pose(26, -51, 0, 0, 160), undefined, 160, 410),
        key("trail-leg", pose(26, -2, 0, 52, 163), undefined, 230, 420, ["L"]),
        key("together", pose(26, 34, 0, 0, 163), 2, 600, 420),
      ]
    : [
        { ...key("start", pose(-56, -83, 0, 0, 165), 0, 520, 1), move: reset },
        key("lower", pose(-56, -25, 0, 18, 155), 1, 340, 520, ["L"]),
        key("plant", pose(-56, 5, 0, 0, 157), undefined, 145, 340),
        key("rise", pose(-10, 5, 39, 0, 167), 2, 650, 510, ["R"]),
      ];
  return gesture({
    key: scissors ? "scissor-walkover" : "penultimate-walk",
    athlete: "highJump",
    rig,
    keys,
    props: () => (scissors ? [line(0)] : [line(-56), line(5)]),
    views: ["side", "front"],
  });
}

function takeoff(drill: "curve-arm-drive" | "jump-drive-target" | "scissor-jump") {
  const scissors = drill === "scissor-jump",
    target = drill === "jump-drive-target";
  const runningPose = (side: "R" | "L", phase: "touch" | "push") => {
    const x = side === "R" ? -112 : -48;
    if (drill !== "curve-arm-drive") return approachStride(side, x, phase);
    return turningStride(side, { x, z: side === "R" ? -26 : 0, yaw: side === "R" ? 12 : 25 }, phase, 5);
  };
  const start = runningPose("R", "touch");
  const firstPush = runningPose("R", "push");
  const plant = { ...runningPose("L", "touch"), ...hands(-14, -97, 51) };
  const push = {
    ...runningPose("L", "push"),
    pelvisPitch: 1,
    ...hands(83, 48, 48),
    ...(target ? { handRForward: 85, handRUp: 75, handLUp: -45 } : {}),
    ...(scissors ? { footRX: 52, footRLift: 74, footRHeel: 1 } : {}),
  };
  const x = scissors ? 84 : target ? 7 : 42;
  const surface = scissors ? 38 : 0;
  const receive: ControlPatch = {
    footRX: x,
    footLX: x - 7,
    footRZ: 17,
    footLZ: -17,
    footRLift: surface,
    footLLift: surface,
    footRYaw: 0,
    footLYaw: 0,
    pelvisX: x - 16,
    pelvisY: surface + 145,
    ...(drill === "curve-arm-drive"
      ? { pelvisZ: 37, footRZ: 54, footLZ: 20, pelvisYaw: 24, footRYaw: 24, footLYaw: -24 }
      : {}),
    pelvisPitch: 12,
    ...hands(57, -47, 42),
    ...(target ? { handRUp: 10, handRForward: 58 } : {}),
  };
  const ms = scissors ? 590 : target ? 485 : 390;
  const keys: KeyDraft[] = [
    { ...key("approach", start, 0, 450, 1, ["L"]), move: reset },
    key("first-push", firstPush, undefined, 30, 140, ["L"]),
    ...airborne({}, rig, { from: firstPush, to: plant, ms: 175, phase: "approach", samples: 5 }),
    key("plant", plant, undefined, 80, 35, ["R"]),
    key("drive", push, 1, 65, 265, ["R"]),
  ];
  const props: Prop[] = [line(-48)];
  if (scissors) {
    // La jambe droite franchit en premier. La gauche monte à son tour, la droite se prépare à se poser.
    const cross: ControlPatch = {
      ...receive,
      pelvisX: 13,
      pelvisY: 233,
      pelvisPitch: 2,
      footRX: 92,
      footRLift: 111,
      footRHeel: 0,
      footLX: -30,
      footLLift: 83,
      footLHeel: 22,
      ...hands(63, 2, 49),
    };
    const trailing: ControlPatch = {
      ...cross,
      pelvisX: 49,
      pelvisY: 219,
      footRX: 84,
      footRLift: 60,
      footLX: 91,
      footLLift: 104,
      footLHeel: 3,
    };
    keys.push(
      ...airborne({}, rig, { from: push, to: cross, ms: ms * 0.48, phase: "rise", samples: 6 }),
      key("lead-clears", cross, undefined, 15, (ms * 0.48) / 6, ["L", "R"]),
      key("trailing-clears", trailing, undefined, 20, 155, ["L", "R"]),
      ...airborne({}, rig, { from: trailing, to: receive, ms: ms * 0.35, phase: "landing", samples: 5 }),
    );
    props.push(
      {
        native: "side",
        paint: "mat",
        at: 0,
        half: 55,
        shape: { kind: "rect", x: 26, y: -surface, width: 135, height: surface },
      },
      { native: "side", paint: "band", at: 0, half: 65, shape: { kind: "disc", x: 8, y: -75, radius: 2.5 } },
    );
  } else {
    keys.push(
      ...airborne({}, rig, {
        from: push,
        to: receive,
        ms,
        phase: "flight",
        samples: 8,
        apex: target ? { handRUp: 69, handRForward: -48, handROut: -16 } : undefined,
      }),
    );
    if (target) {
      const apex = keys.find((k) => k.id === "flight-4")!;
      const hand = solve({ ...STAND, ...apex.set }, rig).arms.R.hand;
      props.push({
        native: "side",
        paint: "band",
        at: hand.z,
        half: 2,
        shape: { kind: "line", from: { x: hand.x, y: -hand.y - 33 }, to: { x: hand.x, y: -hand.y }, width: 4 },
      });
    }
  }
  keys.push({
    ...key("land", receive, 2, 650, 1, scissors ? ["L", "R"] : []),
    move: { ms: scissors ? (ms * 0.35) / 5 : ms / 8, phase: "landing", curve: "linear" },
  });
  return gesture({ key: drill, athlete: "highJump", rig, keys, props: () => props, views: ["side", "front"] });
}

export const highJumpDrills = [
  walking(false),
  walking(true),
  takeoff("curve-arm-drive"),
  takeoff("jump-drive-target"),
  takeoff("scissor-jump"),
];
