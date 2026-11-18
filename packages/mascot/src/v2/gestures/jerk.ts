// Le jeté et ce qui le prépare : Malo, la barre sur l'avant des épaules (clean.ts). Les positions servent à
// l'épaulé-jeté (clean-and-jerk.ts) et aux gestes qui en isolent une partie : le jeté en fente, le jeté poussé,
// le développé avec impulsion, la flexion préparatoire.
// Repères techniques : pieds sous les hanches, une flexion nette et verticale des genoux, talons au sol, puis une
// impulsion qui envoie la barre vers le haut ; en fente, pied avant à plat et tibia à peu près vertical, pied
// arrière sur l'avant-pied, talon levé, genou arrière fléchi, hanches sous la barre, la barre un peu en arrière
// de la tête (Everett, « The Jerk: Part 1 », 2007 ; « Improving Your Footwork in the Split Jerk », 2016). Au jeté
// poussé, les pieds ne se décalent pas en fente : ils se replacent à peine plus écartés et le corps passe sous la
// barre en demi-squat au-dessus de l'horizontale ; au développé avec impulsion, il n'y a pas de seconde flexion,
// les bras finissent le geste que les jambes ont lancé. La flexion préparatoire seule : descente verticale vive,
// arrêt net, remontée sans lancer la barre (Catalyst Athletics, « Split Jerk », « Push Jerk », « Push Press »,
// « Jerk Dip »).
import { gesture, type KeyDraft } from "../gesture";
import { elbows, heels, stance, type ControlPatch } from "../pose";
import { armsLength, CLEAN_RIG, cleanBase, racked } from "./clean";

const line = (guide: number | undefined) => (guide !== undefined ? { guide } : {});

// Les pieds du jeté : sous les hanches, un peu ouverts.
export const jerking = stance(26, 12, 13);

// Entre l'épaulé et le jeté, les pieds se rapprochent.
export const jerkAdjust = racked({
  ...stance(36, 20, 12.6),
  pelvisX: -17,
  pelvisY: 999,
  pelvisPitch: 2,
  neck: -8,
  footRLift: 3,
  footLLift: 3,
});
export const jerkSet = racked({ ...jerking, pelvisX: -17, pelvisY: 999, pelvisPitch: 1, neck: -14 });
// La flexion : les genoux avancent, le buste reste vertical, les talons au sol.
export const jerkDip = racked({ ...jerking, pelvisX: -15, pelvisY: 150, pelvisPitch: 0, neck: -18 });
// L'impulsion : jambes tendues, sur l'avant-pied, la tête s'efface et la barre quitte les épaules.
export const jerkDrive: ControlPatch = {
  ...racked({ ...jerking, ...heels(30), pelvisX: -14, pelvisY: 999, pelvisPitch: -1, neck: -22, shrug: 1 }),
};
jerkDrive.barY = jerkDrive.barY! + 14;
jerkDrive.barX = jerkDrive.barX! + 1;

// Bras verrouillés au-dessus de la tête.
const locked: ControlPatch = { ...elbows(-0.6, -0.3, 1), wrist: 40, shrug: 0.6, armsLong: 1 };
// La barre tenue bras verrouillés par le corps décrit : jambes tendues, ou bassin à la hauteur donnée.
export const overhead = (patch: ControlPatch): ControlPatch => ({
  ...locked,
  ...patch,
  barY: armsLength({ ...locked, ...patch }, true),
});

