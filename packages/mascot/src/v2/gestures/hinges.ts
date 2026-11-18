// Les gestes en charnière de hanche, barre en main ou sur le dos : Mehdi. La barre monte et descend à l'aplomb
// du milieu du pied, près des jambes ; le dos garde sa position, ce sont les hanches qui reculent.
// - Soulevé de terre : pieds à peu près à la largeur des épaules, barre au-dessus des pieds, tibias presque au
//   contact, dos plat, poitrine relevée ; on se redresse en avançant les hanches, on redescend en les reculant,
//   puis en fléchissant les genoux (ACE, « Deadlift »).
// - Rowing barre : buste penché depuis les hanches, dos plat, genoux légèrement fléchis ; la barre monte vers le
//   ventre, coudes près du corps, sans relever le buste ; descente lente jusqu'aux bras tendus (ACE, « Bent-Over
//   Row » ; Catalyst Athletics, « Bent Row »).
// Le soulevé de terre roumain, le sumo et le good morning suivent les mêmes principes ; leurs angles sont réglés
// à l'œil d'après les repères des fiches du catalogue.
import { gesture } from "../gesture";
import { elbows, STAND, stance, type ControlPatch } from "../pose";
import { barAtArmsLength, RACK, solve, type Rig } from "../solve";
import { along } from "../vec";

const ATHLETE = "discus" as const;

// Les mains juste à l'extérieur des jambes.
const GRIP = 52;
const RIG: Rig = { bar: { grip: GRIP, hold: "hands" } };
const hipWidth = stance(22, 10, 13);
// Bras longs, coudes tournés vers l'extérieur ; le bassin prend la hauteur qui laisse les mains sur la barre.
const pulling: ControlPatch = { ...hipWidth, ...elbows(-0.3, 0.2, 1), armsLong: 1 };

// La hauteur de la barre tenue bras tendus sous les épaules, le bassin à la hauteur donnée (ou jambes tendues).
const atArms = (base: ControlPatch, patch: ControlPatch, grip = GRIP) =>
  barAtArmsLength({ ...STAND, ...base, pelvisY: 999, ...patch }, grip, false);
const hanging = (base: ControlPatch, patch: ControlPatch, grip = GRIP): ControlPatch => ({
  ...patch,
  barY: atArms(base, patch, grip),
});

// --- Soulevé de terre -------------------------------------------------------------------------------------------

const dlStart: ControlPatch = {
  barX: 3,
  barY: 41,
  pelvisX: -52,
  pelvisPitch: 56,
  lumbar: -3,
  thoracic: -2,
  neck: -30,
  head: -6,
};
const dlKnees: ControlPatch = {
  barX: 2,
  barY: 96,
  pelvisX: -62,
  pelvisPitch: 52,
  lumbar: -3,
  thoracic: -2,
  neck: -28,
  head: -6,
};
const dlLockout = hanging(pulling, { barX: 8, pelvisX: -13, pelvisPitch: 0, neck: -4 });
// En redescendant, les hanches reculent d'abord, genoux presque tendus, jusqu'à ce que la barre passe les genoux.
const dlHinge: ControlPatch = {
  barX: 4,
  barY: 90,
  pelvisX: -66,
  pelvisPitch: 56,
  lumbar: -3,
  thoracic: -2,
  neck: -32,
  head: -6,
};

export const deadlift = gesture({
  key: "deadlift",
  athlete: ATHLETE,
  rig: RIG,
  base: pulling,
  keys: [
    { id: "start", guide: 0, set: dlStart, hold: 700, move: { ms: 900, curve: "reception", phase: "lower" } },
    {
      id: "knees",
      guide: 1,
      set: dlKnees,
      face: "effort",
      still: true,
      move: { ms: 650, curve: "elan", phase: "lift" },
    },
    {
      id: "lockout",
      guide: 2,
      set: dlLockout,
      hold: 600,
      face: "effort",
      move: { ms: 550, curve: "reception", phase: "lift" },
    },
    {
      id: "hips-back",
      set: { barX: 6, barY: 110, pelvisX: -46, pelvisPitch: 38, lumbar: -3, thoracic: -2, neck: -18, head: -4 },
      move: { ms: 500, curve: "elan", phase: "lower" },
    },
    { id: "hinge", guide: 3, set: dlHinge, still: true, move: { ms: 550, curve: "linear", phase: "lower" } },
  ],
});

