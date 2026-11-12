import { clamp, idiv, scale } from "../core/int";
import { type SimState, defineEvent } from "../core/sim";
import {
  BOARD_X,
  MAX_SPEED,
  MAX_WIND,
  RUN_LIMIT_TICKS,
  TAP_GAIN,
  TAP_MAX,
  UNITS_PER_MM,
  angleOf,
  flightOf,
  takeoffSpeed,
  windOf,
} from "./long-jump";

// Triple saut. Même élan que la longueur : appuis brefs pour la vitesse, appui tenu puis relâché pour l'appel du
// cloche-pied. Puis, à chacune des deux réceptions, un appui au moment où le pied touche : juste, il garde l'élan
// pour la foulée, puis pour le saut. Trop tôt ou trop tard, le rythme est cassé et l'essai ne compte pas.
//
// Unités : celles de la longueur (position en 1/120 mm, vitesse en mm/s, angle en degrés, vent en dm/s).

export { BOARD_X, UNITS_PER_MM, windOf };

// Les trois bonds : cloche-pied, foulée, saut.
export const PHASE = { run: 0, hop: 1, step: 2, jump: 3 } as const;
// L'angle du cloche-pied suit l'appui tenu, plafonné : un triple sauteur part rasant. Foulée et saut, angles fixes.
export const HOP_MAX_ANGLE = 24;
export const STEP_ANGLE = 12;
export const JUMP_ANGLE = 18;

// La réception : l'appui tombe à quelques pas du contact. Plus il est juste, plus l'élan est gardé.
export const PERFECT_WINDOW = 3;
export const GOOD_WINDOW = 7;
export const OK_WINDOW = 12;
const KEEP = { perfect: 950, good: 920, ok: 880 } as const;

export const GRADE = { none: 0, perfect: 1, good: 2, ok: 3 } as const;
export type Grade = (typeof GRADE)[keyof typeof GRADE];

const gradeOf = (offset: number): Grade => {
  const distance = offset < 0 ? -offset : offset;
  if (distance <= PERFECT_WINDOW) return GRADE.perfect;
  if (distance <= GOOD_WINDOW) return GRADE.good;
  return GRADE.ok;
};
const keepOf = (grade: Grade): number =>
  grade === GRADE.perfect ? KEEP.perfect : grade === GRADE.good ? KEEP.good : KEEP.ok;

const LANDING_MM = 400;
// Le sable commence neuf mètres après la planche : retomber avant, c'est un essai nul.
export const PIT_START_MM = 9_000;
// Aucun appui pendant le vol : valeur d'attente.
const NONE = -100_000;

const RUN_THROUGH_X = BOARD_X + 1_000 * UNITS_PER_MM;
const DRAG_NUM = 14;
const DRAG_DEN = 4_096;

export interface TripleJumpState extends SimState {
  readonly wind: number;
  readonly x: number;
  readonly v: number;
  readonly hold: number;
  // 0 sur l'élan, puis 1, 2, 3 pour le cloche-pied, la foulée et le saut.
  readonly phase: number;
  readonly takeoffX: number;
  // Vitesse au départ du bond en cours, après l'angle et, au cloche-pied, le vent.
  readonly speed: number;
  readonly angle: number;
  readonly air: number;
  readonly flightTicks: number;
  readonly peak: number;
  // Longueur des trois bonds, en mm.
  readonly bounds: readonly number[];
  // Écart au contact de l'appui reçu pendant ce bond, en pas (négatif : en avance). NONE sans appui.
  readonly pending: number;
  // Qualité des deux réceptions.
  readonly grades: readonly Grade[];
  readonly foul: boolean;
  readonly short: boolean;
  readonly broken: boolean;
}

const bound = (speed: number, angle: number) => {
  const flight = flightOf(speed, angle, 0);
  return { distance: flight.distance, ticks: flight.ticks, peak: flight.peak, speed: takeoffSpeed(speed, angle, 0) };
};

// Plafond théorique : l'élan maximal, le meilleur angle de cloche-pied, deux réceptions parfaites, le vent le plus
// favorable, la planche prise exactement.
export const TRIPLE_JUMP_BEST_MM = (() => {
  let best = 0;
  for (let angle = 0; angle <= HOP_MAX_ANGLE; angle += 1) {
    const hop = flightOf(MAX_SPEED, angle, MAX_WIND);
    const afterHop = scale(takeoffSpeed(MAX_SPEED, angle, MAX_WIND), KEEP.perfect, 1_000);
    const step = bound(afterHop, STEP_ANGLE);
    const jump = bound(scale(step.speed, KEEP.perfect, 1_000), JUMP_ANGLE);
    best = Math.max(best, hop.distance + step.distance + jump.distance + LANDING_MM);
  }
  return best;
})();