// Les pieds partent en fente pendant que les bras poussent : le corps descend sous la barre.
const FRONT = 68;
const REAR = -116;
const flying: ControlPatch = {
  barX: -4,
  barY: jerkDrive.barY! + 34,
  pelvisX: -18,
  pelvisY: 158,
  pelvisPitch: 0,
  neck: -16,
  shrug: 0.8,
  armsLong: 0,
  ...elbows(0.3, -0.6, 0.9),
  wrist: 45,
  footRX: 44,
  footRZ: 27,
  footRYaw: 6,
  footRLift: 5,
  footLX: -62,
  footLZ: -27,
  footLYaw: 0,
  footLLift: 6,
  footLHeel: 30,
};
// Le bassin bascule un peu vers l'avant et le bas du dos se creuse : la hanche arrière ne s'étend pas sans fin.
export const jerkSplit = overhead({
  barX: -27,
  pelvisX: -20,
  pelvisY: 143,
  pelvisPitch: 6,
  lumbar: -6,
  neck: -8,
  footRX: FRONT,
  footRZ: 28,
  footRYaw: 4,
  footLX: REAR,
  footLZ: -28,
  footLYaw: -6,
  footLHeel: 50,
});
// Le pied avant recule d'abord, de la moitié de la fente.
const frontBack = overhead({
  ...jerkSplit,
  pelvisX: -30,
  pelvisY: 150,
  pelvisPitch: 8,
  lumbar: -8,
  footRX: 40,
  footRLift: 6,
});
const frontHome = overhead({
  ...jerkSplit,
  pelvisX: -44,
  pelvisY: 154,
  pelvisPitch: 8,
  lumbar: -8,
  footRX: 13,
  footRZ: 26,
  footRYaw: 12,
  footLHeel: 42,
});
// Puis le pied arrière avance.
const rearForward = overhead({
  ...frontHome,
  pelvisX: -22,
  pelvisY: 168,
  footLX: -50,
  footLLift: 6,
  footLHeel: 20,
  footLYaw: 4,
});
export const jerkOverhead = overhead({
  ...jerking,
  barX: -4,
  pelvisX: -9,
  pelvisY: 999,
  pelvisPitch: 2,
  lumbar: -1,
  thoracic: -1,
  neck: -4,
});

// La barre redescend devant le visage, la tête en arrière, puis revient sur les épaules ; les genoux l'amortissent.
const overFace: ControlPatch = {
  ...jerking,
  barX: 24,
  barY: 322,
  pelvisX: -12,
  pelvisY: 999,
  pelvisPitch: 1,
  neck: -20,
  armsLong: 0,
  ...elbows(0.6, -0.5, 0.9),
  wrist: 50,
};
const backToRack = racked({ ...jerking, pelvisX: -16, pelvisY: 158, pelvisPitch: 1, neck: -20 });

// La flexion puis l'impulsion, les deux pieds au sol.
export const dipAndDrive = (lines: { dip?: number; drive?: number } = {}): KeyDraft[] => [
  {
    id: "dip",
    ...line(lines.dip),
    set: jerkDip,
    face: "effort",
    still: true,
    move: { ms: 340, curve: "impulsion", phase: "dip" },
  },
  {
    id: "drive",
    ...line(lines.drive),
    set: jerkDrive,
    face: "effort",
    still: true,
    move: { ms: 190, curve: "elan", phase: "drive" },
  },
];

// Le passage en fente, puis le retour des pieds : le pied avant recule d'abord, puis le pied arrière avance.
export const splitAndRecover = (lines: { split?: number; frontHome?: number; overhead?: number } = {}): KeyDraft[] => [
  { id: "flying", set: flying, face: "effort", air: ["R", "L"], move: { ms: 120, curve: "linear", phase: "split" } },
  {
    id: "split",
    ...line(lines.split),
    set: jerkSplit,
    hold: 500,
    face: "effort",
    move: { ms: 150, curve: "reception", phase: "split" },
  },
  { id: "front-back", set: frontBack, air: ["R"], move: { ms: 260, curve: "elan", phase: "feet-together" } },
  {
    id: "front-home",
    ...line(lines.frontHome),
    ...(lines.frontHome !== undefined ? { still: true } : {}),
    set: frontHome,
    move: { ms: 240, curve: "reception", phase: "feet-together" },
  },
  { id: "rear-forward", set: rearForward, air: ["L"], move: { ms: 260, curve: "elan", phase: "feet-together" } },
  {
    id: "overhead",
    ...line(lines.overhead),
    set: jerkOverhead,
    hold: 700,
    face: "joy",
    move: { ms: 240, curve: "reception", phase: "feet-together" },
  },
];

// La barre redescend sur les épaules : hors technique, ou dernière ligne du guide (`guide`).
export const backToShoulders = (guide?: number): KeyDraft[] => [
  {
    id: "over-face",
    ...line(guide),
    ...(guide !== undefined ? { still: true } : {}),
    set: overFace,
    move: { ms: 380, curve: "elan", phase: "return" },
  },
  { id: "back-to-rack", set: backToRack, move: { ms: 320, curve: "reception", phase: "return" } },
];

// La position de départ des gestes qui partent du rack : debout, la barre sur les épaules.
const setKey = (guide: number, ms: number): KeyDraft => ({
  id: "set",
  guide,
  set: jerkSet,
  hold: 600,
  move: { ms, curve: "reception", phase: "return" },
});

