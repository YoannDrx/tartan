// Gainage : Awa, l'athlète du triple saut. Au sol, de profil ; le gainage latéral se lit de face (front.ts).
import { above, dumbbell, exercise, ground, MIDDLE, type ExerciseClip, type ExerciseDraft, type Position } from "../exercise";
import { arms, hanging, legs, settle, type PosePatch } from "./base";

const ATHLETE = "tripleJump" as const;
const hold = (draft: Omit<ExerciseDraft, "athlete">): ExerciseClip => exercise({ athlete: ATHLETE, ...draft });
const effort = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });

// Sur les avant-bras : coudes sous les épaules, l'inclinaison réglée pour poser les pieds.
const forearms = (rot: number) => ({ rot, lean: 0, head: -10, ...arms(rot, 90, 0) });
const onForearms = { on: "handA" as const, at: ground("handA", 80) };
const plankLine = settle((rot) => ({ ...forearms(rot), ...legs(0, 0, 0) }), [60, 100], "handA", "footA", -1);
const frontPlank = hold({
  key: "front-plank",
  positions: [
    calm({ ...forearms(84), ...legs(0, 0, 0) }, onForearms),
    calm(plankLine, onForearms),
    effort(plankLine, onForearms),
    calm(settle((rot) => ({ ...forearms(rot), ...legs(rot - 30, 62, 0) }), [40, 100], "handA", "footA", -1), onForearms),
  ],
});

// Allongée sur le dos, tête à gauche : les épaules restent au sol.
const SUPINE = -90;
const onBack = { on: "shoulder" as const, at: above("shoulder", 14, -40) };
const tabletop: PosePatch = { rot: SUPINE, lean: 0, head: 0, ...arms(90, 0, 0), legA: 90, kneeA: 90, legB: 86, kneeB: 90 };
const deadBug = hold({
  key: "dead-bug",
  positions: [
    calm(tabletop, onBack),
    calm({ ...tabletop, armA: 150, legA: 40, kneeA: 40 }, onBack),
    effort({ ...tabletop, armA: 176, legA: 8, kneeA: 4 }, onBack),
    calm(tabletop, onBack),
  ],
});

const flat: PosePatch = { rot: SUPINE, lean: 0, head: 0, ...arms(176, 0, 0), ...legs(0, 0, 2) };
const hollow: PosePatch = { rot: SUPINE + 22, lean: 0, head: 10, ...arms(170, 0, 0), ...legs(46, 0, 2) };
const onSeat = { on: "pelvis" as const, at: above("pelvis", 20, 0) };
const hollowHold = hold({
  key: "hollow-hold",
  positions: [
    calm(flat, onSeat),
    calm({ ...flat, rot: SUPINE + 8, ...legs(16, 0, 2) }, onSeat),
    effort(hollow, onSeat),
    calm({ ...flat, rot: SUPINE + 4 }, onSeat),
  ],
});

// La tête reste posée : quand le bassin s'enroule, c'est lui qui décolle.
const onHead = { on: "head" as const, at: above("head", 0, -100) };
const reverseCrunch = hold({
  key: "reverse-crunch",
  positions: [
    calm({ ...tabletop, ...arms(-10, 0, 0) }, onHead),
    calm({ ...tabletop, ...arms(-10, 0, 0), legA: 120, kneeA: 110, legB: 116, kneeB: 110 }, onHead),
    effort({ ...tabletop, rot: SUPINE - 18, ...arms(-10, 0, 0), legA: 140, kneeA: 120, legB: 136, kneeB: 120 }, onHead),
    calm({ ...tabletop, ...arms(-10, 0, 0) }, onHead),
  ],
});

// À quatre pattes : mains sous les épaules, genoux sous les hanches, tibias au sol.
const quadruped = (patch: PosePatch = {}) =>
  settle((rot) => ({ rot, lean: 0, head: -16, ...arms(rot, 0, 0), legA: rot, kneeA: 90, legB: rot - 2, kneeB: 90, ...patch }), [60, 110], "handA", "footA", -1);
const onHands = { on: "handB" as const, at: ground("handB", 90) };
const birdDog = hold({
  key: "bird-dog",
  positions: [
    calm(quadruped(), onHands),
    calm(quadruped({ armA: 140, legB: 30, kneeB: 40 }), onHands),
    effort(quadruped({ armA: 176, legB: 0, kneeB: 4 }), onHands),
    calm(quadruped({ armA: 120, legB: 40, kneeB: 60 }), onHands),
  ],
});

