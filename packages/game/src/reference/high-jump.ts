import type { ReferenceRun } from "./hurdles";

// Parties de référence du saut en hauteur : graine et journal figés, marque figée. Même règle que pour les autres
// épreuves : une règle qui change change ces valeurs, il faut alors monter SIM_VERSION et les régénérer.

export const HIGH_JUMP_REFERENCE_RUNS: readonly ReferenceRun[] = [
  {
    // Appels et jambes parfaits à chaque essai : la barre monte jusqu'au plafond de la forme du jour.
    name: "perfect",
    seed: 7,
    inputs: [
      597, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841, 152, 841,
      152, 841, 152,
    ],
    score: 2050,
    ticks: 3164,
    digest: 2363057191,
  },
  {
    // Appels bons, jambes un peu tardives : quelques échecs en chemin.
    name: "club-jumper",
    seed: 2026,
    inputs: [617, 152, 817, 176, 849, 136, 841, 188, 873, 160, 857, 168, 857, 168, 857, 168, 857, 168, 857, 168],
    score: 1900,
    ticks: 2482,
    digest: 592379379,
  },
  {
    // Aucun appui : trois refus, aucune barre.
    name: "balks",
    seed: 1,
    inputs: [],
    score: 0,
    ticks: 627,
    digest: 468557572,
  },
  {
    // Jambes lâchées avant le passage des hanches : trois barres tombées.
    name: "early-release",
    seed: 99,
    inputs: [597, 72, 841, 72, 841, 72],
    score: 0,
    ticks: 624,
    digest: 1381418422,
  },
];

// Résumé attendu de `fuzzSummary(highJump, 1, 300)`.
export const HIGH_JUMP_FUZZ = { from: 1, count: 300, summary: 3108193308 } as const;
