import { clamp, idiv, scale } from "../core/int";
import { rngNext, rngSeed } from "../core/rng";
import { type SimState, defineEvent } from "../core/sim";

// 110 m haies. La course est automatique : un appui lance le saut, et tout se joue sur l'instant
// où la haie passe sous l'athlète. Au sommet du saut, aucune perte. Plus on s'en écarte, plus on
// perd de vitesse ; trop loin, la haie tombe. Sans appui, l'athlète la percute.
//
// Unités, toutes entières :
//   position : 1/1200 mm (110 m = 132 000 000, loin sous 2^31)
//   vitesse  : unités de position par pas, soit 0,1 mm/s (1 m/s = 10 000)
//   vent     : dm/s, comme on l'annonce au bord de la piste (+12 = +1,2 m/s)

export const UNITS_PER_MM = 1_200;
const METRE = 1_000 * UNITS_PER_MM;
export const SPEED_UNITS_PER_M_S = 10_000;

export const FINISH_X = 110 * METRE;
export const HURDLE_COUNT = 10;
export const HURDLE_HEIGHT_MM = 1_067;
const FIRST_HURDLE_X = 13_720 * UNITS_PER_MM;
const HURDLE_SPACING = 9_140 * UNITS_PER_MM;

export const hurdleX = (index: number): number => FIRST_HURDLE_X + Math.imul(index, HURDLE_SPACING);

// Le saut dure 41 pas (342 ms) et culmine au 21e. La réception et les 5 pas suivants ne permettent pas de ressauter.
export const FLIGHT_TICKS = 41;
export const APEX_TICK = 21;
export const RECOVER_TICKS = 6;
const JUMP_PEAK_MM = 1_480;

// Écart au sommet, en pas, à l'instant où la haie est franchie.
export const PERFECT_WINDOW = 2; // ± 17 ms
export const GOOD_WINDOW = 6; // ± 50 ms
export const CLEAR_WINDOW = 11; // ± 92 ms : au-delà, le pied est sous la barre et la haie tombe

// Vitesse perdue au franchissement, en millièmes, selon l'écart au sommet (0 à CLEAR_WINDOW).
const CLEAR_LOSS = [0, 1, 3, 8, 14, 21, 29, 60, 72, 85, 99, 114];
const CLIPPED_LOSS = 200;
const CRASHED_LOSS = 320;

// Vitesse de croisière : une base, le vent, et le rythme gagné haie après haie.
const BASE_CAP = 91_500;
const RHYTHM_STEP = 300;
const WIND_STEP = 50;
const PERFECT_RHYTHM = 2;
const GOOD_RHYTHM = 1;
export const MAX_WIND = 20;

// La vitesse rejoint la croisière par une fraction constante de l'écart à chaque pas.
const APPROACH_NUM = 27;
const APPROACH_DEN = 4_096;

export const GRADE = {
  pending: 0,
  perfect: 1,
  good: 2,
  // Appui trop tôt : la haie arrive dans la descente.
  early: 3,
  // Appui tardif : la haie arrive dans la montée.
  late: 4,
  // Renversée en l'air.
  clipped: 5,
  // Percutée en pleine course, sans saut.
  crashed: 6,
} as const;
export type Grade = (typeof GRADE)[keyof typeof GRADE];

export const isHurdleDown = (grade: Grade): boolean => grade === GRADE.clipped || grade === GRADE.crashed;

export interface HurdlesState extends SimState {
  // Vent de la course, en dm/s. Positif : dans le dos.
  readonly wind: number;
  readonly x: number;
  readonly v: number;
  // Rythme accumulé : chaque point relève la vitesse de croisière.
  readonly rhythm: number;
  // 0 au sol, sinon numéro du pas de vol qui vient d'être joué (1 à FLIGHT_TICKS).
  readonly air: number;
  // Pas de reprise restants après la réception : tant qu'il en reste, un appui ne lance rien.
  readonly recover: number;
  // Index de la prochaine haie, HURDLE_COUNT quand toutes sont passées.
  readonly next: number;
  // Une note par haie, `GRADE.pending` tant qu'elle n'est pas atteinte.
  readonly hurdles: readonly Grade[];
  // Écart au sommet du dernier franchissement, en pas : négatif pour un appui tardif, positif pour un appui trop tôt.
  readonly lastOffset: number;
}

// Deux tirages additionnés : les vents faibles sont les plus fréquents, comme sur une vraie piste.
export const windOf = (seed: number): number => {
  const first = rngNext(rngNext(rngSeed(seed)));
  const second = rngNext(first);
  return (first % (MAX_WIND + 1)) + (second % (MAX_WIND + 1)) - MAX_WIND;
};

export const cruiseSpeed = (wind: number, rhythm: number): number =>
  BASE_CAP + Math.imul(wind, WIND_STEP) + Math.imul(rhythm, RHYTHM_STEP);

