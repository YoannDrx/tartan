import type { ReferenceRun } from "./hurdles";

// Parties de référence du saut en longueur : graine et journal figés, score figé. Même règle que pour les haies :
// une règle qui change change ces valeurs, il faut alors monter SIM_VERSION et les régénérer.

const taps = (count: number, gap: number) => Array.from({ length: count }, () => [12, gap]).flat();

export const LONG_JUMP_REFERENCE_RUNS: readonly ReferenceRun[] = [
  {
    // Vent +2,0 m/s, douze appuis par seconde, la planche prise au plus près.
    name: "fast-board-tailwind",
    seed: 403,
    inputs: [1, ...taps(45, 29).slice(0, -1), 13, 304],
    score: 7846,
    ticks: 653,
    digest: 2322107894,
  },
  {
    // Huit appuis par seconde, sans vent : un bon sauteur de club.
    name: "club-jumper",
    seed: 6,
    inputs: [1, ...taps(34, 49).slice(0, -1), 41, 288],
    score: 7536,
    ticks: 704,
    digest: 3847046825,
  },
  {
    // Vent −2,0 m/s, appel pris loin avant la planche.
    name: "early-takeoff-headwind",
    seed: 100,
    inputs: [1, ...taps(32, 49).slice(0, -1), 5, 240],
    score: 2608,
    ticks: 636,
    digest: 674086188,
  },
  {
    // Appel un pas trop tard : mordu.
    name: "fouled",
    seed: 6,
    inputs: [1, ...taps(35, 49).slice(0, -1), 29, 240],
    score: 0,
    ticks: 581,
    digest: 2743078914,
  },
  {
    // Aucun appui : l'essai est perdu au bout de 20 s.
    name: "no-input",
    seed: 4242,
    inputs: [],
    score: 0,
    ticks: 2400,
    digest: 1986924487,
  },
  {
    // Appuis désordonnés, appel pris loin de la planche : retombée avant le sable, l'essai est nul.
    name: "stray-presses",
    seed: 11,
    inputs: [49, 8, 165, 284, 9],
    score: 0,
    ticks: 142,
    digest: 810684562,
  },
];

// Résumé attendu de `fuzzSummary(longJump, 1, 300)`.
export const LONG_JUMP_FUZZ = { from: 1, count: 300, summary: 292115337 } as const;
