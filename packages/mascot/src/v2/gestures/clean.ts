// L'épaulé : Malo. Le même tirage que l'arraché, prise plus serrée, puis les coudes tournent autour de la barre
// et les épaules viennent la chercher : elle ne « saute » pas, elle est reçue haut et accompagnée jusqu'en bas.
// Repères techniques : la barre monte près des tibias puis des cuisses, le dos garde son angle jusqu'aux genoux,
// les coudes passent autour de la barre et arrivent vite, hauts vers l'avant ; la barre se pose dans le creux
// entre le haut des épaules et la gorge, mains un peu à l'extérieur des épaules ; la remontée garde hanches et
// épaules ensemble (Everett, « The Clean: Part 2 », 2007 ; « The Clean and Jerk Rack Positions », 2014).
import { gesture, type KeyDraft } from "../gesture";
import { elbows, heels, STAND, stance, type ControlPatch } from "../pose";
import { barAtArmsLength, solve, type Rig } from "../solve";
import { along } from "../vec";

// Les mains un peu à l'extérieur des épaules.
export const CLEAN_GRIP = 50;
export const CLEAN_RIG: Rig = { bar: { grip: CLEAN_GRIP, hold: "hands" } };

// Les pieds du tirage, sous les hanches ; ceux de la réception, plus écartés et plus ouverts.
export const pulling = stance(24, 15, 13);
export const receiving = stance(46, 27, 12.3);
export const between = stance(36, 21, 12.7);

// Coudes tournés vers l'extérieur, au-dessus de la barre, bras longs.
export const cleanBase: ControlPatch = { ...pulling, ...elbows(-0.3, 0.2, 1), armsLong: 1 };

// La barre sur les épaules : coudes hauts vers l'avant, poignets cassés, épaules relevées et avancées.
export const rackArms: ControlPatch = { ...elbows(1, 0.3, 0.25), wrist: 65, shrug: 0.5, armsLong: 0 };

// Où la barre repose, depuis la base du cou : dans le creux entre le haut des épaules et la gorge.
const RACK = { forward: 18, up: 0 };
export const rackPoint = (patch: ControlPatch) => {
  const body = solve({ ...STAND, ...cleanBase, ...patch }, { bar: null });
  return along(body.neck, body.frames.thorax, RACK.forward, RACK.up, 0);
};
// Une position où la barre est sur les épaules : elle est là où le corps la porte.
export const racked = (patch: ControlPatch): ControlPatch => {
  const at = rackPoint({ ...rackArms, ...patch });
  return { ...rackArms, ...patch, barX: at.x, barY: at.y };
};
// La hauteur de la barre tenue bras tendus par le corps décrit, au-dessus ou en dessous des épaules.
export const armsLength = (patch: ControlPatch, above: boolean) =>
  barAtArmsLength({ ...STAND, ...cleanBase, ...patch }, CLEAN_GRIP, above);

export const cleanStart: ControlPatch = {
  barX: 13,
  barY: 41,
  pelvisX: -44,
  pelvisPitch: 49,
  lumbar: -4,
  thoracic: -3,
  neck: -28,
  head: -6,
};
export const cleanKnees: ControlPatch = {
  barX: 5,
  barY: 90,
  pelvisX: -64,
  pelvisPitch: 54,
  lumbar: -4,
  thoracic: -3,
  neck: -30,
  head: -6,
};
// Les genoux reviennent sous la barre, le buste se redresse : la barre arrive à mi-cuisse.
export const cleanPower: ControlPatch = {
  barX: 9,
  barY: 124,
  pelvisX: -15,
  pelvisPitch: 14,
  lumbar: -2,
  thoracic: -2,
  neck: -8,
};

// Chevilles, genoux et hanches tendus, épaules haussées, bras encore longs.
const extended: ControlPatch = {
  barX: 11,
  pelvisX: -7,
  pelvisY: 999,
  pelvisPitch: -5,
  lumbar: -3,
  thoracic: -2,
  neck: 4,
  shrug: 1,
  ...heels(35),
};
export const CLEAN_TOP = armsLength(extended, false);
const TOP = CLEAN_TOP;
export const cleanExtension: ControlPatch = { ...extended, barY: TOP };

// Le corps commence à descendre : les coudes montent, hauts et vers l'extérieur, la barre reste contre le buste.
export const cleanHighPull: ControlPatch = {
  barX: 10,
  barY: TOP + 22,
  pelvisX: -12,
  pelvisY: 166,
  pelvisPitch: -4,
  lumbar: -2,
  thoracic: -2,
  neck: 2,
  shrug: 1,
  armsLong: 0,
  ...elbows(-0.3, 0.9, 1),
  ...heels(22),
};
// Le point haut de la barre : les pieds se déplacent, les coudes commencent à tourner autour d'elle.
export const cleanTop: ControlPatch = {
  ...between,
  barX: 8,
  barY: TOP + 31,
  pelvisX: -22,
  pelvisY: 126,
  pelvisPitch: 4,
  lumbar: 2,
  neck: -6,
  shrug: 0.8,
  armsLong: 0,
  ...elbows(0.5, 0.2, 0.9),
  wrist: 30,
  ...heels(12),
  footRLift: 4,
  footLLift: 4,
};
// Les épaules rencontrent la barre à mi-hauteur, coudes déjà devant : elle est reçue, pas lâchée.
export const cleanMeet = racked({
  ...receiving,
  pelvisX: -31,
  pelvisY: 92,
  pelvisPitch: 13,
  lumbar: 4,
  thoracic: -2,
  neck: -12,
});
export const cleanBottom = racked({
  ...receiving,
  pelvisX: -37,
  pelvisY: 46,
  pelvisPitch: 11,
  lumbar: 8,
  thoracic: -3,
  neck: -12,
});
// À mi-hauteur, hanches et épaules montent ensemble, coudes toujours hauts.
export const cleanRising = racked({
  ...receiving,
  pelvisX: -33,
  pelvisY: 112,
  pelvisPitch: 13,
  lumbar: 4,
  thoracic: -2,
  neck: -12,
});
export const cleanStanding = racked({ ...receiving, pelvisX: -17, pelvisY: 999, pelvisPitch: 2, neck: -8 });

