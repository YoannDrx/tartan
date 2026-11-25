import { gesture, type KeyDraft } from "../gesture";
import { hands, type ControlPatch } from "../pose";
const rig = { bar: null };
function toes(key: string, base: ControlPatch, positions: [string, ControlPatch][]) {
  const keys: KeyDraft[] = positions.map(([id, set], i) => ({
    id,
    guide: i,
    set,
    hold: 670,
    move: { ms: 760, phase: id, curve: "reception" },
  }));
  return gesture({
    key,
    athlete: "highJump",
    rig,
    base: { ...base, barefootR: 1, footRYaw: 0, footRZ: 30, ...hands(42, -77, 39) },
    keys,
    views: key === "toe-yoga" ? ["top", "side", "front"] : ["side", "top", "front"],
  });
}
export const footIntrinsics = [
  toes("foot-tripod", { pelvisX: -10, pelvisZ: 9, pelvisY: 164, footRX: 18, footLX: -47, footLZ: -25 }, [
    ["place", {}],
    ["shorten", { archLift: 4.5 }],
    ["release", {}],
  ]),
  toes("toe-yoga", { pelvisX: -26, pelvisY: 90, footRX: 64, footLX: 68, footLZ: -33 }, [
    ["flat", {}],
    ["big-toe", { halluxLift: 0.8 }],
    ["four-toes", { lesserToesLift: 0.65 }],
  ]),
];
