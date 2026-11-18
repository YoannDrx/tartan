// Les variantes de l'arraché et de l'épaulé : Malo. Elles reprennent les tirées et les réceptions des gestes
// complets (snatch.ts, clean.ts) et n'en changent qu'une partie.
// - En puissance : la barre monte plus haut et l'athlète la reçoit en flexion partielle, cuisses au-dessus de
//   l'horizontale, pieds à peine plus écartés qu'au tirage (Catalyst Athletics, « Power Snatch »,
//   « Power Clean »).
// - En suspension : le départ se fait debout, la barre recule avec les hanches jusqu'au-dessus des genoux, le
//   buste penché, angle du dos tenu, la barre près des cuisses ; puis la seconde tirée seule (Catalyst Athletics,
//   « Hang Snatch »).
// - L'arraché musclé : extension sans repasser en flexion, les coudes montent haut et tournent, la barre passe
//   devant le visage et finit bras tendus, jambes tendues (Catalyst Athletics, « Hang Muscle Snatch »).
// - L'épaulé sans élan : debout, sur les pieds à plat, l'athlète se tire sous la barre sans nouvelle poussée des
//   jambes, les pieds se replacent, la barre est reçue sur les épaules. Réglé à l'œil d'après la fiche du
//   catalogue : aucune source ouverte pour ce geste.
import { gesture, type KeyDraft } from "../gesture";
import { elbows, heels, stance, type ControlPatch } from "../pose";
import {
  CLEAN_RIG,
  CLEAN_TOP,
  cleanBase,
  cleanFirstPull,
  cleanHighPull,
  cleanHips,
  cleanLowerToHips,
  cleanKneesReturn,
  cleanMeet,
  cleanSecondPull,
  cleanSquatCatch,
  cleanTop,
  cleanTurnover,
  racked,
  receiving as receivingFeet,
  startKey as cleanStartKey,
} from "./clean";
import {
  line,
  locked,
  pulling,
  SNATCH_RIG,
  SNATCH_TOP,
  snatchArmsLength,
  snatchBase,
  snatchExtension,
  snatchFirstPull,
  snatchHighPull,
  snatchHips,
  snatchKneesReturn,
  snatchLowerToHips,
  snatchOverhead,
  snatchPower,
  snatchSecondPull,
  snatchSquatCatch,
  snatchStartKey,
  snatchUnder,
} from "./snatch";

// --- La suspension : debout, puis la barre au-dessus des genoux --------------------------------------------

// Les hanches reculent, les genoux fléchissent à peine, la barre glisse le long des cuisses.
export const snatchHang: ControlPatch = {
  barX: 7,
  barY: 106,
  pelvisX: -66,
  pelvisPitch: 59,
  lumbar: -4,
  thoracic: -3,
  neck: -26,
  head: -6,
};
export const cleanHang: ControlPatch = {
  barX: 7,
  barY: 104,
  pelvisX: -60,
  pelvisPitch: 51,
  lumbar: -4,
  thoracic: -3,
  neck: -24,
  head: -6,
};

// Debout, la barre aux hanches : la position de départ des gestes en suspension.
const standingKey = (set: ControlPatch, guide?: number): KeyDraft => ({
  id: "standing",
  ...line(guide),
  set,
  hold: 600,
  move: { ms: 350, curve: "linear", phase: "return" },
});
// La descente en suspension : les hanches reculent, lentement, et la position se tient.
const hangKey = (set: ControlPatch, guide?: number): KeyDraft => ({
  id: "hang",
  ...line(guide),
  set,
  hold: 450,
  move: { ms: 700, curve: "reception", phase: "hinge" },
});
// Les genoux reviennent sous la barre, le buste se redresse : la barre arrive en haut des cuisses.
const scoopKey = (set: ControlPatch, guide?: number): KeyDraft => ({
  id: "power",
  ...line(guide),
  set,
  face: "effort",
  still: true,
  move: { ms: 280, curve: "impulsion", phase: "transition" },
});

// --- La réception en puissance ------------------------------------------------------------------------------

// Les pieds se replacent à peine plus écartés qu'au tirage.
const landing = stance(36, 21, 12.7);

