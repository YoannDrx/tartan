import { idiv } from "../core/int";
import { rngNext, rngSeed } from "../core/rng";
import { type SimState, defineEvent } from "../core/sim";

// Saut en hauteur, en concours. La course d'élan est automatique. Appuyer au bon moment, c'est l'appel ; tenir,
// c'est le cambré au-dessus de la barre ; relâcher, c'est dégager les jambes. La justesse de l'appel fixe la hauteur
// que le saut peut atteindre, celle du relâchement ce qu'on en perd sur la barre. La barre part de 1,60 m et monte de
// 5 cm après chaque hauteur franchie ; trois échecs de suite à une même hauteur arrêtent le concours. La marque est
// la plus haute barre franchie.
//
// Unités : pas de 1/120 s, hauteurs en mm.

// Un essai : la course, le vol, puis le temps de remonter la barre.
export const TAKEOFF_TICK = 150;
export const FLIGHT_TICKS = 60;
// Relâcher trop tôt : les hanches n'ont pas passé la barre.
export const ARCH_MIN_TICK = 20;
// Le bon moment pour dégager les jambes, en pas après l'appel.
export const RELEASE_TICK = 38;
export const RESET_TICKS = 60;

// L'appel : trop loin de l'instant juste, c'est un refus, compté comme un échec.
export const TAKEOFF_WINDOW = { perfect: 3, good: 8, ok: 18 } as const;
const POTENTIAL = { perfect: 2_050, good: 1_960, ok: 1_820 } as const;
// Les jambes : chaque écart coûte de la hauteur ; trop loin, la barre tombe.
export const RELEASE_WINDOW = { perfect: 3, good: 8, ok: 14 } as const;
const LEG_LOSS = { perfect: 0, good: 30, ok: 70 } as const;
// La forme du jour, tirée à chaque essai : de −20 à +20 mm.
export const FORM_SPAN = 20;

export const START_BAR = 1_600;
export const BAR_STEP = 50;
export const MAX_FAILS = 3;

export const STAGE = { approach: 0, flight: 1, reset: 2 } as const;
export const OUTCOME = { none: 0, cleared: 1, failed: 2, balked: 3 } as const;

export interface HighJumpState extends SimState {
  readonly rng: number;
  readonly bar: number;
  // Échecs à la barre actuelle.
  readonly fails: number;
  // Plus haute barre franchie, 0 sans barre franchie.
  readonly best: number;
  readonly attempts: number;
  readonly stage: number;
  // Pas écoulés dans l'étape en cours.
  readonly t: number;
  // Forme de l'essai en cours, hauteur atteignable après l'appel, hauteur atteinte après les jambes.
  readonly form: number;
  readonly potential: number;
  readonly reached: number;
  // Écarts à l'instant juste, en pas.
  readonly takeoffOffset: number;
  readonly releaseOffset: number;
  readonly outcome: number;
}

const formOf = (rng: number) => (rng % (2 * FORM_SPAN + 1)) - FORM_SPAN;
const distance = (offset: number) => (offset < 0 ? -offset : offset);

const potentialOf = (offset: number): number => {
  const d = distance(offset);
  if (d <= TAKEOFF_WINDOW.perfect) return POTENTIAL.perfect;
  if (d <= TAKEOFF_WINDOW.good) return POTENTIAL.good;
  return POTENTIAL.ok;
};
const lossOf = (offset: number): number => {
  const d = distance(offset);
  if (d <= RELEASE_WINDOW.perfect) return LEG_LOSS.perfect;
  if (d <= RELEASE_WINDOW.good) return LEG_LOSS.good;
  return LEG_LOSS.ok;
};

// Plafond théorique : la meilleure forme, appel et jambes parfaits, ramenés à la barre franchissable.
export const HIGH_JUMP_BEST_MM =
  START_BAR + Math.imul(idiv(POTENTIAL.perfect + FORM_SPAN - START_BAR, BAR_STEP), BAR_STEP);

// Fin d'un essai : la barre, les échecs, la meilleure marque, et la fin du concours.
const settle = (state: HighJumpState, cleared: boolean, outcome: number): HighJumpState => {
  const fails = cleared ? 0 : state.fails + 1;
  const best = cleared ? state.bar : state.best;
  const done = !cleared && fails >= MAX_FAILS;
  return {
    ...state,
    stage: STAGE.reset,
    t: 0,
    fails,
    best,
    attempts: state.attempts + 1,
    outcome,
    score: done ? best : null,
  };
};

export const highJump = defineEvent<HighJumpState>({
  id: "highJump",
  channels: 1,
  scoreUnit: "mm",
  lowerIsBetter: false,
  best: HIGH_JUMP_BEST_MM,
  start: (seed, base) => {
    const rng = rngNext(rngNext(rngSeed(seed)));
    return {
      ...base,
      rng,
      bar: START_BAR,
      fails: 0,
      best: 0,
      attempts: 0,
      stage: STAGE.approach,
      t: 0,
      form: formOf(rng),
      potential: 0,
      reached: 0,
      takeoffOffset: 0,
      releaseOffset: 0,
      outcome: OUTCOME.none,
    };
  },
  advance(state, edges) {
    const pressed = (edges.pressed & 1) !== 0;
    const released = (edges.released & 1) !== 0;
    const t = state.t + 1;

    if (state.stage === STAGE.approach) {
      const offset = t - TAKEOFF_TICK;
      // Un appui dans la fenêtre, c'est l'appel ; trop tôt ou rien, c'est un refus.
      if (pressed && offset >= -TAKEOFF_WINDOW.ok) {
        return {
          ...state,
          stage: STAGE.flight,
          t: 0,
          takeoffOffset: offset,
          potential: potentialOf(offset) + state.form,
          outcome: OUTCOME.none,
        };
      }
      if ((pressed && offset < -TAKEOFF_WINDOW.ok) || offset > TAKEOFF_WINDOW.ok)
        return settle({ ...state, t, takeoffOffset: offset }, false, OUTCOME.balked);
      return { ...state, t };
    }

    if (state.stage === STAGE.flight) {
      // Lâcher avant d'avoir passé les hanches, ou tenir jusqu'à la retombée : la barre tombe.
      if (released || (edges.held & 1) === 0 || t >= FLIGHT_TICKS) {
        const offset = t - RELEASE_TICK;
        const early = t < ARCH_MIN_TICK;
        const reached = early || distance(offset) > RELEASE_WINDOW.ok ? 0 : state.potential - lossOf(offset);
        const cleared = reached >= state.bar;
        return settle(
          { ...state, t, releaseOffset: offset, reached },
          cleared,
          cleared ? OUTCOME.cleared : OUTCOME.failed,
        );
      }
      return { ...state, t };
    }

    // Le temps de remonter la barre, puis l'essai suivant, à la barre suivante si la précédente est passée.
    if (t < RESET_TICKS) return { ...state, t };
    const rng = rngNext(state.rng);
    return {
      ...state,
      rng,
      form: formOf(rng),
      bar: state.fails === 0 && state.attempts > 0 ? state.bar + BAR_STEP : state.bar,
      stage: STAGE.approach,
      t: 0,
      potential: 0,
      reached: 0,
      outcome: OUTCOME.none,
    };
  },
});
