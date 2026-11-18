// Les gestes bras tendus au-dessus de la tête, en prise d'arraché : Malo.
// - Le squat bras tendus : la barre reste au-dessus du milieu du pied, bras verrouillés, épaules actives ; le
//   buste reste plus droit qu'au squat arrière, les hanches descendent entre les pieds, la barre au-dessus de la
//   base du cou (Catalyst Athletics, « Overhead Squat »).
// - L'équilibre d'arraché : la barre part des trapèzes ; une courte flexion, une petite impulsion pour la
//   décoller, puis l'athlète se pousse sous elle, les pieds se replacent, et la reçoit en flexion complète bras
//   verrouillés. La barre passe derrière la tête, jamais à travers. Réglé à l'œil d'après la fiche du catalogue :
//   aucune source ouverte pour ce geste.
import { gesture } from "../gesture";
import { elbows, heels, STAND, type ControlPatch } from "../pose";
import { RACK, solve } from "../solve";
import { along } from "../vec";
import {
  between,
  pulling,
  receiving,
  SNATCH_RIG,
  snatchBase,
  snatchOverhead,
  snatchReceive,
  snatchRising,
} from "./snatch";

// --- Le squat bras tendus -------------------------------------------------------------------------------------

// À mi-descente, le bassin recule et descend, le buste reste droit, la barre au-dessus du milieu du pied.
const halfway: ControlPatch = { ...snatchRising, barX: -3 };
const bottom: ControlPatch = { ...snatchReceive, barX: -3 };

export const overheadSquat = gesture({
  key: "overhead-squat",
  athlete: "poleVault",
  rig: SNATCH_RIG,
  base: snatchBase,
  keys: [
    { id: "standing", guide: 0, set: snatchOverhead, hold: 800, move: { ms: 520, curve: "reception", phase: "up" } },
    { id: "descent", guide: 1, set: halfway, still: true, move: { ms: 800, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: bottom,
      hold: 350,
      face: "effort",
      move: { ms: 900, curve: "reception", phase: "down" },
    },
    {
      id: "ascent",
      guide: 3,
      set: halfway,
      face: "effort",
      still: true,
      move: { ms: 520, curve: "elan", phase: "up" },
    },
  ],
});

// --- L'équilibre d'arraché ------------------------------------------------------------------------------------

// La barre sur les trapèzes, mains en prise d'arraché, coudes sous la barre.
const trapArms: ControlPatch = { ...elbows(-0.2, -1, 0.5), wrist: 20, armsLong: 0 };
const onTraps = (patch: ControlPatch): ControlPatch => {
  const set = { ...trapArms, ...patch };
  const body = solve({ ...STAND, ...snatchBase, ...set }, { bar: null });
  const at = along(body.neck, body.frames.thorax, -RACK.back, -RACK.drop, 0);
  return { ...set, barX: at.x, barY: at.y };
};

const racked = onTraps({ ...pulling, pelvisX: -12, pelvisY: 999, pelvisPitch: 2, neck: 2 });
const dip = onTraps({ ...pulling, pelvisX: -10, pelvisY: 154, pelvisPitch: 0, neck: 2 });
// La petite impulsion : jambes tendues, sur l'avant-pied, la barre décolle à peine du dos.
const drive: ControlPatch = (() => {
  const patch = onTraps({ ...pulling, ...heels(22), pelvisX: -11, pelvisY: 999, pelvisPitch: 0, neck: 10, shrug: 1 });
  return { ...patch, barX: patch.barX! - 3, barY: patch.barY! + 8 };
})();
// L'athlète se pousse sous la barre : les pieds en l'air, les bras poussent, la barre derrière la tête, que le
// cou avance pour la laisser passer.
const under: ControlPatch = {
  ...between,
  barX: drive.barX! - 10,
  barY: drive.barY! + 2,
  pelvisX: -33,
  pelvisY: 114,
  pelvisPitch: 6,
  lumbar: 4,
  thoracic: -2,
  neck: 18,
  shrug: 0.8,
  armsLong: 0,
  ...elbows(-0.4, -0.6, 1),
  wrist: 25,
  footRLift: 4,
  footLLift: 4,
};
const caught: ControlPatch = { ...snatchReceive };
// Debout, pieds de réception : la barre au-dessus de la base d'appui.
const standing = snatchOverhead;
// La barre redescend derrière la tête, la tête un peu en avant, les pieds encore écartés ; puis elle se pose sur
// les trapèzes pendant que les pieds reviennent sous les hanches.
const behind: ControlPatch = {
  ...receiving,
  barX: racked.barX! - 14,
  barY: racked.barY! + 50,
  pelvisX: -12,
  pelvisY: 999,
  pelvisPitch: 2,
  neck: 14,
  armsLong: 0,
  ...elbows(-0.4, -0.8, 0.8),
  wrist: 25,
};
const feetIn: ControlPatch = { ...racked, ...between, barY: racked.barY! + 4, footRLift: 3, footLLift: 3 };

export const snatchBalance = gesture({
  key: "snatch-balance",
  athlete: "poleVault",
  rig: SNATCH_RIG,
  base: snatchBase,
  keys: [
    { id: "racked", guide: 0, set: racked, hold: 700, move: { ms: 260, curve: "reception", phase: "return" } },
    { id: "dip", guide: 1, set: dip, face: "effort", still: true, move: { ms: 320, curve: "impulsion", phase: "dip" } },
    { id: "drive", set: drive, face: "effort", still: true, move: { ms: 170, curve: "elan", phase: "drive" } },
    {
      id: "under",
      set: under,
      face: "effort",
      air: ["R", "L"],
      still: true,
      move: { ms: 170, curve: "linear", phase: "drop" },
    },
    {
      id: "receive",
      guide: 2,
      set: caught,
      hold: 450,
      face: "effort",
      move: { ms: 260, curve: "reception", phase: "drop" },
    },
    { id: "rising", set: snatchRising, face: "effort", move: { ms: 560, curve: "elan", phase: "recovery" } },
    {
      id: "overhead",
      guide: 3,
      set: standing,
      hold: 800,
      face: "joy",
      move: { ms: 620, curve: "reception", phase: "recovery" },
    },
    { id: "behind", set: behind, move: { ms: 520, curve: "elan", phase: "return" } },
    { id: "feet-in", set: feetIn, air: ["R", "L"], move: { ms: 300, curve: "linear", phase: "return" } },
  ],
});