// Arraché : bras verrouillés, le bassin juste au-dessus des genoux.
const powerSnatchCatch: ControlPatch = (() => {
  const patch: ControlPatch = {
    ...locked,
    ...landing,
    barX: -4,
    pelvisX: -34,
    pelvisY: 92,
    pelvisPitch: 12,
    lumbar: 6,
    thoracic: -3,
    neck: -8,
  };
  return { ...patch, barY: snatchArmsLength(patch, true) };
})();
// Le point haut de la barre : plus haut qu'à l'arraché complet, la réception le suit de près.
const powerSnatchTop: ControlPatch = {
  ...snatchUnder,
  ...landing,
  barX: 4,
  barY: powerSnatchCatch.barY! + 7,
  pelvisX: -20,
  pelvisY: 136,
  footRLift: 4,
  footLLift: 4,
};
const powerSnatchHighPull: ControlPatch = { ...snatchHighPull, barY: SNATCH_TOP + 44 };
// La remontée de la flexion partielle, les pieds restant où ils se sont posés.
const powerSnatchStanding: ControlPatch = (() => {
  const patch: ControlPatch = { ...snatchOverhead, ...landing, pelvisY: 999 };
  return { ...patch, barY: snatchArmsLength(patch, true) };
})();

// Une seconde tirée plus vive : la barre doit monter plus haut pour être reçue en flexion partielle.
const snatchPowerPull = (guide: number): KeyDraft => ({
  ...snatchSecondPull(guide),
  move: { ms: 130, curve: "elan", phase: "second-pull" },
});

const powerSnatchCatchKeys = (lines: { receive?: number; overhead?: number }): KeyDraft[] => [
  {
    id: "high-pull",
    set: powerSnatchHighPull,
    face: "effort",
    still: true,
    move: { ms: 120, curve: "linear", phase: "turnover" },
  },
  {
    id: "top",
    set: powerSnatchTop,
    face: "effort",
    air: ["R", "L"],
    still: true,
    move: { ms: 220, curve: "linear", phase: "turnover" },
  },
  {
    id: "receive",
    ...line(lines.receive),
    set: powerSnatchCatch,
    hold: 450,
    face: "effort",
    move: { ms: 190, curve: "reception", phase: "catch" },
  },
  {
    id: "overhead",
    ...line(lines.overhead),
    set: powerSnatchStanding,
    hold: 800,
    face: "joy",
    move: { ms: 640, curve: "reception", phase: "recovery" },
  },
];

// Épaulé : la barre sur les épaules, coudes hauts, le bassin au-dessus des genoux.
const powerCleanCatch = racked({
  ...landing,
  pelvisX: -27,
  pelvisY: 112,
  pelvisPitch: 10,
  lumbar: 4,
  thoracic: -2,
  neck: -12,
});
const powerCleanTop: ControlPatch = { ...cleanTop, barY: powerCleanCatch.barY! + 8, pelvisY: 146 };
const powerCleanHighPull: ControlPatch = { ...cleanHighPull, barY: CLEAN_TOP + 30 };
const powerCleanStanding = racked({ ...landing, pelvisX: -17, pelvisY: 999, pelvisPitch: 2, neck: -8 });

const powerCleanCatchKeys = (lines: { top?: number; receive?: number; racked?: number }): KeyDraft[] => [
  {
    id: "high-pull",
    set: powerCleanHighPull,
    face: "effort",
    still: true,
    move: { ms: 110, curve: "linear", phase: "turnover" },
  },
  {
    id: "top",
    ...line(lines.top),
    set: powerCleanTop,
    face: "effort",
    air: ["R", "L"],
    still: true,
    move: { ms: 140, curve: "linear", phase: "turnover" },
  },
  {
    id: "receive",
    ...line(lines.receive),
    set: powerCleanCatch,
    hold: 450,
    face: "effort",
    move: { ms: 190, curve: "reception", phase: "catch" },
  },
  {
    id: "racked",
    ...line(lines.racked),
    set: powerCleanStanding,
    hold: 700,
    face: "joy",
    move: { ms: 560, curve: "reception", phase: "recovery" },
  },
];

