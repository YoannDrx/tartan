// La mobilité, au sol ou en squat large : Lina (l'athlète de la longueur). Gestes lents, amplitudes modestes,
// appuis tenus : un genou posé reste à sa place, une main posée aussi ; c'est le bassin qui se déplace entre eux.
// - Transfert latéral en squat large : pieds écartés, pointes ouvertes ; le bassin passe d'un côté, la jambe de ce
//   côté fléchie talon au sol, l'autre allongée ; retour au centre, puis l'autre côté.
// - Recul du bassin pour les adducteurs : à quatre pattes, une jambe tendue sur le côté, pied au sol ; le bassin
//   recule vers le talon de la jambe fléchie, le dos stable, puis revient au-dessus des mains et du genou.
// - Mobilité des orteils : à genoux, orteils repliés sous les pieds, mains au sol ; le bassin recule vers les
//   talons, puis avance pour relâcher.
// - Rotation de hanche allongé sur le ventre : un genou fléchi, le pied vers le plafond ; le pied part vers
//   l'extérieur puis vers l'intérieur, le bassin au sol.
// Positions et rythmes réglés à l'œil d'après les fiches du catalogue : aucune source ouverte pour ces gestes.
import { FIGURE } from "../body";
import { gesture } from "../gesture";
import { span } from "../ik";
import { elbows, hands, STAND, type ControlPatch } from "../pose";
import { skin } from "../skin";
import { solve, type Side } from "../solve";
import { add, distance, scale, sub, vec, type Vec3 } from "../vec";
import { armSpan, pinned } from "./gym";

const ATHLETE = "longJump" as const;
const RIG = { bar: null };
const rad = (degrees: number) => (degrees * Math.PI) / 180;

// --- Transfert latéral en squat large -------------------------------------------------------------------------

const WIDE = 66;
const wide: ControlPatch = {
  footRX: 12,
  footRZ: WIDE,
  footRYaw: 24,
  footLX: 12,
  footLZ: -WIDE,
  footLYaw: 24,
  // Les mains jointes devant la poitrine.
  ...hands(27, -30, 3),
  ...elbows(0, -1, 0.8),
};
const shifted = (side: 1 | -1, depth: number): ControlPatch => {
  const [bent, long] = side > 0 ? (["R", "L"] as const) : (["L", "R"] as const);
  return {
    pelvisX: -16 - 32 * depth,
    pelvisY: 160 - 74 * depth,
    pelvisZ: side * (8 + 40 * depth),
    pelvisPitch: 10 + 22 * depth,
    lumbar: 3 * depth,
    neck: -6 - 14 * depth,
    [`knee${bent}Out`]: 30 * depth,
    [`knee${long}Out`]: 0,
  };
};

export const cossackMobility = gesture({
  key: "cossack-mobility",
  athlete: ATHLETE,
  rig: RIG,
  base: wide,
  keys: [
    {
      id: "center",
      guide: 0,
      set: { pelvisX: -12, pelvisY: 158, pelvisPitch: 8, neck: -4 },
      hold: 700,
      move: { ms: 800, curve: "reception", phase: "return" },
    },
    { id: "shift", guide: 1, set: shifted(1, 0.5), still: true, move: { ms: 900, curve: "elan", phase: "shift" } },
    {
      id: "low-right",
      guide: 2,
      set: shifted(1, 1),
      hold: 600,
      face: "effort",
      move: { ms: 900, curve: "reception", phase: "shift" },
    },
    {
      id: "middle",
      guide: 3,
      set: { pelvisX: -20, pelvisY: 136, pelvisPitch: 14, neck: -8 },
      still: true,
      move: { ms: 900, curve: "elan", phase: "return" },
    },
    {
      id: "low-left",
      set: shifted(-1, 1),
      hold: 600,
      face: "effort",
      move: { ms: 1100, curve: "reception", phase: "shift" },
    },
  ],
  views: ["front", "side"],
});

// --- Le corps sur les genoux et les mains ---------------------------------------------------------------------

