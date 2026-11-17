// La fente latérale, au poids du corps : Mehdi. Le geste se lit de face, et le profil montre les hanches qui
// reculent. Repères techniques : pieds tournés vers l'avant, grand pas de côté, hanches vers l'arrière, genou
// fléchi au-dessus du pied, autre jambe tendue, les deux pieds à plat, puis une poussée pour revenir (ACE,
// « Side Lunge »).
import { gesture } from "../gesture";
import { BALL_X, type ControlPatch } from "../pose";
import type { Rig } from "../solve";

const RIG: Rig = { bar: null };

// Le pied gauche ne quitte pas sa place ; le droit part sur le côté, se pose, puis revient.
const HOME = 19;
const STEP = 185;

// Les mains jointes devant la poitrine, les coudes vers le bas.
const base: ControlPatch = {
  footLX: BALL_X,
  footLZ: -HOME,
  footLYaw: 5,
  footRX: BALL_X,
  footRZ: HOME,
  footRYaw: 5,
  handForward: 27,
  handUp: -30,
  handOut: 3,
  elbowForward: 0,
  elbowUp: -1,
  elbowOut: 0.8,
};

export const lateralLunge = gesture({
  key: "lateral-lunge",
  athlete: "discus",
  rig: RIG,
  base,
  keys: [
    {
      name: "Debout, pieds sous les hanches",
      hold: 700,
      move: { ms: 480, curve: "reception", phase: "Retour" },
    },
    {
      name: "Pas de côté",
      set: { pelvisX: -10, pelvisY: 165, pelvisZ: 30, pelvisPitch: 8, neck: -4, footRZ: 118, footRLift: 10 },
      air: ["R"],
      move: { ms: 330, curve: "elan", phase: "Pas de côté" },
    },
    {
      name: "Pose du pied",
      set: {
        pelvisX: -15,
        pelvisY: 146,
        pelvisZ: 84,
        pelvisPitch: 15,
        lumbar: 2,
        neck: -8,
        kneeROut: 20,
        footRZ: STEP,
      },
      still: true,
      move: { ms: 220, curve: "linear", phase: "Pas de côté" },
    },
    {
      name: "Fente : hanches en arrière, jambe gauche tendue",
      set: {
        pelvisX: -36,
        pelvisY: 126,
        pelvisZ: 112,
        kneeROut: 40,
        pelvisPitch: 30,
        lumbar: 5,
        thoracic: 3,
        neck: -24,
        footRZ: STEP,
      },
      hold: 500,
      face: "effort",
      move: { ms: 650, curve: "reception", phase: "Descente" },
    },
    {
      // Le pied droit pousse encore le sol : c'est lui qui renvoie le corps vers le centre.
      name: "Poussée sur la jambe fléchie",
      set: {
        pelvisX: -24,
        pelvisY: 144,
        pelvisZ: 88,
        pelvisPitch: 20,
        lumbar: 3,
        thoracic: 1,
        neck: -14,
        kneeROut: 28,
        footRZ: STEP,
      },
      face: "effort",
      still: true,
      move: { ms: 380, curve: "elan", phase: "Poussée" },
    },
    {
      name: "Retour du pied",
      set: { pelvisX: -12, pelvisY: 164, pelvisZ: 40, pelvisPitch: 9, lumbar: 1, neck: -5, footRZ: 104, footRLift: 9 },
      air: ["R"],
      move: { ms: 260, curve: "linear", phase: "Retour" },
    },
  ],
});
