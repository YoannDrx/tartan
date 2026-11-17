// L'arraché : Malo, l'athlète de l'haltérophilie. La barre suit une trajectoire donnée, proche du corps, et le
// corps s'organise autour d'elle : bras tendus pendant les deux tirées, puis sous la barre, puis debout.
// Repères techniques : départ barre au-dessus de l'avant-pied, épaules à l'aplomb ou un peu en avant, dos cambré
// et gainé (Everett, 2018) ; première tirée jusqu'aux genoux, transition genoux sous la barre, seconde tirée
// explosive, passage sous la barre jusqu'au point haut de la barre, réception, redressement (Harbili et
// Alptekin, 2014 ; Gourgoulis et al., 2000). La barre recule vers l'athlète en première tirée, repart un peu
// vers l'avant, puis revient à la réception : une courbe en S, de faible amplitude (Everett, 2014).
import { gesture } from "../gesture";
import { STAND, stance, type ControlPatch } from "../pose";
import { barAtArmsLength, type Rig } from "../solve";

// Prise large : debout, bras tendus, la barre arrive au pli de l'aine.
const GRIP = 102;
const RIG: Rig = { bar: { grip: GRIP, hold: "hands" } };

// Les pieds du tirage, sous les hanches ; ceux de la réception, plus écartés et plus ouverts.
const pulling = stance(24, 15, 13);
const receiving = stance(46, 27, 12.3);
const between = stance(36, 21, 12.7);

// Coudes tournés vers l'extérieur, au-dessus de la barre.
const base: ControlPatch = { ...pulling, elbowForward: -0.3, elbowUp: 0.2, elbowOut: 1, armsLong: 1 };

// Bras tendus au-dessus de la tête : les coudes verrouillés vers l'arrière, les poignets cassés, les épaules actives.
const locked: ControlPatch = { ...receiving, elbowForward: -0.6, elbowUp: -0.3, elbowOut: 1, wrist: 40, shrug: 0.6 };

// La hauteur de la barre tenue bras tendus, jambes tendues : là où ce sont les jambes qui fixent la hauteur du corps.
const armsLength = (patch: ControlPatch, above: boolean) =>
  barAtArmsLength({ ...STAND, ...base, ...patch, pelvisY: 999 }, GRIP, above);

const start: ControlPatch = {
  barX: 13,
  barY: 41,
  pelvisX: -46,
  pelvisPitch: 55,
  lumbar: -4,
  thoracic: -3,
  neck: -32,
  head: -6,
};
const knees: ControlPatch = {
  barX: 5,
  barY: 90,
  pelvisX: -68,
  pelvisPitch: 60,
  lumbar: -4,
  thoracic: -3,
  neck: -34,
  head: -6,
};
// Les genoux reviennent sous la barre, le buste se redresse : la barre arrive en haut des cuisses.
const power: ControlPatch = { barX: 9, barY: 140, pelvisX: -16, pelvisPitch: 14, lumbar: -2, thoracic: -2, neck: -8 };

// Chevilles, genoux et hanches tendus, épaules haussées, bras encore longs.
const extended: ControlPatch = {
  barX: 11,
  pelvisX: -7,
  pelvisPitch: -5,
  lumbar: -3,
  thoracic: -2,
  neck: 4,
  shrug: 1,
  footRHeel: 35,
  footLHeel: 35,
};
// La barre monte encore après l'extension, puis redescend un peu jusqu'à la réception : ces hauteurs se comptent
// depuis celle de l'extension.
const TOP = armsLength(extended, false);
const extension: ControlPatch = { ...extended, barY: TOP };