// Les orteils repliés sous le pied, l'avant-pied au sol, le talon haut.
const TUCK = 72;
const KNEE_Y = 13.5;
// La cheville d'un pied dont l'avant-pied est au sol en x, talon levé de `heel` degrés.
const ankleAt = (x: number, heel: number) => ({
  x: x - FIGURE.foot.ball * Math.cos(rad(heel)) + FIGURE.ankle * Math.sin(rad(heel)),
  y: FIGURE.foot.ball * Math.sin(rad(heel)) + FIGURE.ankle * Math.cos(rad(heel)),
});
// Un genou posé en (x, z) : l'avant-pied derrière lui, sur la pointe, à la distance que donne le tibia.
const kneeling = (side: Side, knee: number, z: number): ControlPatch => {
  // L'avant-pied à `x` tel que la cheville soit à un tibia du genou posé.
  const probe = ankleAt(0, TUCK);
  const dy = probe.y - KNEE_Y;
  const back = Math.sqrt(FIGURE.shin ** 2 - dy * dy);
  const x = knee - back - probe.x;
  return {
    [`foot${side}X`]: x,
    [`foot${side}Z`]: z,
    [`foot${side}Yaw`]: 0,
    [`foot${side}Heel`]: TUCK,
    [`knee${side}Forward`]: 0.2,
    [`knee${side}Up`]: -1,
  };
};

// Le bassin dont la hanche `side` est à une cuisse du genou posé, la cuisse inclinée de `back` degrés vers
// l'arrière ; le buste se règle (bascule) pour que les épaules restent à portée des mains posées.
const onKnee = (knee: Vec3, back: number, hand: Vec3 | null, set: ControlPatch, side: Side = "L"): ControlPatch => {
  const hip = add(knee, scale(vec(-Math.sin(rad(back)), Math.cos(rad(back)), 0), FIGURE.thigh - 1));
  // Le genou reste posé : son pôle va du milieu de la corde hanche-cheville vers lui, pour chaque genou à terre.
  const poles: ControlPatch = {};
  for (const leg of ["R", "L"] as const) {
    const heel = set[`foot${leg}Heel`];
    if (heel !== TUCK) continue;
    const ankle = ankleAt(set[`foot${leg}X`] as number, TUCK);
    poles[`knee${leg}Forward`] = knee.x - (hip.x + ankle.x) / 2;
    poles[`knee${leg}Up`] = knee.y - (hip.y + ankle.y) / 2;
  }
  const at = (pitch: number) => {
    const patch: ControlPatch = { ...set, ...poles, pelvisPitch: pitch, pelvisX: 0, pelvisY: 400 };
    const body = solve({ ...STAND, ...patch }, RIG);
    const offset = sub(body.legs[side].hip, body.pelvis);
    const pelvis = sub(hip, offset);
    return { ...patch, pelvisX: pelvis.x, pelvisY: pelvis.y };
  };
  if (!hand) return at(set.pelvisPitch ?? 90);
  const reach = armSpan(3, set.wrist ?? 0);
  const gap = (pitch: number) => {
    const body = solve({ ...STAND, ...at(pitch) }, RIG);
    return distance(body.arms.R.shoulder, hand) - reach;
  };
  // Le buste bascule jusqu'à ce que les bras tendus touchent les mains posées.
  let [low, high] = [52, 100];
  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    if (gap(mid) > 0 === gap(low) > 0) low = mid;
    else high = mid;
  }
  return at((low + high) / 2);
};

// --- Recul du bassin pour les adducteurs ----------------------------------------------------------------------

const ROCK_KNEE = vec(0, KNEE_Y, -FIGURE.hip);
// La jambe droite tendue sur le côté, le pied à plat, pointe vers l'avant.
const sideLeg: ControlPatch = {
  footRX: 52,
  footRZ: 137,
  footRYaw: 0,
  footRRoll: -14,
  footRLift: 1.5,
  kneeRForward: 1,
  kneeRUp: 0,
};
const quadArms: ControlPatch = { ...elbows(-1, 0, 0.3), wrist: -50 };
const ROCK_HAND = (() => {
  const body = solve(
    {
      ...STAND,
      ...onKnee(ROCK_KNEE, 0, null, { ...quadArms, ...kneeling("L", 0, -FIGURE.hip), ...sideLeg, pelvisPitch: 68 }),
    },
    RIG,
  );
  return vec(body.arms.R.shoulder.x + 4, 10, FIGURE.shoulder + 2);
})();
const rocked = (back: number) =>
  onKnee(ROCK_KNEE, back, ROCK_HAND, {
    ...quadArms,
    ...pinned(ROCK_HAND),
    ...kneeling("L", 0, -FIGURE.hip),
    ...sideLeg,
    neck: -14,
  });