// Distance parcourue depuis l'appel, en mm, au début du bond en cours.
export const doneBefore = (state: Pick<TripleJumpState, "bounds" | "phase">): number => {
  let total = 0;
  for (let index = 0; index < state.phase - 1; index += 1) total += state.bounds[index] ?? 0;
  return total;
};

export const markOf = (state: Pick<TripleJumpState, "bounds" | "takeoffX">): number =>
  (state.bounds[0] ?? 0) +
  (state.bounds[1] ?? 0) +
  (state.bounds[2] ?? 0) +
  LANDING_MM -
  idiv(BOARD_X - state.takeoffX, UNITS_PER_MM);

const broken = (state: TripleJumpState): TripleJumpState => ({ ...state, broken: true, score: 0 });

export const tripleJump = defineEvent<TripleJumpState>({
  id: "tripleJump",
  channels: 1,
  scoreUnit: "mm",
  lowerIsBetter: false,
  best: TRIPLE_JUMP_BEST_MM,
  start: (seed, base) => ({
    ...base,
    wind: windOf(seed),
    x: 0,
    v: 0,
    hold: 0,
    phase: PHASE.run,
    takeoffX: -1,
    speed: 0,
    angle: 0,
    air: 0,
    flightTicks: 0,
    peak: 0,
    bounds: [0, 0, 0],
    pending: NONE,
    grades: [GRADE.none, GRADE.none],
    foul: false,
    short: false,
    broken: false,
  }),
  advance(state, edges) {
    const pressed = (edges.pressed & 1) !== 0;

    // En l'air : on attend la réception, et l'appui qui la règle.
    if (state.phase !== PHASE.run) {
      const air = state.air + 1;
      let pending = state.pending;
      if (pressed && pending === NONE && state.phase !== PHASE.jump) pending = air - state.flightTicks;
      if (state.phase === PHASE.jump) {
        if (air < state.flightTicks) return { ...state, air };
        const mark = markOf(state);
        return mark < PIT_START_MM ? { ...state, air, short: true, score: 0 } : { ...state, air, score: mark };
      }
      // Trop tôt, ou rien dans la fenêtre après le contact : le rythme est cassé.
      if (pending !== NONE && (pending < -OK_WINDOW || pending > OK_WINDOW)) return broken({ ...state, air, pending });
      if (air < state.flightTicks) return { ...state, air, pending };
      if (pending === NONE) return air - state.flightTicks > OK_WINDOW ? broken({ ...state, air }) : { ...state, air };
      const grade = gradeOf(pending);
      const next = state.phase === PHASE.hop ? PHASE.step : PHASE.jump;
      const flight = bound(scale(state.speed, keepOf(grade), 1_000), next === PHASE.step ? STEP_ANGLE : JUMP_ANGLE);
      return {
        ...state,
        phase: next,
        speed: flight.speed,
        angle: next === PHASE.step ? STEP_ANGLE : JUMP_ANGLE,
        air: 0,
        flightTicks: flight.ticks,
        peak: flight.peak,
        bounds: state.bounds.map((value, index) => (index === next - 1 ? flight.distance : value)),
        pending: NONE,
        grades: state.grades.map((value, index) => (index === state.phase - 1 ? grade : value)),
      };
    }

    // L'élan, comme à la longueur.
    const released = (edges.released & 1) !== 0;
    const aiming = state.hold > TAP_MAX;
    let v = state.v - scale(state.v, DRAG_NUM, aiming ? Math.imul(DRAG_DEN, 4) : DRAG_DEN) - (state.v > 0 ? 1 : 0);
    if (v < 0) v = 0;
    if (pressed) v = Math.min(MAX_SPEED, v + TAP_GAIN);
    const hold = (edges.held & 1) !== 0 ? state.hold + 1 : 0;
    const x = state.x + v;

    if (released && state.hold > TAP_MAX) {
      const angle = clamp(angleOf(state.hold), 0, HOP_MAX_ANGLE);
      if (x > BOARD_X) return { ...state, x, v, hold: 0, angle, foul: true, score: 0 };
      const hop = flightOf(v, angle, state.wind);
      return {
        ...state,
        x,
        v,
        hold: 0,
        phase: PHASE.hop,
        takeoffX: x,
        speed: takeoffSpeed(v, angle, state.wind),
        angle,
        air: 0,
        flightTicks: hop.ticks,
        peak: hop.peak,
        bounds: [hop.distance, 0, 0],
      };
    }
    if (x > RUN_THROUGH_X || state.tick + 1 >= RUN_LIMIT_TICKS) return { ...state, x, v, hold, foul: true, score: 0 };
    return { ...state, x, v, hold };
  },
});
