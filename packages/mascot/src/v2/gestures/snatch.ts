// L'arraché : Malo, l'athlète de l'haltérophilie. La barre suit une trajectoire donnée, proche du corps, et le
// corps s'organise autour d'elle : bras tendus pendant les deux tirées, puis sous la barre, puis debout.
// Repères techniques : départ barre au-dessus de l'avant-pied, épaules à l'aplomb ou un peu en avant, dos cambré
// et gainé (Everett, 2018) ; première tirée jusqu'aux genoux, transition genoux sous la barre, seconde tirée
// explosive, passage sous la barre jusqu'au point haut de la barre, réception, redressement (Harbili et
// Alptekin, 2014 ; Gourgoulis et al., 2000). La barre recule vers l'athlète en première tirée, repart un peu
// vers l'avant, puis revient à la réception : une courbe en S, de faible amplitude (Everett, 2014).
// Les positions et les enchaînements sont exportés : les variantes de l'arraché (en puissance, en suspension,
// tirage, soulevé de terre, équilibre) les reprennent (variants.ts, pulls.ts, overhead.ts).
import { gesture, type KeyDraft } from "../gesture";
import { elbows, heels, STAND, stance, type ControlPatch } from "../pose";
import { barAtArmsLength, type Rig } from "../solve";

// Prise large : debout, bras tendus, la barre arrive au pli de l'aine.
export const SNATCH_GRIP = 102;
export const SNATCH_RIG: Rig = { bar: { grip: SNATCH_GRIP, hold: "hands" } };

// Les pieds du tirage, sous les hanches ; ceux de la réception, plus écartés et plus ouverts.
export const pulling = stance(24, 15, 13);
export const receiving = stance(46, 27, 12.3);
export const between = stance(36, 21, 12.7);

// Coudes tournés vers l'extérieur, au-dessus de la barre.
export const snatchBase: ControlPatch = { ...pulling, ...elbows(-0.3, 0.2, 1), armsLong: 1 };

// Bras tendus au-dessus de la tête : les coudes verrouillés vers l'arrière, les poignets cassés, les épaules actives.
export const locked: ControlPatch = { ...receiving, ...elbows(-0.6, -0.3, 1), wrist: 40, shrug: 0.6 };

// La hauteur de la barre tenue bras tendus. `pelvisY` absent : jambes tendues, ce sont elles qui fixent la hauteur
// du corps ; donné, le bassin est à cette hauteur (une réception en flexion partielle).
export const snatchArmsLength = (patch: ControlPatch, above: boolean) =>
  barAtArmsLength({ ...STAND, ...snatchBase, pelvisY: 999, ...patch }, SNATCH_GRIP, above);
const armsLength = (patch: ControlPatch, above: boolean) =>
  barAtArmsLength({ ...STAND, ...snatchBase, ...patch, pelvisY: 999 }, SNATCH_GRIP, above);

