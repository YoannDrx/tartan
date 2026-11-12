// Le saut en hauteur comme une épreuve du groupe : le geste de high-jump.ts, son sautoir et son visage.
import { clamp } from "./clip";
import { faceBy, laneLine, type EventClip, type Phase } from "./event";
import { HIGH_JUMP_PHASES, HIGH_JUMP_STAGE, highJumpAt, type HighJumpPhase } from "./high-jump";
import type { PropShape } from "./props";

const { ground, matTop } = HIGH_JUMP_STAGE;
const STAGE = { width: 1400, height: 840, ground };
// La barre, vue de trois quarts : son bout lointain, puis son bout proche.
export const HIGH_JUMP_BAR = { far: { x: 830, y: 270 }, near: { x: 1270, y: 190 } };

const PHASES: Phase[] = (Object.keys(HIGH_JUMP_PHASES) as HighJumpPhase[]).map((name) => ({
  name,
  from: HIGH_JUMP_PHASES[name][0],
  to: HIGH_JUMP_PHASES[name][1],
}));

const { far, near } = HIGH_JUMP_BAR;
const PROPS: PropShape[] = [
  laneLine(STAGE, 0, 800),
  { kind: "line", from: { x: far.x, y: matTop + 10 }, to: { x: far.x, y: far.y - 22 }, width: 12, paint: "post" },
  { kind: "rect", x: 818, y: matTop, width: 582, height: 44, radius: 8, paint: "matTop" },
  // Le liseré blanc du dessus : il détache le sautoir de la piste rouge.
  {
    kind: "line",
    from: { x: 826, y: matTop + 2 },
    to: { x: 1392, y: matTop + 2 },
    width: 5,
    cap: "butt",
    paint: "board",
  },
  { kind: "rect", x: 800, y: matTop + 38, width: 600, height: 172, radius: 8, paint: "mat" },
  { kind: "line", from: far, to: near, width: 10, paint: "bar" },
  // Le poteau proche passe devant le sauteur : il est entre lui et nous.
  {
    kind: "line",
    from: { x: near.x, y: ground + 72 },
    to: { x: near.x, y: near.y - 28 },
    width: 18,
    paint: "post",
    front: true,
  },
  { kind: "rect", x: near.x - 50, y: ground + 66, width: 100, height: 16, radius: 8, paint: "post", front: true },
];

const frame = (t: number) => {
  const at = clamp(t);
  const phase = PHASES.find((item) => at < item.to) ?? PHASES[PHASES.length - 1]!;
  return highJumpAt(phase.name as HighJumpPhase, (at - phase.from) / (phase.to - phase.from));
};

export const HIGH_JUMP_CLIP: EventClip = {
  id: "highJump",
  stage: STAGE,
  duration: 4200,
  phases: PHASES,
  still: 0.63,
  frame,
  props: () => PROPS,
  face: faceBy(HIGH_JUMP_PHASES.approach[0], HIGH_JUMP_PHASES.celebrate[0]),
};
