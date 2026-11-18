// Les gestes au poids du corps : Mehdi, l'athlète de la musculation. Les mains tiennent un point fixe de la scène
// (une barre fixe, des barres parallèles, le sol) et c'est le corps qui se déplace autour d'elles.
// - Tractions : départ suspendu bras allongés, épaules engagées (abaissées) avant de tirer, sans élan des jambes ;
//   le menton passe au-dessus de la barre ; descente contrôlée jusqu'aux bras allongés. En pronation, prise un peu
//   plus large que les épaules, coudes vers l'extérieur ; en supination, prise plus serrée, coudes vers l'avant et
//   le bas (NSCA, « Exercise Technique Manual for Resistance Training », 2016 ; ACE, « Pull-up », « Chin-up »).
// - Dips : appui bras tendus, épaules basses ; descente en fléchissant les coudes, buste un peu penché vers
//   l'avant, jusqu'à un coude à peu près droit ; remontée bras tendus (ACE, « Dips » ; NSCA, 2016).
// - Pompes : mains un peu plus larges que les épaules, sous elles ; corps gainé en une ligne des chevilles aux
//   épaules ; les coudes s'écartent d'environ quarante-cinq degrés ; la poitrine descend près du sol
//   (ACE, « Push-up » ; ACSM, « Resistance Training for Health », 2021).
// Descentes plus lentes que les montées ; les tenues se marquent en haut et en bas.
import { FIGURE } from "../body";
import { gesture } from "../gesture";
import { span } from "../ik";
import { elbows, STAND, type ControlPatch } from "../pose";
import { solve } from "../solve";
import { vec, type Vec3 } from "../vec";
import { armSpan, parallelBars, pelvisFor, pinned, pullBar } from "./gym";

const RIG = { bar: null };

// --- Tractions ------------------------------------------------------------------------------------------------

// La barre fixe : à un peu plus de deux mètres, juste devant l'athlète.
const BAR = { x: 10, y: 436 };

// Les jambes pendent dans le prolongement du buste, pointes basses, sans balancer.
const hangingLegs = (pelvisX: number, pelvisY: number, lean: number): ControlPatch => ({
  footRX: pelvisX + 6 - 1.2 * lean,
  footRZ: 16,
  footRYaw: 4,
  footRLift: pelvisY - 174,
  footRHeel: 55,
  footLX: pelvisX + 6 - 1.2 * lean,
  footLZ: -16,
  footLYaw: 4,
  footLLift: pelvisY - 174,
  footLHeel: 55,
});

// Une position suspendue : le buste, puis le bassin à la hauteur où le coude a la flexion voulue.
const hanging = (hand: Vec3, arms: ControlPatch, patch: ControlPatch, flexion: number): ControlPatch => {
  const set = { ...arms, ...pinned(hand), ...patch };
  const pelvisY = pelvisFor(set, hand, flexion, false);
  return { ...set, pelvisY, ...hangingLegs(patch.pelvisX ?? 0, pelvisY, patch.pelvisPitch ?? 0) };
};

const pullUpOf = (key: string, grip: number, arms: ControlPatch) => {
  const hand = vec(BAR.x, BAR.y, grip);
  // Bras allongés, les épaules montent vers les oreilles ; engagées, elles s'abaissent.
  const dead = hanging(hand, arms, { pelvisX: 6, pelvisPitch: -2, shrug: 1, neck: -4 }, 3);
  const engaged = hanging(hand, arms, { pelvisX: 4, pelvisPitch: -4, shrug: 0, neck: -4 }, 10);
  // Le menton au-dessus de la barre : le buste s'incline un peu en arrière, la tête passe derrière la barre.
  const top = hanging(hand, arms, { pelvisX: -2, pelvisPitch: -12, shrug: 0, neck: 4, head: -4 }, 150);
  const lowering = hanging(hand, arms, { pelvisX: 0, pelvisPitch: -8, shrug: 0, neck: 0 }, 80);
  return gesture({
    key,
    athlete: "discus",
    rig: RIG,
    base: arms,
    keys: [
      {
        id: "hang",
        guide: 0,
        set: dead,
        hold: 700,
        air: ["R", "L"],
        move: { ms: 650, curve: "reception", phase: "lower" },
      },
      {
        id: "engage",
        guide: 1,
        set: engaged,
        hold: 300,
        air: ["R", "L"],
        move: { ms: 300, curve: "impulsion", phase: "engage" },
      },
      {
        id: "top",
        guide: 2,
        set: top,
        hold: 350,
        face: "effort",
        air: ["R", "L"],
        move: { ms: 850, curve: "impulsion", phase: "pull" },
      },
      {
        id: "lowering",
        guide: 3,
        set: lowering,
        still: true,
        air: ["R", "L"],
        move: { ms: 750, curve: "elan", phase: "lower" },
      },
    ],
    props: () => pullBar(BAR.x, BAR.y + 6, 120),
  });
};

// Pronation : les mains un peu plus larges que les épaules, les coudes vers l'extérieur.
export const pullUp = pullUpOf("pull-up", FIGURE.shoulder + 16, { ...elbows(0.1, -0.7, 1), wrist: 0 });
// Supination : plus serrée, les coudes vers l'avant et le bas.
export const chinUp = pullUpOf("chin-up", FIGURE.shoulder - 6, { ...elbows(0.9, -0.7, 0.2), wrist: 0 });

// --- Dips -----------------------------------------------------------------------------------------------------

const DIP = { x: 0, y: 250, z: FIGURE.shoulder + 8 };