export const adductorRockback = gesture({
  key: "adductor-rockback",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    { id: "quadruped", guide: 0, set: rocked(0), hold: 800, move: { ms: 1000, curve: "reception", phase: "forward" } },
    { id: "rocking", guide: 1, set: rocked(16), still: true, move: { ms: 900, curve: "elan", phase: "back" } },
    {
      id: "back",
      guide: 2,
      set: rocked(30),
      hold: 900,
      face: "effort",
      move: { ms: 900, curve: "reception", phase: "back" },
    },
    { id: "return", guide: 3, set: rocked(16), still: true, move: { ms: 800, curve: "elan", phase: "forward" } },
  ],
});

// --- Mobilité des orteils -------------------------------------------------------------------------------------

const TOE_KNEE = vec(0, KNEE_Y, -FIGURE.hip);
const bothKnees: ControlPatch = { ...kneeling("L", 0, -FIGURE.hip), ...kneeling("R", 0, FIGURE.hip) };
const TOE_HAND = vec(70, 10, FIGURE.shoulder + 2);
const toeRock = (back: number) =>
  onKnee(TOE_KNEE, back, TOE_HAND, { ...quadArms, ...pinned(TOE_HAND), ...bothKnees, neck: -16 });

export const toeExtensionRock = gesture({
  key: "toe-extension-rock",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    { id: "kneeling", guide: 0, set: toeRock(6), hold: 800, move: { ms: 1000, curve: "reception", phase: "forward" } },
    { id: "rocking", guide: 1, set: toeRock(26), still: true, move: { ms: 900, curve: "elan", phase: "back" } },
    {
      id: "back",
      guide: 2,
      set: toeRock(40),
      hold: 900,
      face: "effort",
      move: { ms: 900, curve: "reception", phase: "back" },
    },
    { id: "release", guide: 3, set: toeRock(16), still: true, move: { ms: 800, curve: "elan", phase: "forward" } },
  ],
});

// --- Rotation de hanche allongé sur le ventre -----------------------------------------------------------------

// Couché sur le ventre, en appui sur les avant-bras, la tête vers +x ; le dessus des pieds au sol.
const PRONE_Y = 21;
const proneBase: ControlPatch = {
  pelvisX: 0,
  pelvisY: PRONE_Y,
  pelvisPitch: 90,
  lumbar: -12,
  thoracic: -10,
  neck: -16,
  ...elbows(1, -0.3, 0.3),
};
const PRONE = solve({ ...STAND, ...proneBase, footRLift: 999, footLLift: 999 }, RIG);
// Les avant-bras au sol, les coudes sous les épaules.
const forearm = (side: Side) => {
  const shoulder = PRONE.arms[side].shoulder;
  // Le coude au sol, aussi près que le bras le permet de l'aplomb de l'épaule ; la main devant lui.
  const drop = shoulder.y - 9.5;
  const ahead = Math.sqrt(Math.max(0, FIGURE.upperArm ** 2 - drop * drop));
  return vec(shoulder.x + ahead + FIGURE.forearm + FIGURE.hand - 2, 9.5, shoulder.z * 1.1);
};
// La jambe tendue, le pied sur la pointe, orteils au sol, perpendiculaire au tibia.
const lyingFoot = (side: Side): ControlPatch => {
  const hip = PRONE.legs[side].hip;
  const ankleY = FIGURE.foot.ball;
  const reach = span(FIGURE.thigh, FIGURE.shin, 4);
  const ankle = vec(hip.x - Math.sqrt(reach * reach - (hip.y - ankleY) ** 2), ankleY, hip.z);
  return {
    [`foot${side}X`]: ankle.x - FIGURE.ankle,
    [`foot${side}Z`]: hip.z,
    [`foot${side}Lift`]: 0,
    [`foot${side}Yaw`]: 0,
    [`foot${side}Heel`]: 90,
    [`knee${side}Forward`]: 0,
    [`knee${side}Up`]: -1,
  };
};
// La jambe droite, genou fléchi, le pied vers le plafond, incliné de `turn` degrés vers l'extérieur.
const raised = (turn: number): ControlPatch => {
  const hip = PRONE.legs.R.hip;
  const knee = add(hip, vec(-FIGURE.thigh + 1, -(hip.y - KNEE_Y), 0));
  const t = rad(turn);
  const ankle = add(knee, vec(0, FIGURE.shin * Math.cos(t), FIGURE.shin * Math.sin(t)));
  // Le pied ne tourne pas avec le tibia : il garde son orientation, la plante vers le plafond.
  const ball = add(ankle, vec(-FIGURE.foot.ball, FIGURE.ankle, 0));
  return {
    footRX: ball.x,
    footRZ: ball.z,
    footRLift: ball.y,
    footRYaw: 0,
    footRHeel: 180,
    footRRoll: 0,
    // Le genou reste posé : le pôle va du milieu de la corde hanche-cheville vers lui.
    kneeRForward: knee.x - (hip.x + ankle.x) / 2,
    kneeRUp: knee.y - (hip.y + ankle.y) / 2,
    kneeRSide: knee.z - (hip.z + ankle.z) / 2,
  };
};
const proneArms: ControlPatch = { ...pinned(forearm("R")), wrist: 0 };
const prone = (turn: number): ControlPatch => ({ ...proneBase, ...proneArms, ...lyingFoot("L"), ...raised(turn) });

