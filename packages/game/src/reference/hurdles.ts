// Parties de référence du 110 m haies : graine et journal figés, score figé.
// Elles doivent donner le même résultat sous Node, Chromium et WebKit. Si une règle change,
// ces valeurs changent : il faut alors monter SIM_VERSION et les régénérer, pas les retoucher à la main.

export interface ReferenceRun {
  readonly name: string;
  readonly seed: number;
  readonly inputs: readonly number[];
  readonly score: number;
  readonly ticks: number;
  readonly digest: number;
}

export const HURDLES_REFERENCE_RUNS: readonly ReferenceRun[] = [
  {
    // Vent +2,0 m/s, dix franchissements au sommet exact : c'est le plafond théorique.
    name: "perfect-tailwind",
    seed: 757,
    inputs: [1157, 32, 485, 32, 457, 32, 445, 32, 441, 32, 433, 32, 429, 32, 425, 32, 425, 32, 421, 32],
    score: 12842,
    ticks: 1541,
    digest: 2466437662,
  },
  {
    // Vent −2,0 m/s, aucun appui : les dix haies sont percutées.
    name: "no-input-headwind",
    seed: 589,
    inputs: [],
    score: 16745,
    ticks: 2010,
    digest: 1263185420,
  },
  {
    // Toutes les notes y passent : parfait, bon, tôt, tardif, renversée, percutée.
    name: "mixed-grades",
    seed: 20261111,
    inputs: [1165, 20, 517, 20, 445, 20, 1089, 20, 473, 20, 589, 20, 489, 20, 529, 20, 465, 20],
    score: 14051,
    ticks: 1687,
    digest: 1224212939,
  },
  {
    // Une bonne course d'un joueur régulier : huit haies parfaites, deux bonnes.
    name: "club-athlete",
    seed: 4242,
    inputs: [1157, 48, 489, 48, 425, 48, 453, 48, 425, 48, 413, 48, 445, 48, 401, 48, 425, 48, 397, 48],
    score: 13005,
    ticks: 1561,
    digest: 1058244521,
  },
  {
    // Appuis désordonnés, dont certains en plein vol, qui ne comptent pas.
    name: "stray-presses",
    seed: 1,
    inputs: [
      277, 308, 141, 280, 9, 136, 141, 160, 277, 300, 9, 232, 121, 360, 57, 304, 301, 148, 9, 172, 233, 144, 165, 104,
      181, 308, 157, 44, 65, 108,
    ],
    score: 16213,
    ticks: 1946,
    digest: 1339133676,
  },
  {
    // Appuis désordonnés, et la course finit le doigt encore appuyé.
    name: "stray-presses-held",
    seed: 2,
    inputs: [
      233, 312, 29, 164, 297, 276, 29, 132, 233, 268, 297, 272, 253, 72, 9, 20, 89, 40, 297, 108, 93, 140, 65, 80, 301,
      132, 53, 244, 21, 160, 49, 172, 13, 220, 161, 228, 225,
    ],
    score: 16518,
    ticks: 1983,
    digest: 2830210068,
  },
];

// Résumé attendu de `fuzzSummary(hurdles, 1, 300)` : 300 journaux pseudo-aléatoires rejoués.
export const HURDLES_FUZZ = { from: 1, count: 300, summary: 3179071359 } as const;
