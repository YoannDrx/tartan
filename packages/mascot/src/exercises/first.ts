// Premier lot : un geste par famille de mouvement, pour régler le moteur avant la série.
import { above, barbell, box, exercise, ground, MIDDLE, type ExerciseClip, type GearShape, type Position } from "../exercise";
import { arms, backRack, frontRack, hanging, legs, settle } from "./base";

const rack = (): GearShape[] => [
  { kind: "rect", x: MIDDLE + 96, y: 150, width: 12, height: 254, radius: 3, paint: "iron" },
  { kind: "rect", x: MIDDLE + 70, y: 300, width: 50, height: 8, radius: 3, paint: "iron" },
];

export const backSquat: ExerciseClip = exercise({
  key: "back-squat",
  athlete: "discus",
  positions: [
    { pose: { lean: 4, ...backRack } },
    { pose: { lean: 8, head: 4, ...backRack, ...legs(10, 8) } },
    { pose: { lean: 32, head: 10, ...backRack, ...legs(90, 118) }, face: "effort" },
    { pose: { lean: 24, head: 6, ...backRack, ...legs(52, 72) }, face: "effort" },
  ],
  gear: (_, at) => [...rack(), ...barbell(at.handA, at.head)],
});

const pullStart = { lean: 50, head: -14, ...hanging(50), ...legs(85, 110) };

export const deadlift: ExerciseClip = exercise({
  key: "deadlift",
  athlete: "discus",
  positions: [
    { pose: pullStart },
    {
      pose: { ...pullStart, lean: 52, ...hanging(52), ...legs(80, 102) },
      face: "effort",
      via: [{ pose: { lean: 36, head: -6, ...hanging(36), ...legs(36, 38) }, face: "effort" }],
    },
    { pose: { lean: 0, ...hanging(0), ...legs(4, 2) } },
    { pose: { lean: 42, head: -10, ...hanging(42), ...legs(30, 26) } },
  ],
  gear: (_, at) => barbell(at.handA, at.head),
});

const plank = (elbow: number) =>
  settle(
    (rot) => ({ rot, lean: 0, head: -8, ...arms(rot - elbow, elbow, 0), ...legs(0, 0, 0) }),
    [40, 100],
    "handA",
    "footA",
    -1,
  );

export const pushUp: ExerciseClip = exercise({
  key: "push-up",
  athlete: "discus",
  positions: (
    [
      { pose: plank(0) },
      { pose: plank(110), face: "effort" },
      { pose: plank(60), face: "effort" },
      { pose: plank(0) },
    ] satisfies Position[]
  ).map((p) => ({ ...p, on: "handA", at: ground("handA", 90) })),
});

export const clean: ExerciseClip = exercise({
  key: "clean",
  athlete: "poleVault",
  positions: [
    { pose: pullStart },
    {
      pose: { lean: -8, head: -4, ...hanging(-8, 0, 0), ...legs(-6, 4), armA: -2, armB: -6 },
      face: "effort",
      via: [{ pose: { lean: 30, head: -8, ...hanging(30), ...legs(30, 34) }, face: "effort" }],
    },
    {
      pose: { lean: 18, head: 0, ...frontRack, ...legs(96, 124) },
      face: "effort",
    },
    { pose: { lean: 4, ...frontRack, ...legs(6, 4) }, face: "joy" },
  ],
  gear: (_, at) => barbell(at.handA, at.head),
});

const BOX = { from: MIDDLE + 70, width: 150, height: 70 };

export const boxJump: ExerciseClip = exercise({
  key: "box-jump",
  athlete: "highJump",
  positions: [
    { pose: { lean: 2 }, x: -60 },
    {
      pose: { lean: 34, head: 4, ...arms(-50, 14), ...legs(70, 100) },
      x: -60,
      face: "effort",
      via: [{ pose: { lean: 8, head: -6, ...arms(150, 10), ...legs(100, 130) }, root: { x: MIDDLE + 40, y: 150 } }],
    },
    {
      pose: { lean: 28, head: 6, ...arms(60, 20), ...legs(80, 104) },
      at: above("footA", BOX.height, 120),
      face: "effort",
    },
    {
      pose: { lean: 2 },
      at: above("footA", BOX.height, 120),
      face: "joy",
      via: [{ pose: { lean: 6, ...legs(20, 10), legB: -20, kneeB: 30 }, root: { x: MIDDLE + 10, y: 250 } }],
    },
  ],
  gear: () => box(BOX.from, BOX.width, BOX.height),
});

const forearms = (rot: number) => ({ rot, lean: 0, head: -10, ...arms(rot, 90, 0) });

export const frontPlank: ExerciseClip = exercise({
  key: "front-plank",
  athlete: "tripleJump",
  positions: [
    { pose: { ...forearms(84), ...legs(0, 0, 0) } },
    { pose: settle((rot) => ({ ...forearms(rot), ...legs(0, 0, 0) }), [60, 100], "handA", "footA", -1) },
    {
      pose: settle((rot) => ({ ...forearms(rot), ...legs(0, 0, 0) }), [60, 100], "handA", "footA", -1),
      face: "effort",
    },
    { pose: settle((rot) => ({ ...forearms(rot), ...legs(rot - 30, 62, 0) }), [40, 100], "handA", "footA", -1) },
  ]
    .map((p): Position => ({ ...p, face: p.face as Position["face"] }))
    .map((p) => ({ ...p, on: "handA", at: ground("handA", 80) })),
});

export const FIRST = [backSquat, deadlift, pushUp, clean, boxJump, frontPlank];
