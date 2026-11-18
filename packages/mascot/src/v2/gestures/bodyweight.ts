// Les gestes au poids du corps : Mehdi, l'athlète de la musculation. Les mains tiennent un point fixe de la scène
// (une barre fixe, des barres parallèles, le sol) et c'est le corps qui se déplace autour d'elles.
// - Tractions : départ suspendu bras allongés, épaules engagées (abaissées) avant de tirer, sans élan des jambes ;
//   le menton passe au-dessus de la barre ; descente contrôlée jusqu'aux bras allongés. En pronation, prise un peu
//   plus large que les épaules, coudes vers l'extérieur ; en supination, prise plus serrée, coudes vers l'avant et
//   le bas.
// - Dips : appui bras tendus, épaules basses ; descente en fléchissant les coudes, buste un peu penché vers
//   l'avant, jusqu'à un coude à peu près droit ; remontée bras tendus.
// - Pompes : mains un peu plus larges que les épaules, sous elles ; corps gainé en une ligne des chevilles aux
//   épaules ; les coudes s'écartent d'environ quarante-cinq degrés ; la poitrine descend près du sol.
// Descentes plus lentes que les montées ; les tenues se marquent en haut et en bas. Positions réglées à l'œil
// d'après les fiches du catalogue : aucune source ouverte pour ces gestes.
import { FIGURE } from "../body";
import { gesture } from "../gesture";
import { span } from "../ik";
import { elbows, STAND, type ControlPatch } from "../pose";
import { solve } from "../solve";
import { vec, type Vec3 } from "../vec";
import type { Prop } from "../props";
import { skin } from "../skin";
import { armSpan, bench, parallelBars, pelvisFor, pinned, pullBar } from "./gym";

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

// Une jambe presque tendue, de la hanche à la cheville.
const LEG = span(FIGURE.thigh, FIGURE.shin, 4);

// La cheville d'un pied dont l'avant-pied est posé en `x`, talon levé de `heel` degrés (négatif : la pointe en
// l'air, le pied posé sur le talon).
const ankleOf = (x: number, lift: number, heel: number) => {
  const h = (heel * Math.PI) / 180;
  return {
    x: x - FIGURE.foot.ball * Math.cos(h) + FIGURE.ankle * Math.sin(h),
    y: lift + FIGURE.foot.ball * Math.sin(h) + FIGURE.ankle * Math.cos(h),
  };
};

