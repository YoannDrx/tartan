import { idiv } from "../core/int";
import { rngNext, rngSeed } from "../core/rng";
import { type GameEvent, type SimState, defineEvent } from "../core/sim";

// Les concours à barre : saut en hauteur et saut à la perche. La course d'élan est automatique. Appuyer au bon moment,
// c'est l'appel (ou le planté de la perche) ; tenir, c'est le cambré (ou la flexion) ; relâcher, c'est dégager les
// jambes (ou se renverser). La justesse de l'appui fixe la hauteur que le saut peut atteindre, celle du relâchement ce
// qu'on en perd sur la barre. La barre monte d'un cran après chaque hauteur franchie ; trois échecs de suite à une
// même hauteur arrêtent le concours. La marque est la plus haute barre franchie.
//
// Unités : pas de 1/120 s, hauteurs en mm.

export interface BarRules {
  readonly id: string;
  // Un essai : la course, le vol, puis le temps de remonter la barre.
  readonly takeoffTick: number;
  readonly flightTicks: number;
  // Relâcher avant ce pas du vol : la barre tombe.
  readonly archMinTick: number;
  // Le bon moment pour relâcher, en pas après l'appel.
  readonly releaseTick: number;
  readonly resetTicks: number;
  // Fenêtres de l'appel (au-delà de `ok`, refus) et hauteur atteignable pour chacune.
  readonly takeoffWindow: { readonly perfect: number; readonly good: number; readonly ok: number };
  readonly potential: { readonly perfect: number; readonly good: number; readonly ok: number };
  // Fenêtres du relâchement (au-delà de `ok`, barre tombée) et hauteur perdue pour chacune.
  readonly releaseWindow: { readonly perfect: number; readonly good: number; readonly ok: number };
  readonly loss: { readonly perfect: number; readonly good: number; readonly ok: number };
  // La forme du jour, tirée à chaque essai : de −formSpan à +formSpan mm.
  readonly formSpan: number;
  readonly startBar: number;
  readonly barStep: number;
}

export const MAX_FAILS = 3;
export const STAGE = { approach: 0, flight: 1, reset: 2 } as const;
export const OUTCOME = { none: 0, cleared: 1, failed: 2, balked: 3 } as const;

export interface BarState extends SimState {
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
  // Forme de l'essai en cours, hauteur atteignable après l'appel, hauteur atteinte après le relâchement.
  readonly form: number;
  readonly potential: number;
  readonly reached: number;
  // Écarts à l'instant juste, en pas.
  readonly takeoffOffset: number;
  readonly releaseOffset: number;
  readonly outcome: number;
}

const distance = (offset: number) => (offset < 0 ? -offset : offset);

// Plafond théorique : la meilleure forme, appel et relâchement parfaits, ramenés à la barre franchissable.
export const bestOf = (rules: BarRules): number =>
  rules.startBar +
  Math.imul(idiv(rules.potential.perfect + rules.formSpan - rules.startBar, rules.barStep), rules.barStep);

export function defineBarEvent(rules: BarRules): GameEvent<BarState> {
  const formOf = (rng: number) => (rng % (2 * rules.formSpan + 1)) - rules.formSpan;
  const potentialOf = (offset: number): number => {
    const d = distance(offset);
    if (d <= rules.takeoffWindow.perfect) return rules.potential.perfect;
    if (d <= rules.takeoffWindow.good) return rules.potential.good;
    return rules.potential.ok;
  };
  const lossOf = (offset: number): number => {
    const d = distance(offset);
    if (d <= rules.releaseWindow.perfect) return rules.loss.perfect;
    if (d <= rules.releaseWindow.good) return rules.loss.good;
    return rules.loss.ok;
  };

  // Fin d'un essai : la barre, les échecs, la meilleure marque, et la fin du concours.
  const settle = (state: BarState, cleared: boolean, outcome: number): BarState => {
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

  return defineEvent<BarState>({
    id: rules.id,
    channels: 1,
    scoreUnit: "mm",
    lowerIsBetter: false,
    best: bestOf(rules),
    start: (seed, base) => {
      const rng = rngNext(rngNext(rngSeed(seed)));
      return {
        ...base,
        rng,
        bar: rules.startBar,
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
        const offset = t - rules.takeoffTick;
        // Un appui dans la fenêtre, c'est l'appel ; trop tôt ou rien, c'est un refus.
        if (pressed && offset >= -rules.takeoffWindow.ok) {
          return {
            ...state,
            stage: STAGE.flight,
            t: 0,
            takeoffOffset: offset,
            potential: potentialOf(offset) + state.form,
            outcome: OUTCOME.none,
          };
        }
        if ((pressed && offset < -rules.takeoffWindow.ok) || offset > rules.takeoffWindow.ok)
          return settle({ ...state, t, takeoffOffset: offset }, false, OUTCOME.balked);
        return { ...state, t };
      }

      if (state.stage === STAGE.flight) {
        // Lâcher trop tôt, ou tenir jusqu'à la retombée : la barre tombe.
        if (released || (edges.held & 1) === 0 || t >= rules.flightTicks) {
          const offset = t - rules.releaseTick;
          const early = t < rules.archMinTick;
          const reached = early || distance(offset) > rules.releaseWindow.ok ? 0 : state.potential - lossOf(offset);
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
      if (t < rules.resetTicks) return { ...state, t };
      const rng = rngNext(state.rng);
      return {
        ...state,
        rng,
        form: formOf(rng),
        bar: state.fails === 0 && state.attempts > 0 ? state.bar + rules.barStep : state.bar,
        stage: STAGE.approach,
        t: 0,
        potential: 0,
        reached: 0,
        outcome: OUTCOME.none,
      };
    },
  });
}