export const splitJerk = gesture({
  key: "split-jerk",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [
    setKey(0, 360),
    ...dipAndDrive({ dip: 1 }),
    ...splitAndRecover({ split: 2, frontHome: 3 }),
    ...backToShoulders(),
  ],
});

// Le jeté poussé : les pieds se replacent à peine plus écartés, et le corps passe sous la barre en flexion partielle.
const pushing = stance(33, 16, 13);
const pushFlight: ControlPatch = {
  ...pushing,
  barX: -3,
  barY: jerkDrive.barY! + 32,
  pelvisX: -16,
  pelvisY: 166,
  pelvisPitch: 0,
  neck: -14,
  shrug: 0.8,
  armsLong: 0,
  ...elbows(0.3, -0.6, 0.9),
  wrist: 45,
  footRLift: 5,
  footLLift: 5,
};
const pushReceive = overhead({
  ...pushing,
  barX: -6,
  pelvisX: -23,
  pelvisY: 145,
  pelvisPitch: 4,
  lumbar: -2,
  neck: -6,
});
const pushStanding = overhead({
  ...pushing,
  barX: -4,
  pelvisX: -9,
  pelvisY: 999,
  pelvisPitch: 2,
  lumbar: -1,
  neck: -4,
});
// Les pieds reviennent sous les hanches pendant que la barre redescend.
const pushLowering: ControlPatch = { ...overFace, barY: overFace.barY! + 30, ...pushing, footRLift: 3, footLLift: 3 };

export const pushJerk = gesture({
  key: "push-jerk",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [
    setKey(0, 360),
    ...dipAndDrive({ dip: 1 }),
    {
      id: "flight",
      set: pushFlight,
      face: "effort",
      air: ["R", "L"],
      move: { ms: 130, curve: "linear", phase: "catch" },
    },
    {
      id: "receive",
      guide: 2,
      set: pushReceive,
      hold: 450,
      face: "effort",
      move: { ms: 170, curve: "reception", phase: "catch" },
    },
    {
      id: "overhead",
      guide: 3,
      set: pushStanding,
      hold: 700,
      face: "joy",
      move: { ms: 520, curve: "elan", phase: "recovery" },
    },
    {
      id: "feet-back",
      set: { ...pushLowering, ...jerking },
      air: ["R", "L"],
      move: { ms: 360, curve: "elan", phase: "return" },
    },
    { id: "over-face", set: overFace, move: { ms: 200, curve: "linear", phase: "return" } },
    backToShoulders()[1]!,
  ],
});

// Le développé avec impulsion : les jambes lancent la barre, les bras la finissent, sans seconde flexion.
const press: ControlPatch = {
  ...jerking,
  barX: 7,
  barY: jerkDrive.barY! + 42,
  pelvisX: -12,
  pelvisY: 999,
  pelvisPitch: 0,
  neck: -16,
  shrug: 0.8,
  armsLong: 0,
  ...elbows(0.2, -0.7, 0.9),
  wrist: 45,
  ...heels(8),
};

export const pushPress = gesture({
  key: "push-press",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [
    setKey(0, 360),
    ...dipAndDrive({ dip: 1 }),
    { id: "press", set: press, face: "effort", still: true, move: { ms: 220, curve: "linear", phase: "press" } },
    {
      id: "overhead",
      guide: 2,
      // Jambes tendues : elles fixent la hauteur du corps, les bras finissent la poussée.
      set: { ...jerkOverhead, armsLong: 0 },
      hold: 700,
      face: "joy",
      move: { ms: 260, curve: "reception", phase: "press" },
    },
    ...backToShoulders(3),
  ],
});

// La flexion préparatoire seule : descendre, s'arrêter, remonter, sans lancer la barre.
const braced = racked({ ...jerking, pelvisX: -17, pelvisY: 999, pelvisPitch: 1, neck: -14, shrug: 0.7 });

export const jerkDipDrill = gesture({
  key: "jerk-dip",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [
    setKey(0, 420),
    { id: "brace", guide: 1, set: braced, hold: 500, move: { ms: 300, curve: "impulsion", phase: "brace" } },
    {
      id: "dip",
      guide: 2,
      set: { ...jerkDip, shrug: 0.7 },
      hold: 150,
      face: "effort",
      move: { ms: 300, curve: "elan", phase: "dip" },
    },
    { id: "stand", guide: 3, set: braced, hold: 500, move: { ms: 380, curve: "impulsion", phase: "rise" } },
  ],
});