// Hauteur du pied au-dessus de la piste, en mm, pour un pas de vol donné. La haie tient
// exactement quand cette hauteur atteint la barre : la règle et l'image disent la même chose.
export const jumpHeight = (air: number): number =>
  air <= 0 || air > FLIGHT_TICKS
    ? 0
    : idiv(Math.imul(JUMP_PEAK_MM, Math.imul(air, FLIGHT_TICKS + 1 - air)), Math.imul(APEX_TICK, APEX_TICK));

export type HurdlesPhase = "run" | "flight" | "landing" | "finished";

export const phaseOf = (state: HurdlesState): HurdlesPhase =>
  state.finished ? "finished" : state.air > 0 ? "flight" : state.recover > 0 ? "landing" : "run";

export const toMillimetres = (x: number): number => idiv(x, UNITS_PER_MM);

// Temps écoulé à afficher pendant la course, en ms.
export const clockMs = (tick: number): number => idiv(Math.imul(tick, 25), 3);

const gradeOf = (air: number): Grade => {
  if (air === 0) return GRADE.crashed;
  const offset = air - APEX_TICK;
  const distance = offset < 0 ? -offset : offset;
  if (distance <= PERFECT_WINDOW) return GRADE.perfect;
  if (distance <= GOOD_WINDOW) return GRADE.good;
  if (distance <= CLEAR_WINDOW) return offset > 0 ? GRADE.early : GRADE.late;
  return GRADE.clipped;
};

const lossOf = (grade: Grade, air: number): number => {
  if (grade === GRADE.crashed) return CRASHED_LOSS;
  if (grade === GRADE.clipped) return CLIPPED_LOSS;
  const offset = air - APEX_TICK;
  return CLEAR_LOSS[offset < 0 ? -offset : offset] ?? CLIPPED_LOSS;
};

const rhythmAfter = (rhythm: number, grade: Grade): number => {
  if (grade === GRADE.perfect) return rhythm + PERFECT_RHYTHM;
  if (grade === GRADE.good) return rhythm + GOOD_RHYTHM;
  // Une haie touchée casse la moitié du rythme, une haie tombée le casse entièrement.
  if (grade === GRADE.early || grade === GRADE.late) return rhythm >> 1;
  return 0;
};

const approach = (v: number, cap: number): number =>
  v < cap
    ? clamp(v + scale(cap - v, APPROACH_NUM, APPROACH_DEN) + 1, 0, cap)
    : clamp(v - scale(v - cap, APPROACH_NUM, APPROACH_DEN) - 1, cap, v);

// Plafond théorique, en ms : dix franchissements au sommet exact, par vent de +2,0 m/s.
// Aucune partie ne peut faire mieux. À chaque pas, cette course-là a la plus grande position, la
// plus grande vitesse et le plus grand rythme possibles, parce que chaque règle (accélération,
// perte, gain de rythme) ne fait que conserver cet ordre. Le test du paquet le recalcule.
export const HURDLES_BEST_MS = 12_842;

export const hurdles = defineEvent<HurdlesState>({
  id: "hurdles",
  channels: 1,
  scoreUnit: "ms",
  lowerIsBetter: true,
  best: HURDLES_BEST_MS,
  start: (seed, base) => ({
    ...base,
    wind: windOf(seed),
    x: 0,
    v: 0,
    rhythm: 0,
    air: 0,
    recover: 0,
    next: 0,
    hurdles: Array.from({ length: HURDLE_COUNT }, () => GRADE.pending),
    lastOffset: 0,
  }),
  advance(state, edges) {
    let { rhythm, air, recover, next, hurdles: grades, lastOffset } = state;

    // L'état porte le dernier pas de vol joué : on avance d'abord le saut en cours, puis on lit l'appui.
    if (air > 0) {
      if (air === FLIGHT_TICKS) {
        air = 0;
        recover = RECOVER_TICKS;
      } else {
        air += 1;
      }
    } else if (recover > 0) {
      recover -= 1;
    }
    if ((edges.pressed & 1) !== 0 && air === 0 && recover === 0) air = 1;

    // L'athlète accélère aussi en l'air : seule la justesse du saut coûte, pas le saut lui-même.
    const speed = approach(state.v, cruiseSpeed(state.wind, rhythm));
    const x = state.x + speed;
    let v = speed;

    if (next < HURDLE_COUNT && x >= hurdleX(next)) {
      const grade = gradeOf(air);
      v -= scale(v, lossOf(grade, air), 1_000);
      rhythm = rhythmAfter(rhythm, grade);
      lastOffset = air === 0 ? 0 : air - APEX_TICK;
      grades = grades.map((current, index) => (index === next ? grade : current));
      next += 1;
    }

    // Le temps est pris sur la ligne, pas à la fin du pas : on ajoute la fraction du pas
    // parcourue avant la ligne, en tiers de milliseconde (un pas vaut 25 tiers), arrondie au-dessus.
    const score =
      x >= FINISH_X ? idiv(Math.imul(state.tick, 25) + idiv(Math.imul(FINISH_X - state.x, 25), speed) + 2, 3) : null;

    return { ...state, x, v, rhythm, air, recover, next, hurdles: grades, lastOffset, score };
  },
});