// Le corps en planche face au sol, incliné de `elevation` degrés : le bassin dans l'axe des jambes, le talon levé
// d'autant que le tibia s'incline, pour que la cheville garde son angle.
const plank = (toes: number, elevation: number): ControlPatch => {
  const heel = 90 - elevation;
  const e = (elevation * Math.PI) / 180;
  const ankle = ankleOf(toes, 0, heel);
  return {
    footRX: toes,
    footRZ: 16,
    footRYaw: 0,
    footRHeel: heel,
    footLX: toes,
    footLZ: -16,
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

// L'inclinaison qui met l'épaule droite à la hauteur voulue.
const elevationFor = (shape: (elevation: number) => ControlPatch, height: number) => {
  const shoulder = (elevation: number) => solve({ ...STAND, ...shape(elevation) }, RIG).arms.R.shoulder;
  let [low, high] = [-80, 85];
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (shoulder(mid).y < height) low = mid;
    else high = mid;
  }
  const elevation = (low + high) / 2;
  return { elevation, shoulder: shoulder(elevation) };
};

const HAND_Z = FIGURE.shoulder + 8;
const PUSH_WRIST = -40;

// Une pompe, les mains posées à la hauteur `hands` (le sol, ou un banc) : en haut, bras tendus, mains sous les
// épaules ; en bas, la poitrine à `chest` au-dessus des mains.
const pushUpOn = (key: string, toes: number, hands: number, chest: number, props?: (hand: Vec3) => Prop[]) => {
  const handY = hands + 10;
  const shape = (elevation: number) => plank(toes, elevation);
  const top = elevationFor(shape, handY + Math.sqrt(armSpan(4, PUSH_WRIST) ** 2 - (HAND_Z - FIGURE.shoulder) ** 2));
  const bottom = elevationFor(shape, handY + chest).elevation;
  const middle = (top.elevation + bottom) / 2;
  const hand = vec(top.shoulder.x + 2, handY, HAND_Z);
  return gesture({
    key,
    athlete: "discus",
    rig: RIG,
    base: { ...elbows(-0.6, -0.5, 0.7), wrist: PUSH_WRIST, ...pinned(hand) },
    keys: [
      { id: "top", guide: 0, set: shape(top.elevation), hold: 650, move: { ms: 420, curve: "reception", phase: "up" } },
      { id: "descent", guide: 1, set: shape(middle), still: true, move: { ms: 650, curve: "elan", phase: "down" } },
      {
        id: "bottom",
        guide: 2,
        set: shape(bottom),
        hold: 200,
        face: "effort",
        move: { ms: 650, curve: "reception", phase: "down" },
      },
      {
        id: "ascent",
        guide: 3,
        set: shape(middle),
        face: "effort",
        still: true,
        move: { ms: 420, curve: "elan", phase: "up" },
      },
    ],
    ...(props ? { props: () => props(hand) } : {}),
  });
};

export const pushUp = pushUpOn("push-up", -128, 0, 40);

// Pompes inclinées : les mains sur un banc, les pieds plus loin derrière ; le corps reste en planche.
const INCLINE_BENCH = 78;
// Le banc sous les mains.
export const inclinePushUp = pushUpOn("incline-push-up", -150, INCLINE_BENCH, 36, (hand) =>
  bench(hand.x - 46, hand.x + 44, INCLINE_BENCH, 40),
);

// --- Tirage inversé -------------------------------------------------------------------------------------------

// Couché sous une barre basse, les talons au sol, le corps droit : il pivote sur les talons et monte vers la barre.
const ROW_BAR = 176;
const HEELS = { x: 140, heel: -62 };
// Le pied posé sur le talon, la pointe vers le haut : la hauteur de l'avant-pied qui pose le talon sur le sol.
const HEEL_LIFT = (() => {
  const shoe = {
    ...STAND,
    footRX: HEELS.x,
    footRHeel: HEELS.heel,
    footRLift: 0,
    footLX: HEELS.x,
    footLHeel: HEELS.heel,
  };
  const body = solve({ ...shoe, footLLift: 0 }, RIG);
  const part = skin(body).parts.find((candidate) => candidate.id === "shoeR")!;
  return -Math.min(...part.spheres.map(({ c, r }) => c.y - r));
})();
// Le corps sur le dos, la tête vers l'arrière de la scène, incliné de `elevation` degrés depuis les chevilles.
const supine = (elevation: number): ControlPatch => {
  const ankle = ankleOf(HEELS.x, HEEL_LIFT, HEELS.heel);
  const e = (elevation * Math.PI) / 180;
  return {
    footRX: HEELS.x,
    footRZ: 16,
    footRYaw: 0,
    footRLift: HEEL_LIFT,
    footRHeel: HEELS.heel,
    footLX: HEELS.x,
    footLZ: -16,
    footLYaw: 0,
    footLLift: HEEL_LIFT,
    footLHeel: HEELS.heel,
    kneeRForward: 0,
    kneeRUp: 1,
    kneeLForward: 0,
    kneeLUp: 1,
    pelvisX: ankle.x - LEG * Math.cos(e),
    pelvisY: ankle.y + LEG * Math.sin(e),
    pelvisPitch: -(90 - elevation),
    neck: 8,
  };
};
const ROW_GRIP = FIGURE.shoulder + 12;
const rowArms: ControlPatch = { ...elbows(-1, -0.4, 0.6), wrist: 0 };
// En bas, bras tendus, la barre à l'aplomb des épaules ; en haut, la poitrine près de la barre.
const rowLow = elevationFor(supine, ROW_BAR - Math.sqrt(armSpan(4) ** 2 - (ROW_GRIP - FIGURE.shoulder) ** 2));
const ROW_HAND = vec(rowLow.shoulder.x, ROW_BAR, ROW_GRIP);
const rowHigh = elevationFor(supine, ROW_BAR - 24).elevation;
const rowHalf = (rowLow.elevation + rowHigh) / 2;

export const invertedRow = gesture({
  key: "inverted-row",
  athlete: "discus",
  rig: RIG,
  base: { ...rowArms, ...pinned(ROW_HAND) },
  keys: [
    {
      id: "hang",
      guide: 0,
      set: supine(rowLow.elevation),
      hold: 600,
      move: { ms: 300, curve: "reception", phase: "lower" },
    },
    {
      id: "set",
      guide: 1,
      set: { ...supine(rowLow.elevation), neck: 0 },
      hold: 300,
      move: { ms: 250, curve: "impulsion", phase: "engage" },
    },
    // Des positions intermédiaires : le corps pivote sur les talons, il ne se plie pas en route.
    { id: "pulling", set: supine(rowHalf), face: "effort", move: { ms: 330, curve: "elan", phase: "pull" } },
    {
      id: "top",
      guide: 2,
      set: supine(rowHigh),
      hold: 350,
      face: "effort",
      move: { ms: 320, curve: "reception", phase: "pull" },
    },
    { id: "lowering", guide: 3, set: supine(rowHalf), still: true, move: { ms: 550, curve: "elan", phase: "lower" } },
    {
      id: "lowering-end",
      set: supine((rowHalf + rowLow.elevation) / 2),
      move: { ms: 300, curve: "linear", phase: "lower" },
    },
  ],
  props: () => pullBar(ROW_HAND.x, ROW_BAR + 2, 120),
  views: ["side", "front"],
});
