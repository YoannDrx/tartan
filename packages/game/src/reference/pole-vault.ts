import type { ReferenceRun } from "./hurdles";

// Parties de référence du saut à la perche : graine et journal figés, marque figée. Même règle que pour les autres
// épreuves : une règle qui change change ces valeurs, il faut alors monter SIM_VERSION et les régénérer.

export const POLE_VAULT_REFERENCE_RUNS: readonly ReferenceRun[] = [
  {
    // Plantés et renversements parfaits à chaque essai : la barre monte jusqu'au plafond de la forme du jour.
    name: "perfect",
    seed: 7,
    inputs: [
      557, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761, 192, 761,
      192, 761, 192, 761, 192, 761, 192, 761, 192,
    ],
    score: 5850,
    ticks: 3758,
    digest: 265456983,
  },
  {
    // Plantés bons, renversements un peu tardifs : quelques échecs en chemin.
    name: "club-vaulter",
    seed: 2026,
    inputs: [
      577, 192, 737, 220, 769, 176, 761, 232, 793, 200, 777, 212, 777, 212, 777, 212, 777, 212, 777, 212, 777, 212,
    ],
    score: 5250,
    ticks: 2646,
    digest: 1633541309,
  },
  {
    // Aucun appui : trois refus, aucune barre.
    name: "balks",
    seed: 1,
    inputs: [],
    score: 0,
    ticks: 577,
    digest: 3104764452,
  },
  {
    // Perche lâchée avant le renversement : trois barres tombées.
    name: "early-release",
    seed: 99,
    inputs: [557, 72, 761, 72, 761, 72],
    score: 0,
    ticks: 574,
    digest: 185967118,
  },
];

// Résumé attendu de `fuzzSummary(poleVault, 1, 300)`.
export const POLE_VAULT_FUZZ = { from: 1, count: 300, summary: 3686312427 } as const;