const line = (guide: number | undefined) => (guide !== undefined ? { guide } : {});

// La première tirée et la transition : du sol au milieu des cuisses.
export const cleanFirstPull = (lines: { knees?: number; power?: number } = {}): KeyDraft[] => [
  {
    id: "knees",
    ...line(lines.knees),
    set: cleanKnees,
    face: "effort",
    still: true,
    move: { ms: 700, curve: "elan", phase: "first-pull" },
  },
  {
    id: "power",
    ...line(lines.power),
    set: cleanPower,
    face: "effort",
    still: true,
    move: { ms: 240, curve: "linear", phase: "transition" },
  },
];
// La seconde tirée : jusqu'à l'extension, sur l'avant-pied.
export const cleanSecondPull = (guide?: number): KeyDraft => ({
  id: "extension",
  set: cleanExtension,
  face: "effort",
  still: true,
  ...line(guide),
  move: { ms: 160, curve: "elan", phase: "second-pull" },
});
// Les coudes montent, puis le point haut de la barre, les pieds en l'air.
export const cleanTurnover = (guide?: number): KeyDraft[] => [
  {
    id: "high-pull",
    set: cleanHighPull,
    face: "effort",
    still: true,
    move: { ms: 110, curve: "linear", phase: "turnover" },
  },
  {
    id: "top",
    ...line(guide),
    set: cleanTop,
    face: "effort",
    air: ["R", "L"],
    still: true,
    move: { ms: 130, curve: "linear", phase: "turnover" },
  },
];
// La réception en flexion complète, puis le redressement jusqu'à la station debout, la barre sur les épaules.
export const cleanSquatCatch = (lines: { receive?: number; standing?: number }, standingHold: number): KeyDraft[] => [
  { id: "meet", set: cleanMeet, face: "effort", still: true, move: { ms: 150, curve: "linear", phase: "catch" } },
  {
    id: "receive",
    set: cleanBottom,
    hold: 400,
    face: "effort",
    ...line(lines.receive),
    move: { ms: 340, curve: "reception", phase: "catch" },
  },
  { id: "rising", set: cleanRising, face: "effort", move: { ms: 560, curve: "elan", phase: "recovery" } },
  {
    id: "racked",
    set: cleanStanding,
    hold: standingHold,
    ...line(lines.standing),
    move: { ms: 620, curve: "reception", phase: "recovery" },
  },
];

// Le tirage et la réception, communs à l'épaulé et à l'épaulé-jeté : du sol à debout, la barre sur les épaules.
// `lines` : la ligne du guide que l'extension, la réception et la station debout illustrent.
export const cleanKeys = (
  lines: { extension?: number; receive?: number; standing?: number },
  standingHold: number,
): KeyDraft[] => [
  ...cleanFirstPull(),
  cleanSecondPull(lines.extension),
  ...cleanTurnover(),
  ...cleanSquatCatch(lines, standingHold),
];

// Le départ, et le retour de la barre au sol depuis les hanches : il referme la boucle, hors technique.
export const startKey = (guide: number | undefined, ms: number): KeyDraft => ({
  id: "start",
  set: cleanStart,
  hold: 800,
  ...line(guide),
  move: { ms, curve: "reception", phase: "return" },
});
export const cleanHanging: ControlPatch = {
  barX: 13,
  pelvisX: -10,
  pelvisY: 999,
  pelvisPitch: 2,
  ...elbows(0, 0.8, 1),
};
// Debout, la barre tenue bras tendus contre le haut des cuisses.
export const cleanHips: ControlPatch = { ...cleanHanging, barY: armsLength(cleanHanging, false) };
// La barre quitte les épaules et redescend jusqu'aux hanches.
export const cleanLowerToHips = (): KeyDraft[] => [
  {
    // Les coudes redescendent, la barre quitte les épaules ; les pieds reviennent sous les hanches.
    id: "lowering",
    set: {
      ...between,
      barX: 14,
      barY: cleanHips.barY! + 48,
      pelvisX: -12,
      pelvisY: 999,
      pelvisPitch: 0,
      armsLong: 0,
      ...elbows(-0.2, 0.7, 1),
      footRLift: 3,
      footLLift: 3,
    },
    air: ["R", "L"],
    move: { ms: 420, curve: "elan", phase: "return" },
  },
  { id: "hang", set: cleanHips, move: { ms: 300, curve: "linear", phase: "return" } },
];
export const cleanKneesReturn = (): KeyDraft => ({
  id: "knees-return",
  set: cleanKnees,
  move: { ms: 480, curve: "linear", phase: "return" },
});
export const returnKeys = (): KeyDraft[] => [...cleanLowerToHips(), cleanKneesReturn()];

export const clean = gesture({
  key: "clean",
  athlete: "poleVault",
  rig: CLEAN_RIG,
  base: cleanBase,
  keys: [startKey(0, 520), ...cleanKeys({ extension: 1, receive: 2, standing: 3 }, 800), ...returnKeys()],
});