export const snatchStart: ControlPatch = {
  barX: 13,
  barY: 41,
  pelvisX: -46,
  pelvisPitch: 55,
  lumbar: -4,
  thoracic: -3,
  neck: -32,
  head: -6,
};
export const snatchKnees: ControlPatch = {
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
export const snatchPower: ControlPatch = {
  barX: 9,
  barY: 140,
  pelvisX: -16,
  pelvisPitch: 14,
  lumbar: -2,
  thoracic: -2,
  neck: -8,
};

// Chevilles, genoux et hanches tendus, épaules haussées, bras encore longs.
const extended: ControlPatch = {
  barX: 11,
  pelvisX: -7,
  pelvisPitch: -5,
  lumbar: -3,
  thoracic: -2,
  neck: 4,
  shrug: 1,
  ...heels(35),
};
// La barre monte encore après l'extension, puis redescend un peu jusqu'à la réception : ces hauteurs se comptent
// depuis celle de l'extension.
export const SNATCH_TOP = armsLength(extended, false);
export const snatchExtension: ControlPatch = { ...extended, barY: SNATCH_TOP };
const TOP = SNATCH_TOP;

// Le corps commence à descendre : les coudes montent, hauts et vers l'extérieur, la barre reste contre le buste.
export const snatchHighPull: ControlPatch = {
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
  ...elbows(-0.3, 0.9, 1),
  ...heels(22),
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
  ...elbows(-0.2, -0.3, 1),
  wrist: 15,
  ...heels(12),
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
// La réception en flexion complète, bras verrouillés : la position basse du squat bras tendus.
export const snatchReceive: ControlPatch = {
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
export const snatchRising: ControlPatch = {
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
export const snatchOverhead: ControlPatch = { ...upright, barY: armsLength(upright, true) };
const lowering: ControlPatch = {
  ...between,
  barX: 32,
  barY: 300,
  pelvisX: -10,
  pelvisY: 999,
  pelvisPitch: 0,
  neck: 4,
  armsLong: 0,
  ...elbows(0.8, -0.2, 1),
  footRLift: 3,
  footLLift: 3,
};
// En redescendant, les coudes passent au-dessus de la barre, comme à la montée.
const hanging: ControlPatch = { barX: 13, pelvisX: -10, pelvisPitch: 2, ...elbows(0, 0.8, 1) };
// Debout, la barre tenue bras tendus contre le haut des cuisses.
export const snatchHips: ControlPatch = { ...hanging, barY: armsLength(hanging, false) };

// Une ligne du guide, si la variante en donne une à cette position.
export const line = (guide: number | undefined) => (guide !== undefined ? { guide } : {});

// Le départ au sol.
export const snatchStartKey = (guide: number | undefined, ms: number): KeyDraft => ({
  id: "start",
  ...line(guide),
  set: snatchStart,
  hold: 800,
  move: { ms, curve: "reception", phase: "return" },
});

// La première tirée et la transition : du sol au haut des cuisses.
export const snatchFirstPull = (lines: { knees?: number; power?: number } = {}): KeyDraft[] => [
  {
    id: "knees",
    ...line(lines.knees),
    set: snatchKnees,
    face: "effort",
    still: true,
    move: { ms: 700, curve: "elan", phase: "first-pull" },
  },
  {
    id: "power",
    ...line(lines.power),
    set: snatchPower,
    face: "effort",
    still: true,
    move: { ms: 240, curve: "linear", phase: "transition" },
  },
];

// La seconde tirée : jusqu'à l'extension, sur l'avant-pied.
export const snatchSecondPull = (guide?: number): KeyDraft => ({
  id: "extension",
  ...line(guide),
  set: snatchExtension,
  face: "effort",
  still: true,
  move: { ms: 160, curve: "elan", phase: "second-pull" },
});

// Le passage sous la barre et la réception en flexion complète, puis le redressement.
export const snatchSquatCatch = (lines: { receive?: number; overhead?: number } = {}): KeyDraft[] => [
  {
    id: "high-pull",
    set: snatchHighPull,
    face: "effort",
    still: true,
    move: { ms: 120, curve: "linear", phase: "turnover" },
  },
  {
    id: "top",
    set: under,
    face: "effort",
    air: ["R", "L"],
    still: true,
    move: { ms: 160, curve: "linear", phase: "turnover" },
  },
  { id: "lockout", set: lockout, face: "effort", move: { ms: 160, curve: "linear", phase: "catch" } },
  {
    id: "receive",
    ...line(lines.receive),
    set: snatchReceive,
    hold: 400,
    face: "effort",
    move: { ms: 320, curve: "reception", phase: "catch" },
  },
  { id: "rising", set: snatchRising, face: "effort", move: { ms: 560, curve: "elan", phase: "recovery" } },
  {
    id: "overhead",
    ...line(lines.overhead),
    set: snatchOverhead,
    hold: 800,
    face: "joy",
    move: { ms: 620, curve: "reception", phase: "recovery" },
  },
];

// La barre redescend de bras tendus au-dessus de la tête jusqu'aux hanches : hors technique.
export const snatchLowerToHips = (): KeyDraft[] => [
  { id: "lowering", set: lowering, air: ["R", "L"], move: { ms: 450, curve: "elan", phase: "return" } },
  { id: "hang", set: snatchHips, move: { ms: 350, curve: "linear", phase: "return" } },
];
// Puis des hanches au sol, par les genoux.
export const snatchKneesReturn = (): KeyDraft => ({
  id: "knees-return",
  set: snatchKnees,
  move: { ms: 480, curve: "linear", phase: "return" },
});

export { lockout as snatchLockout, lowering as snatchLowering, under as snatchUnder };

export const snatch = gesture({
  key: "snatch",
  athlete: "poleVault",
  rig: SNATCH_RIG,
  base: snatchBase,
  keys: [
    snatchStartKey(0, 520),
    ...snatchFirstPull(),
    snatchSecondPull(1),
    ...snatchSquatCatch({ receive: 2, overhead: 3 }),
    // La barre redescend pour que la boucle reparte : ce retour ne fait pas partie de la technique.
    ...snatchLowerToHips(),
    snatchKneesReturn(),
  ],
});
