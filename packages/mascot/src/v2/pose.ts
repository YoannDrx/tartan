// Ce qu'une clé d'un geste décrit : où sont le bassin, les pieds, la barre et les mains, et comment la colonne se
// tient. Les genoux et les coudes ne se décrivent pas : la cinématique inverse les place à chaque image (solve.ts).
// Tout est un nombre, pour que chaque valeur s'interpole seule. Longueurs dans les unités du corps (body.ts),
// angles en degrés. Le sol est à y = 0, le milieu du pied d'un athlète debout à x = 0.
import { FIGURE } from "./body";

export const CHANNELS = [
  // Le bassin : sa position (le milieu des hanches), puis son inclinaison vers l'avant, sur le côté, et son pivot.
  "pelvisX",
  "pelvisY",
  "pelvisZ",
  "pelvisPitch",
  "pelvisRoll",
  "pelvisYaw",
  // La colonne en deux segments, le cou, la tête : chaque flexion par rapport au segment du dessous.
  "lumbar",
  "thoracic",
  "neck",
  "head",
  // Les épaules haussées, de 0 à 1.
  "shrug",
  // Un pied : son avant-pied au sol (x vers l'avant, z vers la droite), la pointe ouverte vers l'extérieur,
  // le talon levé (le pied pivote sur l'avant-pied), et la hauteur d'un pied en l'air.
  "footRX",
  "footRZ",
  "footRYaw",
  "footRHeel",
  "footRLift",
  "footLX",
  "footLZ",
  "footLYaw",
  "footLHeel",
  "footLLift",
  // Le genou, tourné vers l'extérieur par rapport à l'axe du pied.
  "kneeROut",
  "kneeLOut",
  // La barre : son milieu. Elle reste horizontale, en travers du corps.
  "barX",
  "barY",
  // Les mains libres, par rapport à la base du cou : vers l'avant, vers le haut, vers l'extérieur.
  "handForward",
  "handUp",
  "handOut",
  // La direction du coude, dans le repère du buste : vers l'avant, vers le haut, vers l'extérieur.
  "elbowForward",
  "elbowUp",
  "elbowOut",
  // Le poignet cassé vers l'arrière (extension).
  "wrist",
  // De 0 à 1 : les bras restent tendus, et c'est le bassin qui monte ou descend pour que les mains tiennent la barre.
  "armsLong",
] as const;
export type Channel = (typeof CHANNELS)[number];
export type Controls = Record<Channel, number>;
export type ControlPatch = Partial<Controls>;

const { foot } = FIGURE;

// Le milieu du pied est à x = 0 : l'avant-pied est donc en avant de la moitié de sa distance au talon.
export const BALL_X = (foot.ball + foot.heel) / 2 - (foot.toe - foot.ball) / 2;

// Debout, pieds sous les hanches, bras le long du corps. `pelvisY` très haut : le bassin se pose là où les
// jambes tendues le portent (voir `settle` dans gesture.ts).
export const STAND: Controls = {
  pelvisX: -8,
  pelvisY: 999,
  pelvisZ: 0,
  pelvisPitch: 2,
  pelvisRoll: 0,
  pelvisYaw: 0,
  lumbar: 0,
  thoracic: 0,
  neck: 0,
  head: 0,
  shrug: 0,
  footRX: BALL_X,
  footRZ: 20,
  footRYaw: 8,
  footRHeel: 0,
  footRLift: 0,
  footLX: BALL_X,
  footLZ: -20,
  footLYaw: 8,
  footLHeel: 0,
  footLLift: 0,
  kneeROut: 0,
  kneeLOut: 0,
  barX: 0,
  barY: 160,
  handForward: 6,
  handUp: -126,
  handOut: 44,
  elbowForward: -1,
  elbowUp: 0,
  elbowOut: 0.4,
  wrist: 0,
  armsLong: 0,
};

// Les deux pieds, symétriques : `width` est le demi-écart des avant-pieds, `yaw` l'ouverture des pointes.
export const stance = (width: number, yaw: number, x = BALL_X): ControlPatch => ({
  footRX: x,
  footRZ: width,
  footRYaw: yaw,
  footLX: x,
  footLZ: -width,
  footLYaw: yaw,
});