// Les genoux pliés, les pieds croisés derrière, loin du sol.
const tucked = (pelvisX: number, pelvisY: number): ControlPatch => ({
  footRX: pelvisX - 62,
  footRZ: 12,
  footRYaw: 0,
  footRLift: pelvisY - 112,
  footRHeel: 75,
  footLX: pelvisX - 62,
  footLZ: -12,
  footLYaw: 0,
  footLLift: pelvisY - 112,
  footLHeel: 75,
});
const dipArms: ControlPatch = { ...elbows(-1, 0.1, 0.25), wrist: 10 };
const supported = (patch: ControlPatch, flexion: number): ControlPatch => {
  const hand = vec(DIP.x, DIP.y, DIP.z);
  const set = { ...dipArms, ...pinned(hand), ...patch };
  const pelvisY = pelvisFor(set, hand, flexion, true);
  return { ...set, pelvisY, ...tucked(patch.pelvisX ?? 0, pelvisY) };
};

const dipTop = supported({ pelvisX: -8, pelvisPitch: 6, shrug: 0, neck: -4 }, 4);
const dipHalf = supported({ pelvisX: -16, pelvisPitch: 14, shrug: 0.1, neck: -8 }, 55);
const dipBottom = supported({ pelvisX: -24, pelvisPitch: 22, shrug: 0.2, neck: -12 }, 92);

export const parallelBarDips = gesture({
  key: "parallel-bar-dips",
  athlete: "discus",
  rig: RIG,
  base: dipArms,
  keys: [
    {
      id: "support",
      guide: 0,
      set: dipTop,
      hold: 700,
      air: ["R", "L"],
      move: { ms: 450, curve: "reception", phase: "up" },
    },
    {
      id: "descent",
      guide: 1,
      set: dipHalf,
      still: true,
      air: ["R", "L"],
      move: { ms: 700, curve: "elan", phase: "down" },
    },
    {
      id: "bottom",
      guide: 2,
      set: dipBottom,
      hold: 250,
      face: "effort",
      air: ["R", "L"],
      move: { ms: 750, curve: "reception", phase: "down" },
    },
    {
      id: "ascent",
      guide: 3,
      set: dipHalf,
      still: true,
      face: "effort",
      air: ["R", "L"],
      move: { ms: 450, curve: "elan", phase: "up" },
    },
  ],
  props: () => parallelBars(DIP.x, DIP.y - 6, DIP.z),
});

// --- Pompes ---------------------------------------------------------------------------------------------------

// Les pieds sur la pointe, l'avant-pied fixe ; le corps pivote autour des chevilles.
const TOES = { x: -128, z: 16 };
const HAND_Y = 10;
// Une jambe presque tendue, de la hanche à la cheville.
const LEG = span(FIGURE.thigh, FIGURE.shin, 4);

// Le corps en planche, incliné de `elevation` degrés : le bassin dans l'axe des jambes, le talon levé d'autant que
// le tibia s'incline, pour que la cheville garde son angle.
const plank = (elevation: number): ControlPatch => {
  const heel = 90 - elevation;
  const h = (heel * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  const ankle = { x: TOES.x - FIGURE.foot.ball * Math.cos(h) + FIGURE.ankle * Math.sin(h), y: 0 };
  ankle.y = FIGURE.foot.ball * Math.sin(h) + FIGURE.ankle * Math.cos(h);
  return {
    footRX: TOES.x,
    footRZ: TOES.z,
    footRYaw: 0,
    footRHeel: heel,
    footLX: TOES.x,
    footLZ: -TOES.z,
    footLYaw: 0,
    footLHeel: heel,
    kneeRForward: 0,
    kneeRUp: -1,
    kneeLForward: 0,
    kneeLUp: -1,
    pelvisX: ankle.x + LEG * Math.cos(e),
    pelvisY: ankle.y + LEG * Math.sin(e),
    pelvisPitch: 90 - elevation,
    neck: -6,
  };
};
const shoulderOf = (elevation: number) => solve({ ...STAND, ...plank(elevation) }, RIG).arms.R.shoulder;

// En haut, bras tendus, les mains sous les épaules : l'inclinaison qui donne cette hauteur d'épaule.
const HAND_Z = FIGURE.shoulder + 8;
const PUSH_WRIST = -40;
const TOP_HEIGHT = HAND_Y + Math.sqrt(armSpan(4, PUSH_WRIST) ** 2 - (HAND_Z - FIGURE.shoulder) ** 2);
const elevationAt = (height: number) => {
  let [low, high] = [2, 60];
  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    if (shoulderOf(mid).y < height) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};
const TOP = elevationAt(TOP_HEIGHT);
const PUSH_HAND = vec(shoulderOf(TOP).x + 2, HAND_Y, HAND_Z);
// En bas, la poitrine près du sol.
const BOTTOM = elevationAt(50);
const MIDDLE = (TOP + BOTTOM) / 2;

const pushArms: ControlPatch = { ...elbows(-0.6, -0.5, 0.7), wrist: PUSH_WRIST, ...pinned(PUSH_HAND) };

export const pushUp = gesture({
  key: "push-up",
  athlete: "discus",
  rig: RIG,
  base: pushArms,
  keys: [
    { id: "top", guide: 0, set: plank(TOP), hold: 650, move: { ms: 420, curve: "reception", phase: "up" } },
    { id: "descent", guide: 1, set: plank(MIDDLE), still: true, move: { ms: 650, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: plank(BOTTOM),
      hold: 200,
      face: "effort",
      move: { ms: 650, curve: "reception", phase: "down" },
    },
    {
      id: "ascent",
      guide: 3,
      set: plank(MIDDLE),
      face: "effort",
      still: true,
      move: { ms: 420, curve: "elan", phase: "up" },
    },
  ],
});
