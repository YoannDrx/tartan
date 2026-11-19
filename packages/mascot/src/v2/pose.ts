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
  // Un pied : son avant-pied (x vers l'avant, z vers la droite, la hauteur d'un pied décollé), la pointe ouverte
  // vers l'extérieur, le pied couché sur son bord extérieur, le talon levé (le pied pivote sur l'avant-pied).
  "footRX",
  "footRZ",
  "footRLift",
  "footRYaw",
  "footRRoll",
  "footRHeel",
  "footLX",
  "footLZ",
  "footLLift",
  "footLYaw",
  "footLRoll",
  "footLHeel",
  // Le genou : tourné vers l'extérieur par rapport à l'axe du pied, puis la direction où il se plie, vers
  // l'avant, vers le haut et vers l'extérieur (debout : droit devant).
  "kneeROut",
  "kneeRForward",
  "kneeRUp",
  "kneeRSide",
  "kneeLOut",
  "kneeLForward",
  "kneeLUp",
  "kneeLSide",
  // Une main libre, par rapport à la base du cou : vers l'avant, vers le haut, vers l'extérieur.
  "handRForward",
  "handRUp",
  "handROut",
  "handLForward",
  "handLUp",
  "handLOut",
  // Une main posée : de 0 à 1, elle tient à un point fixe de la scène plutôt qu'au corps.
  "handRPin",
  "handRX",
  "handRY",
  "handRZ",
  "handLPin",
  "handLX",
  "handLY",
  "handLZ",
  // La direction du coude, dans le repère du buste : vers l'avant, vers le haut, vers l'extérieur.
  "elbowRForward",
  "elbowRUp",
  "elbowROut",
  "elbowLForward",
  "elbowLUp",
  "elbowLOut",
  // La barre : son milieu. Elle reste horizontale, en travers du corps.
  "barX",
  "barY",
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

// Les deux pieds, symétriques : `width` est le demi-écart des avant-pieds, `yaw` l'ouverture des pointes.
export const stance = (width: number, yaw: number, x = BALL_X): ControlPatch => ({
  footRX: x,
  footRZ: width,
  footRYaw: yaw,
  footLX: x,
  footLZ: -width,
  footLYaw: yaw,
});
// Les deux mains libres au même endroit, de part et d'autre du corps.
export const hands = (forward: number, up: number, out: number): ControlPatch => ({
  handRForward: forward,
  handRUp: up,
  handROut: out,
  handLForward: forward,
  handLUp: up,
  handLOut: out,
});
// Les deux coudes dans la même direction, en miroir.
export const elbows = (forward: number, up: number, out: number): ControlPatch => ({
  elbowRForward: forward,
  elbowRUp: up,
  elbowROut: out,
  elbowLForward: forward,
  elbowLUp: up,
  elbowLOut: out,
});
// Les deux talons levés du même angle.
export const heels = (angle: number): ControlPatch => ({ footRHeel: angle, footLHeel: angle });

// Debout, pieds sous les hanches, bras le long du corps. `pelvisY` très haut : le bassin se pose là où les
// jambes tendues le portent (voir gesture.ts).
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
  footRLift: 0,
  footRYaw: 8,
  footRRoll: 0,
  footRHeel: 0,
  footLX: BALL_X,
  footLZ: -20,
  footLLift: 0,
  footLYaw: 8,
  footLRoll: 0,
  footLHeel: 0,
  kneeROut: 0,
  kneeRForward: 1,
  kneeRUp: 0,
  kneeRSide: 0,
  kneeLOut: 0,
  kneeLForward: 1,
  kneeLUp: 0,
  kneeLSide: 0,
  barX: 0,
  barY: 160,
  handRForward: 6,
  handRUp: -126,
  handROut: 44,
  handLForward: 6,
  handLUp: -126,
  handLOut: 44,
  handRPin: 0,
  handRX: 0,
  handRY: 0,
  handRZ: 0,
  handLPin: 0,
  handLX: 0,
  handLY: 0,
  handLZ: 0,
  elbowRForward: -1,
  elbowRUp: 0,
  elbowROut: 0.4,
  elbowLForward: -1,
  elbowLUp: 0,
  elbowLOut: 0.4,
  wrist: 0,
  armsLong: 0,
};