// --- Les gestes -----------------------------------------------------------------------------------------------

const lift = (key: string, snatchGrip: boolean, keys: KeyDraft[]) =>
  gesture({
    key,
    athlete: "poleVault",
    rig: snatchGrip ? SNATCH_RIG : CLEAN_RIG,
    base: snatchGrip ? snatchBase : cleanBase,
    keys,
  });

export const powerSnatch = lift("power-snatch", true, [
  snatchStartKey(0, 520),
  ...snatchFirstPull(),
  snatchPowerPull(1),
  ...powerSnatchCatchKeys({ receive: 2, overhead: 3 }),
  ...snatchLowerToHips(),
  snatchKneesReturn(),
]);

export const powerClean = lift("power-clean", false, [
  cleanStartKey(0, 520),
  ...cleanFirstPull(),
  cleanSecondPull(1),
  ...powerCleanCatchKeys({ top: 2, receive: 3 }),
  ...cleanLowerToHips(),
  cleanKneesReturn(),
]);

export const hangSnatch = lift("hang-snatch", true, [
  standingKey(snatchHips),
  hangKey(snatchHang, 0),
  scoopKey(snatchPower, 1),
  snatchSecondPull(2),
  ...snatchSquatCatch({ receive: 3 }),
  snatchLowerToHips()[0]!,
]);

export const hangClean = lift("hang-clean", false, [
  standingKey(cleanHips),
  hangKey(cleanHang, 0),
  scoopKey({ ...cleanHang, barX: 9, barY: 124, pelvisX: -15, pelvisPitch: 14, lumbar: -2, thoracic: -2, neck: -8 }, 1),
  cleanSecondPull(2),
  ...cleanTurnover(),
  ...cleanSquatCatch({ receive: 3 }, 700),
  cleanLowerToHips()[0]!,
]);

export const hangPowerSnatch = lift("hang-power-snatch", true, [
  standingKey(snatchHips, 0),
  hangKey(snatchHang, 1),
  scoopKey(snatchPower),
  snatchPowerPull(2),
  ...powerSnatchCatchKeys({ receive: 3 }),
  snatchLowerToHips()[0]!,
]);

export const hangPowerClean = lift("hang-power-clean", false, [
  standingKey(cleanHips, 0),
  hangKey(cleanHang, 1),
  scoopKey({ ...cleanHang, barX: 9, barY: 124, pelvisX: -15, pelvisPitch: 14, lumbar: -2, thoracic: -2, neck: -8 }),
  cleanSecondPull(2),
  ...powerCleanCatchKeys({ receive: 3 }),
  cleanLowerToHips()[0]!,
]);

// --- L'arraché musclé ---------------------------------------------------------------------------------------

// La suspension haute : la barre en haut des cuisses, les genoux à peine fléchis.
const highHang: ControlPatch = {
  barX: 10,
  barY: 146,
  pelvisX: -27,
  pelvisPitch: 22,
  lumbar: -2,
  thoracic: -2,
  neck: -12,
};
// Jambes tendues, pieds à plat : les coudes montent hauts et vers l'extérieur.
const muscleHighPull: ControlPatch = {
  barX: 11,
  barY: SNATCH_TOP + 40,
  pelvisX: -10,
  pelvisY: 999,
  pelvisPitch: -2,
  lumbar: -2,
  thoracic: -2,
  neck: 0,
  shrug: 1,
  armsLong: 0,
  ...elbows(-0.3, 0.9, 1),
  ...heels(8),
};
// Les coudes tournent sous la barre : elle passe devant le visage, poignets cassés.
const muscleTurn: ControlPatch = {
  barX: 24,
  barY: SNATCH_TOP + 104,
  pelvisX: -10,
  pelvisY: 999,
  pelvisPitch: -1,
  lumbar: -2,
  thoracic: -2,
  neck: -14,
  shrug: 1,
  armsLong: 0,
  ...elbows(-0.2, -0.4, 1),
  wrist: 30,
};
// Les bras poussent la barre au-dessus du front.
const musclePress: ControlPatch = {
  barX: 8,
  barY: SNATCH_TOP + 150,
  pelvisX: -10,
  pelvisY: 999,
  pelvisPitch: 0,
  lumbar: -1,
  thoracic: -1,
  neck: -10,
  shrug: 0.8,
  armsLong: 0,
  ...elbows(-0.5, -0.4, 1),
  wrist: 38,
};
// Bras verrouillés, jambes tendues : ce sont les jambes, et non la barre, qui fixent la hauteur du corps.
const muscleOverhead: ControlPatch = (() => {
  const patch: ControlPatch = { ...snatchOverhead, ...pulling, pelvisY: 999, armsLong: 0 };
  return { ...patch, barY: snatchArmsLength(patch, true) };
})();
// L'extension sans saut : les talons se lèvent à peine, les genoux ne replongent pas.
const muscleExtension: ControlPatch = (() => {
  const patch: ControlPatch = { ...snatchExtension, ...heels(12) };
  return { ...patch, barY: snatchArmsLength(patch, false) };
})();

