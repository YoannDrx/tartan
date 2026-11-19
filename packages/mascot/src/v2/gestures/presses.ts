// Les développés : Mehdi.
// - Développé couché : allongé sur le banc, pieds au sol, prise un peu plus large que les épaules ; la barre part
//   au-dessus des épaules, descend lentement jusqu'au bas de la poitrine, avant-bras à peu près verticaux, coudes à
//   quarante-cinq degrés environ du buste, puis remonte jusqu'aux bras tendus (ACE, « Chest Press » ; Catalyst
//   Athletics, « Bench Press »).
// - Développé militaire : debout, la barre sur le haut du thorax ; elle monte en ligne droite, la tête recule pour
//   la laisser passer puis revient sous elle ; bras verrouillés, la barre au-dessus de la base du cou et du milieu
//   du pied (Catalyst Athletics, « Press »). Les jambes ne participent pas.
import { gesture } from "../gesture";
import { elbows, STAND, stance, type ControlPatch } from "../pose";
import { barAtArmsLength, solve, type Rig } from "../solve";
import { racked } from "./clean";
import { bench } from "./gym";

const ATHLETE = "discus" as const;

// --- Développé couché -------------------------------------------------------------------------------------------

const BENCH_GRIP = 60;
const BENCH_RIG: Rig = { bar: { grip: BENCH_GRIP, hold: "hands" } };
const BENCH_TOP = 78;
// Couché sur le dos, la tête vers l'arrière de la scène, les pieds à plat devant le banc, genoux pliés.
const lying: ControlPatch = {
  pelvisX: 0,
  pelvisY: BENCH_TOP + 19,
  pelvisPitch: -90,
  neck: 4,
  footRX: 96,
  footRZ: 30,
  footRYaw: 12,
  footLX: 96,
  footLZ: -30,
  footLYaw: 12,
  kneeRForward: 0,
  kneeRUp: 1,
  kneeLForward: 0,
  kneeLUp: 1,
  // Les coudes vers le sol et un peu vers les pieds, les poignets droits au-dessus des avant-bras.
  ...elbows(-1, -0.45, 0.9),
  wrist: 8,
  armsLong: 0,
};
const shoulder = solve({ ...STAND, ...lying }, { bar: null }).arms.R.shoulder;
// En haut, bras tendus, la barre à l'aplomb des épaules.
const pressTop: ControlPatch = { barX: shoulder.x };
pressTop.barY = barAtArmsLength({ ...STAND, ...lying, ...pressTop }, BENCH_GRIP, true);
// En bas, la barre touche le bas de la poitrine, plus près des pieds que les épaules.
const pressBottom: ControlPatch = { barX: shoulder.x + 30, barY: lying.pelvisY! + 25 };
const pressHalf: ControlPatch = {
  barX: (pressTop.barX! + pressBottom.barX!) / 2 + 4,
  barY: (pressTop.barY! + pressBottom.barY!) / 2,
};

export const benchPress = gesture({
  key: "bench-press",
  athlete: ATHLETE,
  rig: BENCH_RIG,
  base: lying,
  keys: [
    { id: "top", guide: 0, set: pressTop, hold: 800, move: { ms: 450, curve: "reception", phase: "up" } },
    { id: "descent", guide: 1, set: pressHalf, still: true, move: { ms: 700, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: pressBottom,
      hold: 200,
      face: "effort",
      move: { ms: 700, curve: "reception", phase: "down" },
    },
    {
      id: "ascent",
      guide: 3,
      set: pressHalf,
      face: "effort",
      still: true,
      move: { ms: 420, curve: "elan", phase: "up" },
    },
  ],
  props: () => bench(shoulder.x - 70, lying.pelvisX! + 34, BENCH_TOP, 26),
});

// --- Développé militaire ----------------------------------------------------------------------------------------

const PRESS_GRIP = 46;
const PRESS_RIG: Rig = { bar: { grip: PRESS_GRIP, hold: "hands" } };
const standing: ControlPatch = { ...stance(24, 10, 13), pelvisX: -12, pelvisY: 999, pelvisPitch: 1, armsLong: 0 };
// La barre sur le haut du thorax, les coudes un peu devant elle.
const rackArms: ControlPatch = { ...elbows(0.8, -0.5, 0.45), wrist: 45, shrug: 0.3 };
const rack = racked({ ...standing, ...rackArms, neck: -6 });
// Devant le visage : la tête recule, la barre passe devant le menton.
const pastFace: ControlPatch = {
  ...standing,
  ...elbows(0.5, -0.8, 0.7),
  wrist: 40,
  shrug: 0.5,
  neck: -22,
  barX: 20,
  barY: rack.barY! + 46,
};
// Bras verrouillés, la tête revenue sous la barre, la barre au-dessus du milieu du pied.
const lockout: ControlPatch = { ...standing, ...elbows(-0.6, -0.3, 1), wrist: 35, shrug: 0.8, neck: -2, barX: -6 };
lockout.barY = barAtArmsLength({ ...STAND, ...lockout }, PRESS_GRIP, true);
const lowering: ControlPatch = { ...pastFace, barX: 18, barY: rack.barY! + 52 };

export const overheadPress = gesture({
  key: "overhead-press",
  athlete: ATHLETE,
  rig: PRESS_RIG,
  base: standing,
  keys: [
    { id: "rack", guide: 0, set: rack, hold: 700, move: { ms: 600, curve: "reception", phase: "down" } },
    {
      id: "past-face",
      guide: 1,
      set: pastFace,
      face: "effort",
      still: true,
      move: { ms: 420, curve: "elan", phase: "up" },
    },
    {
      id: "lockout",
      guide: 2,
      set: lockout,
      hold: 600,
      face: "effort",
      move: { ms: 420, curve: "reception", phase: "up" },
    },
    { id: "lowering", guide: 3, set: lowering, still: true, move: { ms: 700, curve: "elan", phase: "down" } },
  ],
});
