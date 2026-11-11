import { MAX_SEED } from "./constants";

// Masque des canaux tenus pendant un pas : bit 0 pour le canal 0, bit 1 pour le canal 1.
export type Input = number;

// Socle commun à toutes les épreuves. L'état est un objet plat, immuable, fait d'entiers,
// de booléens et de tableaux d'entiers : il se compare, se sérialise et se rejoue tel quel.
export interface SimState {
  // Nombre de pas déjà joués.
  readonly tick: number;
  // Canaux tenus au pas précédent.
  readonly held: Input;
  readonly finished: boolean;
  // Score entier, dans l'unité de l'épreuve. Nul tant que la partie court.
  readonly score: number | null;
}

// Ce que l'épreuve reçoit à chaque pas : canaux tenus, et ceux qui viennent de changer.
export interface Edges {
  readonly held: Input;
  readonly pressed: Input;
  readonly released: Input;
}

export interface EventRules<S extends SimState> {
  readonly id: string;
  // Nombre de canaux lus. Un journal qui en utilise un autre est refusé.
  readonly channels: 1 | 2;
  readonly scoreUnit: "ms" | "mm";
  readonly lowerIsBetter: boolean;
  // Plafond théorique : le meilleur score atteignable, toutes graines confondues.
  readonly best: number;
  // État de départ, construit sur le socle fourni. La graine fixe les conditions.
  start(seed: number, base: SimState): S;
  // Un pas de 1/120 s. Renvoie l'état suivant ; un score non nul termine la partie.
  // Le noyau se charge de `tick`, `held` et `finished`.
  advance(state: S, edges: Edges): S;
}

export interface GameEvent<S extends SimState> {
  readonly id: string;
  readonly channels: 1 | 2;
  readonly scoreUnit: "ms" | "mm";
  readonly lowerIsBetter: boolean;
  readonly best: number;
  init(seed: number): S;
  // Fonction de pas. Pure : même état, même entrée, même résultat. Sans effet une fois la partie finie.
  step(state: S, input: Input): S;
}

export const isValidSeed = (seed: unknown): seed is number =>
  typeof seed === "number" && Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED;

export function defineEvent<S extends SimState>(rules: EventRules<S>): GameEvent<S> {
  const mask = (1 << rules.channels) - 1;
  return {
    id: rules.id,
    channels: rules.channels,
    scoreUnit: rules.scoreUnit,
    lowerIsBetter: rules.lowerIsBetter,
    best: rules.best,
    init(seed) {
      if (!isValidSeed(seed)) throw new RangeError("invalid seed");
      return rules.start(seed, { tick: 0, held: 0, finished: false, score: null });
    },
    step(state, input) {
      if (state.finished) return state;
      const held = input & mask;
      const next = rules.advance(state, {
        held,
        pressed: held & ~state.held,
        released: state.held & ~held,
      });
      return { ...next, tick: state.tick + 1, held, finished: next.score !== null };
    },
  };
}

// Un score meilleur que le plafond théorique ne peut pas sortir d'une vraie partie.
export const isPlausibleScore = (event: GameEvent<SimState>, score: number): boolean =>
  Number.isInteger(score) && (event.lowerIsBetter ? score >= event.best : score <= event.best);

// Empreinte de l'état, accumulée pas après pas : deux moteurs qui divergent d'une seule unité,
// à un seul pas, ne donnent pas la même empreinte. Les champs sont lus dans leur ordre de création,
// que la norme garantit.
const DIGEST_PRIME = 16_777_619;
export const DIGEST_START = 0x811c9dc5 | 0;

const mix = (hash: number, value: number): number => {
  const mixed = Math.imul(hash ^ value, DIGEST_PRIME);
  return mixed ^ (mixed >>> 15);
};

const mixValue = (hash: number, value: unknown): number => {
  if (typeof value === "number") {
    // Un flottant dans l'état est une faute de programmation : la simulation ne manie que des entiers 32 bits.
    if ((value | 0) !== value) throw new TypeError("non-integer value in simulation state");
    return mix(hash, value);
  }
  if (typeof value === "boolean") return mix(hash, value ? 1 : 0);
  if (value === null) return mix(hash, -1);
  if (Array.isArray(value)) {
    let next = mix(hash, value.length);
    for (const item of value as unknown[]) next = mixValue(next, item);
    return next;
  }
  throw new TypeError("unsupported value in simulation state");
};

export function digestState(hash: number, state: SimState): number {
  let next = hash;
  for (const value of Object.values(state) as unknown[]) next = mixValue(next, value);
  return next;
}
