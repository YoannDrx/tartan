// Haltérophilie : Malo, l'athlète de la perche, de profil. La barre est vue par son bout : un disque dans la main.
import { barbell, exercise, GEAR, type ExerciseClip, type ExerciseDraft, type GearShape, type Position } from "../exercise";
import type { Point } from "../skeleton";
import { arms, frontRack, hanging, legs, overhead, settle, type PosePatch } from "./base";

const lift = (draft: Omit<ExerciseDraft, "athlete">): ExerciseClip =>
  exercise({ athlete: "poleVault", duration: 4400, gear: bar, ...draft });
const bar = (_: unknown, at: Record<"handA" | "head", Point>): GearShape[] => barbell(at.handA, at.head);
const effort = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });

// La barre au sol, disques posés : le buste se règle pour que la main tombe à la hauteur du moyeu.
const floor = (leg = 84, knee = 108) =>
  settle((lean) => ({ lean, head: -14, ...hanging(lean), ...legs(leg, knee) }), [0, 85], "footA", "handA", -(GEAR.plate - 16));
// Les positions du tirage, de la barre aux genoux jusqu'à l'extension complète sur l'avant-pied.
const knee: PosePatch = { lean: 34, head: -8, ...hanging(34), ...legs(36, 38) };
const hang: PosePatch = { lean: 26, head: -6, ...hanging(26), ...legs(24, 30) };
const thigh: PosePatch = { lean: 6, ...hanging(6), ...legs(8, 12) };
const extension: PosePatch = { lean: -8, head: -4, ...arms(-4, 0, 2), ...legs(-6, 2) };
const shrug: PosePatch = { ...extension, ...arms(-10, 30, 2) };
// Les réceptions : la barre sur les épaules, ou bras tendus au-dessus de la tête, en flexion complète ou partielle.
const rackLow: PosePatch = { lean: 16, ...frontRack, ...legs(98, 128) };
const rackHigh: PosePatch = { lean: 8, ...frontRack, ...legs(44, 54) };
const rackStand: PosePatch = { lean: 2, ...frontRack, ...legs(6, 4) };
const overLow: PosePatch = { lean: 22, head: 4, ...overhead(22), ...legs(98, 128) };
const overHigh: PosePatch = { lean: 10, ...overhead(10), ...legs(42, 52) };
const overStand: PosePatch = { lean: 0, ...overhead(0), ...legs(4, 2) };
// Le jeté en fente : jambe avant fléchie, jambe arrière allongée, barre bras tendus.
const split: PosePatch = { lean: 2, ...overhead(2), legA: 46, kneeA: 50, legB: -34, kneeB: 24 };
const dip: PosePatch = { lean: 2, ...frontRack, ...legs(26, 34) };
const drive: PosePatch = { lean: -4, ...arms(60, 120, 2), ...legs(-4, 2) };

const snatch = lift({
  key: "snatch",
  positions: [
    calm(floor()),
    effort(extension, { via: [{ pose: knee, face: "effort" }] }),
    effort(overLow, { via: [] }),
    calm(overStand, { face: "joy" }),
  ],
});

const clean = lift({
  key: "clean",
  positions: [
    calm(floor()),
    effort(extension, { via: [{ pose: knee, face: "effort" }] }),
    effort(rackLow),
    calm(rackStand, { face: "joy" }),
  ],
});

const splitJerk = lift({
  key: "split-jerk",
  positions: [calm(rackStand), effort(dip, { via: [{ pose: drive, face: "effort" }] }), effort(split), calm(overStand, { face: "joy" })],
});

const cleanAndJerk = lift({
  key: "clean-and-jerk",
  duration: 5600,
  positions: [
    calm(floor()),
    effort(rackLow, { via: [{ pose: knee, face: "effort" }, { pose: extension, face: "effort" }] }),
    calm(rackStand, { via: [{ pose: dip, face: "effort" }] }),
    effort(split, { via: [{ pose: overStand }] }),
  ],
});

const powerSnatch = lift({
  key: "power-snatch",
  positions: [calm(floor()), effort(extension, { via: [{ pose: knee, face: "effort" }] }), effort(overHigh), calm(overStand, { face: "joy" })],
});

const powerClean = lift({
  key: "power-clean",
  positions: [calm(floor()), effort(extension, { via: [{ pose: knee, face: "effort" }] }), effort(rackHigh), calm(rackStand, { face: "joy" })],
});

const hangSnatch = lift({
  key: "hang-snatch",
  positions: [calm(thigh), calm(hang), effort(extension), effort(overLow, { via: [{ pose: overStand }] })],
});

const hangClean = lift({
  key: "hang-clean",
  positions: [calm(thigh), calm(hang), effort(extension), effort(rackLow, { via: [{ pose: rackStand }] })],
});

const snatchPull = lift({
  key: "snatch-pull",
  positions: [calm(floor(86, 112)), effort(knee), effort(shrug), calm(hang)],
});

const cleanPull = lift({
  key: "clean-pull",
  positions: [calm(floor()), effort(knee), effort(shrug), calm(hang)],
});

const muscleSnatch = lift({
  key: "muscle-snatch",
  positions: [
    calm(floor()),
    effort(extension, { via: [{ pose: knee, face: "effort" }] }),
    effort({ lean: -4, ...arms(110, 120, 2), ...legs(0, 2) }),
    calm(overStand, { face: "joy" }),
  ],
});

const tallClean = lift({
  key: "tall-clean",
  positions: [calm({ ...thigh, ...arms(-4, 0, 2) }), effort(shrug), effort(rackLow), calm(rackStand, { face: "joy" })],
});

const overheadSquat = lift({
  key: "overhead-squat",
  positions: [calm(overStand), calm({ ...overHigh, ...legs(24, 30) }), effort(overLow), effort(overHigh)],
});

const jerkDip = lift({
  key: "jerk-dip",
  positions: [calm(rackStand), effort(dip), effort({ ...drive, ...frontRack }), calm(rackStand)],
});

const pushPress = lift({
  key: "push-press",
  positions: [calm(rackStand), effort(dip), effort(overStand, { via: [{ pose: drive, face: "effort" }] }), calm({ ...rackStand, ...arms(100, 80, 2) })],
});

export const WEIGHTLIFTING: readonly ExerciseClip[] = [
  snatch,
  clean,
  splitJerk,
  cleanAndJerk,
  powerSnatch,
  powerClean,
  hangSnatch,
  hangClean,
  snatchPull,
  cleanPull,
  muscleSnatch,
  tallClean,
  overheadSquat,
  jerkDip,
  pushPress,
];