// --- Soulevé de terre roumain -----------------------------------------------------------------------------------

// Debout, genoux légèrement fléchis : la barre à peine sous la hauteur bras tendus, jambes tendues.
const rdlStanding: ControlPatch = { barX: 10, pelvisX: -14, pelvisPitch: 3, neck: -4 };
rdlStanding.barY = atArms(pulling, rdlStanding) - 2;
const rdlHalf: ControlPatch = {
  barX: 7,
  barY: 126,
  pelvisX: -36,
  pelvisPitch: 30,
  lumbar: -3,
  thoracic: -2,
  neck: -22,
  head: -6,
};
// En bas : la barre juste sous les genoux, les hanches loin derrière, les tibias presque verticaux.
const rdlBottom: ControlPatch = {
  barX: 5,
  barY: 84,
  pelvisX: -74,
  pelvisPitch: 62,
  lumbar: -3,
  thoracic: -2,
  neck: -36,
  head: -6,
};

export const romanianDeadlift = gesture({
  key: "romanian-deadlift",
  athlete: ATHLETE,
  rig: RIG,
  base: pulling,
  keys: [
    { id: "standing", guide: 0, set: rdlStanding, hold: 700, move: { ms: 500, curve: "reception", phase: "up" } },
    { id: "descent", guide: 1, set: rdlHalf, still: true, move: { ms: 900, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: rdlBottom,
      hold: 250,
      face: "effort",
      move: { ms: 850, curve: "reception", phase: "down" },
    },
    {
      id: "ascent",
      guide: 3,
      set: rdlHalf,
      face: "effort",
      still: true,
      move: { ms: 500, curve: "elan", phase: "up" },
    },
  ],
});

// --- Soulevé de terre sumo --------------------------------------------------------------------------------------

// Pieds larges, pointes ouvertes, les genoux dans leur axe ; les mains entre les genoux, sous les épaules.
const SUMO_GRIP = 30;
const SUMO_RIG: Rig = { bar: { grip: SUMO_GRIP, hold: "hands" } };
const sumoBase: ControlPatch = { ...stance(64, 36, 12), ...elbows(-0.3, 0.2, 0.4), armsLong: 1 };
const sumoStart: ControlPatch = {
  barX: 3,
  barY: 41,
  pelvisX: -34,
  pelvisPitch: 36,
  lumbar: -3,
  thoracic: -2,
  neck: -20,
  head: -4,
};
const sumoKnees: ControlPatch = {
  barX: 3,
  barY: 98,
  pelvisX: -34,
  pelvisPitch: 26,
  lumbar: -2,
  thoracic: -2,
  neck: -14,
  head: -4,
};
const sumoLockout = hanging(sumoBase, { barX: 7, pelvisX: -12, pelvisPitch: 0, neck: -4 }, SUMO_GRIP);

export const sumoDeadlift = gesture({
  key: "sumo-deadlift",
  athlete: ATHLETE,
  rig: SUMO_RIG,
  base: sumoBase,
  keys: [
    { id: "start", guide: 0, set: sumoStart, hold: 700, move: { ms: 850, curve: "reception", phase: "lower" } },
    {
      id: "knees",
      guide: 1,
      set: sumoKnees,
      face: "effort",
      still: true,
      move: { ms: 700, curve: "elan", phase: "lift" },
    },
    {
      id: "lockout",
      guide: 2,
      set: sumoLockout,
      hold: 600,
      face: "effort",
      move: { ms: 500, curve: "reception", phase: "lift" },
    },
    {
      id: "knees-down",
      guide: 3,
      set: { ...sumoKnees, pelvisX: -38, pelvisPitch: 30 },
      still: true,
      move: { ms: 950, curve: "linear", phase: "lower" },
    },
  ],
});

// --- Good morning -----------------------------------------------------------------------------------------------

// La barre sur les trapèzes, comme au squat arrière ; elle suit le dos.
const BACK_RIG: Rig = { bar: { grip: 72, hold: "back" } };
const backBase: ControlPatch = { ...stance(30, 12, 13), ...elbows(-0.6, -1, 0.25), wrist: 25 };
// Le bassin se place pour que la barre soit à l'aplomb du milieu du pied, à `barX` près.
const onBack = (patch: ControlPatch, barX = 0): ControlPatch => {
  const rack = (pelvisX: number) => {
    const body = solve({ ...STAND, ...backBase, ...patch, pelvisX }, { bar: null });
    return along(body.neck, body.frames.thorax, -RACK.back, -RACK.drop, 0);
  };
  const pelvisX = barX - rack(0).x;
  const at = rack(pelvisX);
  return { ...patch, pelvisX, barX: at.x, barY: at.y };
};
// Genoux souples : le bassin un peu sous la hauteur jambes tendues.
const gmStanding = onBack({ pelvisY: 168.5, pelvisPitch: 3, neck: -4 }, -10);
const gmHalf = onBack({ pelvisY: 163.5, pelvisPitch: 38, lumbar: -2, neck: -18 }, 3);
const gmBottom = onBack({ pelvisY: 155, pelvisPitch: 70, lumbar: -3, thoracic: -2, neck: -34 }, 6);

export const goodMorning = gesture({
  key: "good-morning",
  athlete: ATHLETE,
  rig: BACK_RIG,
  base: backBase,
  keys: [
    { id: "standing", guide: 0, set: gmStanding, hold: 700, move: { ms: 500, curve: "reception", phase: "up" } },
    { id: "hinge", guide: 1, set: gmHalf, still: true, move: { ms: 800, curve: "elan", phase: "down" } },
    {
      id: "bottom",
      guide: 2,
      set: gmBottom,
      hold: 250,
      face: "effort",
      move: { ms: 800, curve: "reception", phase: "down" },
    },
    { id: "ascent", guide: 3, set: gmHalf, face: "effort", still: true, move: { ms: 500, curve: "elan", phase: "up" } },
  ],
});

// --- Rowing barre -----------------------------------------------------------------------------------------------

// Le buste penché, genoux fléchis : il ne bouge plus pendant le tirage. Les bras ne règlent plus le bassin.
const bentOver: ControlPatch = {
  pelvisX: -70,
  pelvisY: 160,
  pelvisPitch: 64,
  lumbar: -3,
  thoracic: -2,
  neck: -30,
  head: -6,
  armsLong: 0,
};
const rowHang: ControlPatch = (() => {
  const body = solve({ ...STAND, ...pulling, ...bentOver }, { bar: null });
  const patch = { ...bentOver, barX: body.arms.R.shoulder.x + 2 };
  return { ...patch, barY: barAtArmsLength({ ...STAND, ...pulling, ...patch }, GRIP, false) };
})();
// En haut, la barre touche le bas des côtes, coudes tirés vers l'arrière, près du corps.
const rowTop: ControlPatch = (() => {
  const body = solve({ ...STAND, ...pulling, ...bentOver }, { bar: null });
  const at = along(body.chest, body.frames.lumbar, 23, -6, 0);
  return { ...bentOver, barX: at.x, barY: at.y, ...elbows(-1, -0.1, 0.35) };
})();
const rowHalf: ControlPatch = {
  ...bentOver,
  barX: (rowHang.barX! + rowTop.barX!) / 2,
  barY: (rowHang.barY! + rowTop.barY!) / 2,
  ...elbows(-1, -0.1, 0.5),
};
const rowStanding = hanging(pulling, { barX: 9, pelvisX: -13, pelvisPitch: 0, neck: -4 });

export const barbellRow = gesture({
  key: "barbell-row",
  athlete: ATHLETE,
  rig: RIG,
  base: pulling,
  keys: [
    { id: "standing", guide: 0, set: rowStanding, hold: 600, move: { ms: 700, curve: "impulsion", phase: "return" } },
    { id: "set", guide: 1, set: rowHang, hold: 500, move: { ms: 750, curve: "impulsion", phase: "hinge" } },
    {
      id: "top",
      guide: 2,
      set: rowTop,
      hold: 300,
      face: "effort",
      move: { ms: 550, curve: "impulsion", phase: "pull" },
    },
    { id: "lowering", guide: 3, set: rowHalf, still: true, move: { ms: 500, curve: "elan", phase: "lower" } },
    { id: "hang", set: rowHang, hold: 400, move: { ms: 500, curve: "reception", phase: "lower" } },
  ],
});
