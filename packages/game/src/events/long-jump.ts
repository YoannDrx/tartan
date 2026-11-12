import { clamp, idiv, scale } from "../core/int";
import { rngNext, rngSeed } from "../core/rng";
import { type SimState, defineEvent } from "../core/sim";

// Saut en longueur. Des appuis brefs et rapides donnent l'élan ; un appui tenu devient l'appel : l'angle monte
// tant qu'on tient, et le relâcher lance le saut à l'endroit où l'on est. Au-delà de la planche, l'essai est mordu.
// L'élan se perd pendant qu'on tient : prendre de l'angle coûte de la vitesse, tout l'art est là.
//
// Unités, toutes entières :
//   position : 1/120 mm (un pas à v mm/s avance de v unités ; 40 m = 4 800 000)
//   vitesse  : mm/s
//   angle    : degrés
//   vent     : dm/s (+12 = +1,2 m/s)

export const UNITS_PER_MM = 120;
export const BOARD_X = 40_000 * UNITS_PER_MM;
// Courir plus d'un mètre au-delà de la planche sans sauter, c'est un essai mordu.
const RUN_THROUGH_X = BOARD_X + 1_000 * UNITS_PER_MM;
// Sans appel au bout de 20 s, l'essai est perdu.
export const RUN_LIMIT_TICKS = 2_400;

// L'élan : chaque appui bref ajoute de la vitesse, le frottement en reprend un peu à chaque pas. Pendant l'appel,
// le frottement est quatre fois moindre : les derniers appuis tiennent la vitesse.
export const TAP_GAIN = 800;
export const MAX_SPEED = 11_000;
const DRAG_NUM = 14;
const DRAG_DEN = 4_096;

// Un appui tenu plus de 10 pas (83 ms) devient l'appel ; l'angle monte d'un degré tous les deux pas.
export const TAP_MAX = 10;
export const MAX_ANGLE = 60;
export const angleOf = (hold: number): number => clamp(idiv(hold, 2), 0, MAX_ANGLE);

// Un appel en hauteur freine : chaque degré coûte 0,4 % de la vitesse.
const ANGLE_COST = 4;
const WIND_GAIN = 10;
export const MAX_WIND = 20;
const GRAVITY = 9_810;
// La réception, jambes devant, ajoute ce qu'un saut de pur projectile ne compte pas.
const LANDING_MM = 400;
// Le sable commence un mètre après la planche : retomber avant, c'est un essai nul.
export const PIT_START_MM = 1_000;

// Sinus et cosinus de 0 à 60°, en dix-millièmes, figés ici : Math.sin varie d'un moteur à l'autre.
const SIN = [
  0, 175, 349, 523, 698, 872, 1045, 1219, 1392, 1564, 1736, 1908, 2079, 2250, 2419, 2588, 2756, 2924, 3090, 3256, 3420,
  3584, 3746, 3907, 4067, 4226, 4384, 4540, 4695, 4848, 5000, 5150, 5299, 5446, 5592, 5736, 5878, 6018, 6157, 6293,
  6428, 6561, 6691, 6820, 6947, 7071, 7193, 7314, 7431, 7547, 7660, 7771, 7880, 7986, 8090, 8192, 8290, 8387, 8480,
  8572, 8660,
];
const COS = [
  10000, 9998, 9994, 9986, 9976, 9962, 9945, 9925, 9903, 9877, 9848, 9816, 9781, 9744, 9703, 9659, 9613, 9563, 9511,
  9455, 9397, 9336, 9272, 9205, 9135, 9063, 8988, 8910, 8829, 8746, 8660, 8572, 8480, 8387, 8290, 8192, 8090, 7986,
  7880, 7771, 7660, 7547, 7431, 7314, 7193, 7071, 6947, 6820, 6691, 6561, 6428, 6293, 6157, 6018, 5878, 5736, 5592,
  5446, 5299, 5150, 5000,
];

// Le vol : vitesse à l'appel, puis distance et durée, en entiers.
export const takeoffSpeed = (v: number, angle: number, wind: number): number =>
  scale(v, 1_000 - Math.imul(ANGLE_COST, angle), 1_000) + Math.imul(wind, WIND_GAIN);

export const flightOf = (v: number, angle: number, wind: number) => {
  const speed = takeoffSpeed(v, angle, wind);
  const vx = scale(speed, COS[angle] ?? 0, 10_000);
  const vy = scale(speed, SIN[angle] ?? 0, 10_000);
  return {
    // Distance en l'air, en mm.
    distance: idiv(Math.imul(Math.imul(2, vx), vy), GRAVITY),
    // Hauteur au sommet, en mm.
    peak: idiv(Math.imul(vy, vy), Math.imul(2, GRAVITY)),
    // Durée en pas, un au moins.
    ticks: Math.max(1, idiv(Math.imul(Math.imul(2, vy), 120), GRAVITY)),
  };
};

