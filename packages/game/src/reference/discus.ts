import type { ReferenceRun } from "./hurdles";

// Parties de référence du disque : graine et journal figés, marque figée. Même règle que pour les autres épreuves :
// une règle qui change change ces valeurs, il faut alors monter SIM_VERSION et les régénérer.

export const DISCUS_REFERENCE_RUNS: readonly ReferenceRun[] = [
  {
    // Lâché au troisième passage, à pleine rotation : près du plafond.
    name: "third-turn",
    seed: 7,
    inputs: [121, 792],
    score: 46822,
    ticks: 538,
    digest: 1411536780,
  },
  {
    // Lâché au deuxième passage, deux pas après le centre du secteur.
    name: "second-turn-late",
    seed: 2026,
    inputs: [121, 560],
    score: 47073,
    ticks: 480,
    digest: 3308302139,
  },
  {
    // Lâché dès le premier passage : rotation encore lente.
    name: "first-turn",
    seed: 11,
    inputs: [121, 304],
    score: 29373,
    ticks: 352,
    digest: 1453548413,
  },
  {
    // Lâché trop tard : hors du secteur, mordu.
    name: "out-of-sector",
    seed: 5,
    inputs: [121, 600],
    score: 0,
    ticks: 181,
    digest: 760045676,
  },
  {
    // Jamais lâché : sorti du cercle après trois tours.
    name: "overturned",
    seed: 3,
    inputs: [121],
    score: 0,
    ticks: 259,
    digest: 3361312557,
  },
  {
    // Aucun appui : l'essai est perdu au bout de 20 s.
    name: "no-input",
    seed: 4242,
    inputs: [],
    score: 0,
    ticks: 2400,
    digest: 1259489540,
  },
];

// Résumé attendu de `fuzzSummary(discus, 1, 300)`.
export const DISCUS_FUZZ = { from: 1, count: 300, summary: 521493002 } as const;