// Le corps commence à descendre : les coudes montent, hauts et vers l'extérieur, la barre reste contre le buste.
const highPull: ControlPatch = {
  barX: 10,
  barY: TOP + 36,
  pelvisX: -12,
  pelvisY: 164,
  pelvisPitch: -5,
  lumbar: -2,
  thoracic: -2,
  neck: 4,
  shrug: 1,
  armsLong: 0,
  elbowForward: -0.3,
  elbowUp: 0.9,
  elbowOut: 1,
  footRHeel: 22,
  footLHeel: 22,
};
// Le point haut de la barre : les pieds se déplacent, les coudes tournent sous la barre.
const under: ControlPatch = {
  ...between,
  barX: 6,
  barY: TOP + 59,
  pelvisX: -22,
  pelvisY: 110,
  pelvisPitch: 0,
  lumbar: 2,
  thoracic: -2,
  neck: 0,
  shrug: 0.8,
  armsLong: 0,
  elbowForward: -0.2,
  elbowUp: -0.3,
  elbowOut: 1,
  wrist: 15,
  footRHeel: 12,
  footLHeel: 12,
  footRLift: 4,
  footLLift: 4,
};
const lockout: ControlPatch = {
  ...locked,
  barX: -2,
  barY: TOP + 56,
  pelvisX: -35,
  pelvisY: 60,
  pelvisPitch: 13,
  lumbar: 9,
  thoracic: -3,
  neck: -10,
};
const catching: ControlPatch = {
  ...locked,
  barX: -5,
  barY: TOP + 49,
  pelvisX: -37,
  pelvisY: 44,
  pelvisPitch: 13,
  lumbar: 12,
  thoracic: -3,
  neck: -8,
};
// À mi-hauteur, les hanches sont encore en arrière : les genoux ne partent pas vers l'avant.
const rising: ControlPatch = {
  ...locked,
  barX: -5,
  barY: TOP + 49 + 66,
  pelvisX: -33,
  pelvisPitch: 14,
  lumbar: 6,
  thoracic: -3,
  neck: -8,
};
const upright: ControlPatch = { ...locked, barX: -4, pelvisX: -9, pelvisPitch: 2, lumbar: -1, thoracic: -1 };
const standing: ControlPatch = { ...upright, barY: armsLength(upright, true) };
const lowering: ControlPatch = {
  ...between,
  barX: 32,
  barY: 300,
  pelvisX: -10,
  pelvisY: 999,
  pelvisPitch: 0,
  neck: 4,
  armsLong: 0,
  elbowForward: 0.8,
  elbowUp: -0.2,
  elbowOut: 1,
  footRLift: 3,
  footLLift: 3,
};
// En redescendant, les coudes passent au-dessus de la barre, comme à la montée.
const hanging: ControlPatch = { barX: 13, pelvisX: -10, pelvisPitch: 2, elbowForward: 0, elbowUp: 0.8 };
const hips: ControlPatch = { ...hanging, barY: armsLength(hanging, false) };

export const snatch = gesture({
  key: "snatch",
  athlete: "poleVault",
  rig: RIG,
  base,
  keys: [
    {
      name: "Départ : barre au-dessus de l'avant-pied",
      set: start,
      hold: 800,
      move: { ms: 520, curve: "reception", phase: "Retour au départ" },
    },
    {
      name: "Barre aux genoux",
      set: knees,
      face: "effort",
      still: true,
      move: { ms: 700, curve: "elan", phase: "Première tirée" },
    },
    {
      name: "Position de puissance",
      set: power,
      face: "effort",
      still: true,
      move: { ms: 240, curve: "linear", phase: "Transition" },
    },
    {
      name: "Extension complète",
      set: extension,
      face: "effort",
      still: true,
      move: { ms: 160, curve: "elan", phase: "Seconde tirée" },
    },
    {
      name: "Coudes hauts",
      set: highPull,
      face: "effort",
      still: true,
      move: { ms: 120, curve: "linear", phase: "Passage sous la barre" },
    },
    {
      name: "Sous la barre, au point haut",
      set: under,
      face: "effort",
      air: ["R", "L"],
      still: true,
      move: { ms: 160, curve: "linear", phase: "Passage sous la barre" },
    },
    {
      name: "Verrouillage",
      set: lockout,
      face: "effort",
      move: { ms: 160, curve: "linear", phase: "Réception" },
    },
    {
      name: "Réception en squat, bras tendus",
      set: catching,
      hold: 400,
      face: "effort",
      move: { ms: 320, curve: "reception", phase: "Réception" },
    },
    {
      name: "Mi-redressement",
      set: rising,
      face: "effort",
      move: { ms: 560, curve: "elan", phase: "Redressement" },
    },
    {
      name: "Debout, barre au-dessus de la tête",
      set: standing,
      hold: 800,
      face: "joy",
      move: { ms: 620, curve: "reception", phase: "Redressement" },
    },
    // La barre redescend pour que la boucle reparte : ce retour ne fait pas partie de la technique.
    {
      name: "Barre devant le visage",
      set: lowering,
      air: ["R", "L"],
      move: { ms: 450, curve: "elan", phase: "Retour au départ" },
    },
    {
      name: "Barre aux hanches",
      set: hips,
      move: { ms: 350, curve: "linear", phase: "Retour au départ" },
    },
    {
      name: "Barre aux genoux, en descendant",
      set: knees,
      move: { ms: 480, curve: "linear", phase: "Retour au départ" },
    },
  ],
});