export const muscleSnatch = lift("muscle-snatch", true, [
  standingKey(snatchHips),
  { id: "high-hang", guide: 0, set: highHang, hold: 450, move: { ms: 520, curve: "reception", phase: "hinge" } },
  {
    id: "extension",
    guide: 1,
    set: muscleExtension,
    face: "effort",
    still: true,
    move: { ms: 230, curve: "elan", phase: "extension" },
  },
  {
    id: "high-pull",
    set: muscleHighPull,
    face: "effort",
    still: true,
    move: { ms: 170, curve: "linear", phase: "pull" },
  },
  {
    id: "turnover",
    guide: 2,
    set: muscleTurn,
    face: "effort",
    still: true,
    move: { ms: 200, curve: "linear", phase: "turnover" },
  },
  { id: "press", set: musclePress, face: "effort", move: { ms: 200, curve: "linear", phase: "press" } },
  {
    id: "overhead",
    guide: 3,
    set: muscleOverhead,
    hold: 800,
    face: "joy",
    move: { ms: 260, curve: "reception", phase: "press" },
  },
  {
    // La barre redescend devant le visage, coudes vers l'avant, jusqu'aux hanches.
    id: "lowering",
    set: { ...muscleTurn, barX: 32, barY: 300, neck: 0, ...elbows(0.8, -0.2, 1), wrist: 10, ...heels(0) },
    move: { ms: 520, curve: "elan", phase: "return" },
  },
]);

// --- L'épaulé sans élan -------------------------------------------------------------------------------------

// Debout, pieds à plat, l'athlète se tire vers le bas : épaules haussées, coudes hauts, genoux qui cèdent.
const tallPull: ControlPatch = {
  ...cleanHighPull,
  barY: cleanHips.barY! + 30,
  pelvisX: -12,
  pelvisY: 160,
  ...heels(0),
};
const tallTop: ControlPatch = { ...cleanTop, barY: cleanHips.barY! + 40 };

export const tallClean = lift("tall-clean", false, [
  standingKey(cleanHips, 0),
  { id: "pull-under", guide: 1, set: tallPull, face: "effort", move: { ms: 240, curve: "impulsion", phase: "pull" } },
  {
    id: "top",
    set: tallTop,
    face: "effort",
    air: ["R", "L"],
    still: true,
    move: { ms: 150, curve: "linear", phase: "turnover" },
  },
  {
    id: "meet",
    guide: 2,
    set: { ...cleanMeet, barY: cleanMeet.barY! },
    face: "effort",
    still: true,
    move: { ms: 150, curve: "linear", phase: "catch" },
  },
  ...cleanSquatCatch({ receive: 3 }, 700).slice(1),
  // Les coudes s'abaissent, la barre quitte les épaules, puis les pieds reviennent sous les hanches.
  {
    id: "unrack",
    set: { ...cleanLowerToHips()[0]!.set, ...receivingFeet, footRLift: 0, footLLift: 0, barY: cleanHips.barY! + 70 },
    move: { ms: 300, curve: "elan", phase: "return" },
  },
  { ...cleanLowerToHips()[0]!, move: { ms: 260, curve: "linear", phase: "return" } },
]);
