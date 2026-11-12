import type { ReferenceRun } from "./hurdles";

// Parties de référence du triple saut : graine et journal figés, score figé. Même règle que pour les autres
// épreuves : une règle qui change change ces valeurs, il faut alors monter SIM_VERSION et les régénérer.

export const TRIPLE_JUMP_REFERENCE_RUNS: readonly ReferenceRun[] = [
  {
    // Vent +2,0 m/s, douze appuis par seconde, deux réceptions parfaites.
    name: "perfect-tailwind",
    seed: 403,
    inputs: [
      1, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29,
      12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29,
      12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29,
      12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 12, 29, 160, 325, 12, 165, 12,
    ],
    score: 13356,
    ticks: 704,
    digest: 1319658331,
  },
  {
    // Huit appuis par seconde, réceptions bonnes.
    name: "club-jumper",
    seed: 6,
    inputs: [
      1, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 41, 160, 329, 12, 145, 12,
    ],
    score: 12555,
    ticks: 759,
    digest: 338880722,
  },
  {
    // Vent −2,0 m/s, réceptions au bord de la fenêtre.
    name: "loose-rhythm-headwind",
    seed: 100,
    inputs: [
      1, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 8, 5, 140, 313, 12, 105, 12,
    ],
    score: 10597,
    ticks: 746,
    digest: 1458463536,
  },
  {
    // Rien à la seconde réception : rythme cassé.
    name: "broken-rhythm",
    seed: 6,
    inputs: [
      1, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 41, 160, 317, 12,
    ],
    score: 0,
    ticks: 714,
    digest: 539949419,
  },
  {
    // Appel un pas trop tard : mordu.
    name: "fouled",
    seed: 6,
    inputs: [
      1, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49,
      12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 49, 12, 45, 160,
    ],
    score: 0,
    ticks: 580,
    digest: 2509611915,
  },
  {
    // Élan trop lent : retombé avant le sable.
    name: "short",
    seed: 6,
    inputs: [
      1, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12,
      149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149, 12, 149,
      12, 149, 12, 73, 160, 181, 12, 89, 12,
    ],
    score: 0,
    ticks: 1204,
    digest: 2999360833,
  },
  {
    // Aucun appui : l'essai est perdu au bout de 20 s.
    name: "no-input",
    seed: 4242,
    inputs: [],
    score: 0,
    ticks: 2400,
    digest: 3776937750,
  },
];

// Résumé attendu de `fuzzSummary(tripleJump, 1, 300)`.
export const TRIPLE_JUMP_FUZZ = { from: 1, count: 300, summary: 1138172124 } as const;