export const proneHipRotation = gesture({
  key: "prone-hip-rotation",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    {
      id: "center",
      guide: 0,
      set: prone(0),
      hold: 800,
      air: ["R"],
      move: { ms: 450, curve: "reception", phase: "return" },
    },
    { id: "opening", set: prone(16), air: ["R"], move: { ms: 550, curve: "elan", phase: "outward" } },
    {
      id: "out",
      guide: 1,
      set: prone(30),
      hold: 500,
      air: ["R"],
      move: { ms: 550, curve: "reception", phase: "outward" },
    },
    { id: "closing", set: prone(15), air: ["R"], move: { ms: 450, curve: "elan", phase: "inward" } },
    {
      id: "through",
      guide: 2,
      set: prone(0),
      still: true,
      air: ["R"],
      move: { ms: 450, curve: "linear", phase: "inward" },
    },
    { id: "crossing", set: prone(-15), air: ["R"], move: { ms: 450, curve: "linear", phase: "inward" } },
    {
      id: "in",
      guide: 3,
      set: prone(-30),
      hold: 500,
      air: ["R"],
      move: { ms: 450, curve: "reception", phase: "inward" },
    },
    { id: "back-in", set: prone(-15), air: ["R"], move: { ms: 450, curve: "elan", phase: "return" } },
  ],
  views: ["top", "side"],
});

// --- Mobilité des hanches (90/90) -----------------------------------------------------------------------------

// Assis au sol, buste un peu en arrière, les mains posées derrière ; les pieds à plat, écartés, ne bougent pas :
// les genoux basculent ensemble d'un côté, repassent par le centre, puis basculent de l'autre, en essuie-glace.
const SEAT: ControlPatch = {
  pelvisX: 0,
  pelvisY: 19,
  pelvisPitch: -22,
  lumbar: 6,
  thoracic: 6,
  neck: 8,
  footRX: 92,
  footRZ: 46,
  footRYaw: 0,
  footLX: 92,
  footLZ: -46,
  footLYaw: 0,
  ...elbows(-1, 0, 0.5),
  wrist: -40,
};
const SEATED = solve({ ...STAND, ...SEAT, kneeRForward: 0, kneeRUp: 1, kneeLForward: 0, kneeLUp: 1 }, RIG);
const SEAT_HAND = vec(SEATED.arms.R.shoulder.x - 56, 10, FIGURE.shoulder + 10);
// Les genoux basculent de `tilt` degrés vers la droite (négatif : vers la gauche), autour de l'axe hanche-cheville.
const wiper = (tilt: number): ControlPatch => {
  const t = rad(tilt);
  const pole = (side: Side): ControlPatch => ({
    [`knee${side}Forward`]: 0,
    [`knee${side}Up`]: Math.cos(t),
    [`knee${side}Side`]: (side === "R" ? 1 : -1) * Math.sin(t),
  });
  return { ...SEAT, ...pinned(SEAT_HAND), ...pole("R"), ...pole("L") };
};

export const hip9090 = gesture({
  key: "hip-90-90",
  athlete: ATHLETE,
  rig: RIG,
  keys: [
    { id: "center", guide: 0, set: wiper(0), hold: 700, move: { ms: 900, curve: "reception", phase: "return" } },
    { id: "right", guide: 1, set: wiper(42), hold: 700, move: { ms: 1100, curve: "impulsion", phase: "switch" } },
    { id: "through", guide: 2, set: wiper(0), still: true, move: { ms: 1000, curve: "elan", phase: "switch" } },
    { id: "left", guide: 3, set: wiper(-42), hold: 700, move: { ms: 1000, curve: "reception", phase: "switch" } },
  ],
  views: ["front", "side"],
});
