// L'épaulé-jeté : Malo. L'épaulé (clean.ts), puis le jeté en fente, sans que la barre ne quitte les mains.
// Repères techniques du jeté : pieds sous les hanches, une flexion nette des genoux, buste vertical, puis une
// poussée qui envoie la barre vers le haut et le corps vers le bas ; en fente, pied avant à plat et tibia à peu
// près vertical, pied arrière sur l'avant-pied, talon levé, genou arrière fléchi, largeur de la position de
// squat, poids réparti entre les deux pieds, hanches sous les épaules ; la barre monte puis passe un peu en
// arrière de la tête (Everett, « The Jerk: Part 1 », 2007 ; « Improving Your Footwork in the Split Jerk », 2016).
// Retour : le pied avant recule d'abord, puis le pied arrière avance, comme le dit le guide de la fiche.
import { gesture } from "../gesture";
import { elbows, heels, stance, type ControlPatch } from "../pose";
import { armsLength, CLEAN_RIG, cleanBase, cleanKeys, racked, returnKeys, startKey } from "./clean";

// Les pieds du jeté : sous les hanches, un peu ouverts.
const jerking = stance(26, 12, 13);

// Entre l'épaulé et le jeté, les pieds se rapprochent.
const adjust = racked({
  ...stance(36, 20, 12.6),
  pelvisX: -17,
  pelvisY: 999,
  pelvisPitch: 2,
  neck: -8,
  footRLift: 3,
  footLLift: 3,
});
const set = racked({ ...jerking, pelvisX: -17, pelvisY: 999, pelvisPitch: 1, neck: -14 });
// La flexion : les genoux avancent, le buste reste vertical, les talons au sol.
const dip = racked({ ...jerking, pelvisX: -15, pelvisY: 150, pelvisPitch: 0, neck: -18 });
// L'impulsion : jambes tendues, sur l'avant-pied, la tête s'efface et la barre quitte les épaules.
const drive: ControlPatch = {
  ...racked({ ...jerking, ...heels(30), pelvisX: -14, pelvisY: 999, pelvisPitch: -1, neck: -22, shrug: 1 }),
};
drive.barY = drive.barY! + 14;
drive.barX = drive.barX! + 1;

// Bras verrouillés au-dessus de la tête.
const locked: ControlPatch = { ...elbows(-0.6, -0.3, 1), wrist: 40, shrug: 0.6, armsLong: 1 };
const overhead = (patch: ControlPatch): ControlPatch => ({
  ...locked,
  ...patch,
  barY: armsLength({ ...locked, ...patch }, true),
});

// Les pieds partent en fente pendant que les bras poussent : le corps descend sous la barre.
const FRONT = 68;
const REAR = -116;
const flying: ControlPatch = {
  barX: -4,
  barY: drive.barY! + 34,
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
const split = overhead({
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
  ...split,
  pelvisX: -30,
  pelvisY: 150,
  pelvisPitch: 8,
  lumbar: -8,
  footRX: 40,
  footRLift: 6,
});
const frontHome = overhead({
  ...split,
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
const standing = overhead({
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

export const cleanAndJerk = gesture({
  key: "clean-and-jerk",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [
    startKey(0, 520),
    ...cleanKeys({ standing: 1 }, 500),
    { id: "adjust", set: adjust, air: ["R", "L"], move: { ms: 180, curve: "linear", phase: "adjust" } },
    { id: "set", set, hold: 500, guide: 2, move: { ms: 180, curve: "reception", phase: "adjust" } },
    { id: "dip", set: dip, face: "effort", still: true, move: { ms: 340, curve: "impulsion", phase: "dip" } },
    { id: "drive", set: drive, face: "effort", still: true, move: { ms: 190, curve: "elan", phase: "drive" } },
    { id: "flying", set: flying, face: "effort", air: ["R", "L"], move: { ms: 120, curve: "linear", phase: "split" } },
    {
      id: "split",
      set: split,
      hold: 500,
      face: "effort",
      guide: 3,
      move: { ms: 150, curve: "reception", phase: "split" },
    },
    { id: "front-back", set: frontBack, air: ["R"], move: { ms: 260, curve: "elan", phase: "feet-together" } },
    { id: "front-home", set: frontHome, move: { ms: 240, curve: "reception", phase: "feet-together" } },
    { id: "rear-forward", set: rearForward, air: ["L"], move: { ms: 260, curve: "elan", phase: "feet-together" } },
    {
      id: "overhead",
      set: standing,
      hold: 700,
      face: "joy",
      move: { ms: 240, curve: "reception", phase: "feet-together" },
    },
    { id: "over-face", set: overFace, move: { ms: 380, curve: "elan", phase: "return" } },
    { id: "back-to-rack", set: backToRack, move: { ms: 320, curve: "reception", phase: "return" } },
    ...returnKeys(),
  ],
});
