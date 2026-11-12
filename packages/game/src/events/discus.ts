import { idiv, scale } from "../core/int";
import { rngNext, rngSeed } from "../core/rng";
import { type SimState, defineEvent } from "../core/sim";

// Lancer du disque. Tenir l'appui lance la volte : la rotation accélère tant qu'on tient. Relâcher, c'est lâcher le
// disque, dans la direction que regarde le bras à cet instant. Dans le secteur, le disque part d'autant plus loin que
// la rotation est rapide ; hors du secteur, l'essai est mordu. Plus de trois tours, et le lanceur sort du cercle.
//
// Unités : angles en seizièmes de degré (un tour = 5 760), vitesse de rotation en seizièmes de degré par pas,
// vitesse du disque en mm/s, distances en mm.

export const TURN = 5_760;
const HALF_TURN = 2_880;
const DEGREE = 16;
// Le bras part dos au lancer : la direction du lancer est 0, le départ 180°.
export const START_ANGLE = 180 * DEGREE;
// La rotation gagne un seizième de degré par pas à chaque pas tenu, jusqu'à 6° par pas (720° par seconde).
export const SPIN_GAIN = 1;
export const MAX_SPIN = 6 * DEGREE;
// Le secteur : 34,92° d'ouverture en compétition, ici ±17°.
export const SECTOR_HALF = 17 * DEGREE;
// Au-delà de trois tours, le lanceur sort du cercle.
export const MAX_ROTATION = 3 * TURN;
// Sans volte au bout de 20 s, l'essai est perdu.
export const WAIT_LIMIT_TICKS = 2_400;

// Vitesse du disque au lâcher : proportionnelle à la rotation. Angle d'envol fixe, 35° (sinus du double : 0,9397).
const SPEED_PER_SPIN = 230;
const SIN_TWICE_RELEASE = 9_397;
const SIN_RELEASE = 5_736;
const GRAVITY = 9_810;
// La forme du jour, tirée de la graine : de −40 à +40 cm.
export const FORM_SPAN = 400;

export const PHASE = { waiting: 0, spinning: 1, flight: 2 } as const;

export const throwOf = (spin: number) => {
  const speed = Math.imul(spin, SPEED_PER_SPIN);
  const vy = scale(speed, SIN_RELEASE, 10_000);
  return {
    distance: scale(idiv(Math.imul(speed, speed), GRAVITY), SIN_TWICE_RELEASE, 10_000),
    ticks: Math.max(1, idiv(Math.imul(Math.imul(2, vy), 120), GRAVITY)),
  };
};

// Plafond théorique : la rotation maximale, la meilleure forme.
export const DISCUS_BEST_MM = throwOf(MAX_SPIN).distance + FORM_SPAN;

// L'écart de direction au centre du secteur, de −180° à +180° (en seizièmes).
export const directionOf = (angle: number): number => {
  const wrapped = angle % TURN;
  return wrapped > HALF_TURN ? wrapped - TURN : wrapped;
};

export interface DiscusState extends SimState {
  readonly form: number;
  readonly phase: number;
  // Direction du bras, et rotation accumulée depuis le début de la volte.
  readonly angle: number;
  readonly rotation: number;
  readonly spin: number;
  // Le lâcher : direction, distance du lancer, durée du vol, pas de vol joués.
  readonly direction: number;
  readonly distance: number;
  readonly flightTicks: number;
  readonly air: number;
  // Hors du secteur ; sorti du cercle.
  readonly foul: boolean;
  readonly overturned: boolean;
}

export const discus = defineEvent<DiscusState>({
  id: "discus",
  channels: 1,
  scoreUnit: "mm",
  lowerIsBetter: false,
  best: DISCUS_BEST_MM,
  start: (seed, base) => {
    const rng = rngNext(rngNext(rngSeed(seed)));
    return {
      ...base,
      form: (rng % (2 * FORM_SPAN + 1)) - FORM_SPAN,
      phase: PHASE.waiting,
      angle: START_ANGLE,
      rotation: 0,
      spin: 0,
      direction: 0,
      distance: 0,
      flightTicks: 0,
      air: 0,
      foul: false,
      overturned: false,
    };
  },
  advance(state, edges) {
    const held = (edges.held & 1) !== 0;
    const released = (edges.released & 1) !== 0;

    if (state.phase === PHASE.flight) {
      const air = state.air + 1;
      return air < state.flightTicks ? { ...state, air } : { ...state, air, score: state.distance };
    }

    if (state.phase === PHASE.waiting) {
      if (held) return { ...state, phase: PHASE.spinning, spin: SPIN_GAIN };
      return state.tick + 1 >= WAIT_LIMIT_TICKS ? { ...state, foul: true, score: 0 } : state;
    }

    // La volte : le bras tourne, la rotation accélère tant qu'on tient.
    const angle = (state.angle + state.spin) % TURN;
    const rotation = state.rotation + state.spin;
    if (rotation > MAX_ROTATION) return { ...state, angle, rotation, overturned: true, score: 0 };
    if (released) {
      const direction = directionOf(angle);
      if (direction < -SECTOR_HALF || direction > SECTOR_HALF)
        return { ...state, angle, rotation, direction, foul: true, score: 0 };
      const thrown = throwOf(state.spin);
      return {
        ...state,
        phase: PHASE.flight,
        angle,
        rotation,
        direction,
        distance: Math.max(1, thrown.distance + state.form),
        flightTicks: thrown.ticks,
        air: 0,
      };
    }
    return { ...state, angle, rotation, spin: Math.min(MAX_SPIN, state.spin + SPIN_GAIN) };
  },
});