// Plafond théorique : la vitesse maximale à l'appel, le meilleur angle, le vent le plus favorable, la planche
// prise exactement. Aucune partie ne peut faire mieux : la vitesse ne dépasse jamais MAX_SPEED.
export const LONG_JUMP_BEST_MM = (() => {
  let best = 0;
  for (let angle = 0; angle <= MAX_ANGLE; angle += 1)
    best = Math.max(best, flightOf(MAX_SPEED, angle, MAX_WIND).distance + LANDING_MM);
  return best;
})();

export interface LongJumpState extends SimState {
  readonly wind: number;
  readonly x: number;
  readonly v: number;
  // Pas de l'appui en cours, 0 sans appui.
  readonly hold: number;
  // L'appel : angle, position, distance et durée du vol. Position à -1 tant qu'on court.
  readonly angle: number;
  readonly takeoffX: number;
  readonly flight: number;
  readonly flightTicks: number;
  readonly peak: number;
  // Pas de vol déjà joués.
  readonly air: number;
  // Mordu : appel au-delà de la planche, ou planche dépassée sans sauter.
  readonly foul: boolean;
  // Retombé avant le sable.
  readonly short: boolean;
}

export const windOf = (seed: number): number => {
  const first = rngNext(rngNext(rngNext(rngSeed(seed))));
  const second = rngNext(first);
  return (first % (MAX_WIND + 1)) + (second % (MAX_WIND + 1)) - MAX_WIND;
};

export type LongJumpPhase = "run" | "aim" | "flight" | "finished";
export const phaseOf = (state: LongJumpState): LongJumpPhase =>
  state.finished ? "finished" : state.takeoffX >= 0 ? "flight" : state.hold > TAP_MAX ? "aim" : "run";

export const toMillimetres = (x: number): number => idiv(x, UNITS_PER_MM);

// La marque, mesurée depuis la planche : un appel pris avant elle coûte la distance qui l'en sépare. Sous un
// mètre, le corps est retombé avant le sable : l'essai ne compte pas (score nul).
export const markOf = (state: Pick<LongJumpState, "takeoffX" | "flight">): number =>
  state.flight + LANDING_MM - idiv(BOARD_X - state.takeoffX, UNITS_PER_MM);

export const longJump = defineEvent<LongJumpState>({
  id: "longJump",
  channels: 1,
  scoreUnit: "mm",
  lowerIsBetter: false,
  best: LONG_JUMP_BEST_MM,
  start: (seed, base) => ({
    ...base,
    wind: windOf(seed),
    x: 0,
    v: 0,
    hold: 0,
    angle: 0,
    takeoffX: -1,
    flight: 0,
    flightTicks: 0,
    peak: 0,
    air: 0,
    foul: false,
    short: false,
  }),
  advance(state, edges) {
    // En l'air : le vol suit son cours, la marque tombe à la réception.
    if (state.takeoffX >= 0) {
      const air = state.air + 1;
      if (air < state.flightTicks) return { ...state, air };
      const mark = markOf(state);
      return mark < PIT_START_MM ? { ...state, air, short: true, score: 0 } : { ...state, air, score: mark };
    }

    const pressed = (edges.pressed & 1) !== 0;
    const released = (edges.released & 1) !== 0;
    const aiming = state.hold > TAP_MAX;
    let v = state.v - scale(state.v, DRAG_NUM, aiming ? Math.imul(DRAG_DEN, 4) : DRAG_DEN) - (state.v > 0 ? 1 : 0);
    if (v < 0) v = 0;
    if (pressed) v = Math.min(MAX_SPEED, v + TAP_GAIN);
    const hold = (edges.held & 1) !== 0 ? state.hold + 1 : 0;
    const x = state.x + v;

    // Relâcher un appui tenu : c'est l'appel, là où l'on est.
    if (released && state.hold > TAP_MAX) {
      const angle = angleOf(state.hold);
      if (x > BOARD_X) return { ...state, x, v, hold: 0, angle, foul: true, score: 0 };
      const flight = flightOf(v, angle, state.wind);
      return {
        ...state,
        x,
        v,
        hold: 0,
        angle,
        takeoffX: x,
        flight: flight.distance,
        flightTicks: flight.ticks,
        peak: flight.peak,
        air: 0,
      };
    }
    if (x > RUN_THROUGH_X || state.tick + 1 >= RUN_LIMIT_TICKS) return { ...state, x, v, hold, foul: true, score: 0 };
    return { ...state, x, v, hold };
  },
});