const plankTop = settle((rot) => ({ rot, lean: 0, head: -8, ...arms(rot, 0, 0), ...legs(0, 0, 0) }), [40, 100], "handA", "footA", -1);
const onPalms = { on: "handA" as const, at: ground("handA", 90) };
const mountainClimber = hold({
  key: "slow-mountain-climber",
  positions: [
    calm(plankTop, onPalms),
    effort({ ...plankTop, legA: plankTop.rot! + 20, kneeA: 110 }, onPalms),
    calm(plankTop, onPalms),
    effort({ ...plankTop, legB: plankTop.rot! + 20, kneeB: 110 }, onPalms),
  ],
});

// L'élastique tiré du côté : le corps reste de face, seuls les bras poussent.
const ANCHOR = { x: MIDDLE - 200, y: 230 };
const press = (reach: number) => ({ lean: 0, ...arms(60 + 30 * reach, 140 - 140 * reach, 2), ...legs(16, 18), legB: -12 });
const pallof = hold({
  key: "pallof-press",
  positions: [calm(press(0)), calm(press(0)), effort(press(1)), calm(press(0.3))],
  gear: (_, at) => [{ kind: "line", from: ANCHOR, to: at.handA, width: 5, paint: "band" }],
});

const walk = (phase: number): PosePatch => ({
  lean: 0,
  ...hanging(0),
  armB: 20 * phase,
  elbowB: 20,
  legA: 20 * phase,
  kneeA: phase > 0 ? 8 : 30,
  legB: -20 * phase,
  kneeB: phase > 0 ? 30 : 8,
});
const suitcase = hold({
  key: "suitcase-carry",
  positions: [calm({ lean: 30, head: -10, ...hanging(30), ...legs(70, 96) }), calm({ lean: 0, ...hanging(0) }), effort(walk(1)), effort(walk(-1))],
  gear: (_, at) => dumbbell(at.handA),
});

// --- Version 5 du catalogue -----------------------------------------------------------------------

const BAR = { x: MIDDLE, y: 30 };
const hangingBar = { on: "handA" as const, at: { x: BAR.x, y: BAR.y + 15 } };
const kneeRaise = hold({
  key: "hanging-knee-raise",
  positions: [
    calm({ lean: 0, ...arms(176, 0, 2), ...legs(6, 20) }, hangingBar),
    effort({ lean: -4, ...arms(172, 0, 2), ...legs(70, 90) }, hangingBar),
    effort({ lean: -12, ...arms(168, 0, 2), ...legs(110, 110) }, hangingBar),
    calm({ lean: -2, ...arms(174, 0, 2), ...legs(30, 50) }, hangingBar),
  ],
  gear: () => [
    { kind: "rect", x: MIDDLE + 60, y: 20, width: 12, height: 384, radius: 3, paint: "iron" },
    { kind: "line", from: { x: MIDDLE + 66, y: BAR.y }, to: { x: BAR.x, y: BAR.y }, width: 8, paint: "iron" },
    { kind: "disc", x: BAR.x, y: BAR.y, radius: 7, paint: "iron", front: true },
  ],
});

// À genoux, mains sur la roulette au sol : le corps s'allonge vers l'avant, aligné des genoux aux épaules.
const rollout = (reach: number) =>
  settle(
    (rot) => ({ rot, lean: 0, head: -10, ...arms(rot + reach, 0, 0), legA: 0, kneeA: 90 - rot, legB: 0, kneeB: 90 - rot }),
    [0, 100],
    "footA",
    "handA",
    0,
  );
const abWheel = hold({
  key: "ab-wheel-rollout",
  positions: [calm(rollout(0)), effort(rollout(30)), effort(rollout(60)), calm(rollout(20))].map((p) => ({ ...p, x: -80 })),
  gear: (_, at) => [{ kind: "disc", x: at.handA.x, y: at.handA.y + 2, radius: 16, paint: "iron", front: true }],
});

export const CORE: readonly ExerciseClip[] = [
  kneeRaise,
  abWheel,
  frontPlank,
  deadBug,
  birdDog,
  hollowHold,
  pallof,
  suitcase,
  reverseCrunch,
  mountainClimber,
];
