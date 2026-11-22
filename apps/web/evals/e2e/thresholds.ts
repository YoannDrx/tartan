// Seuils de la mesure de bout en bout, écrits le 21 novembre 2026 avant toute réponse du nouveau planificateur.
// Ils s'appliquent à chacun des passages, pas à leur moyenne. Le lanceur les lit ici et sort en code 1 si un seul
// n'est pas tenu. Les changer se décide avec le fondateur, jamais après avoir vu un rapport.
export const E2E_THRESHOLDS = {
  // Fautes graves (date fausse, charge inventée, exercice ajouté, remplacement silencieux) : aucune.
  criticalFaults: 0,
  // Part des cas justes : au moins 95 %.
  caseAccuracy: 0.95,
  // Part des cas `mustNotAsk` arrêtés par une question : au plus 2 %.
  needlessQuestionRate: 0.02,
  // Part des paires justes en premier choix : au moins 97 %.
  pairTop1Accuracy: 0.97,
  // Part des termes `absent` pour lesquels une fiche a été choisie : au plus 1 %.
  absentFalsePositiveRate: 0.01,
  // Premier événement diffusé : médiane strictement sous 2 s.
  firstEventMedianMs: 2000,
  // Séance complète, brouillons préparés : médiane strictement sous 15 s.
  completeMedianMs: 15000,
} as const;
// Une mesure qui qualifie compte trois passages : le modèle varie de l'un à l'autre.
export const E2E_REQUIRED_RUNS = 3;
export type ThresholdKey = keyof typeof E2E_THRESHOLDS;

export type ThresholdVerdict = {
  key: ThresholdKey;
  label: string;
  // `null` : rien à mesurer dans ce passage (aucun cas, aucune paire).
  value: number | null;
  limit: number;
  rule: "max" | "min" | "below";
  ok: boolean | null;
};

export type ThresholdInput = {
  criticalFaults: number | null;
  caseAccuracy: number | null;
  needlessQuestionRate: number | null;
  pairTop1Accuracy: number | null;
  absentFalsePositiveRate: number | null;
  firstEventMedianMs: number | null;
  completeMedianMs: number | null;
};

const RULES: Record<ThresholdKey, { label: string; rule: ThresholdVerdict["rule"] }> = {
  criticalFaults: { label: "Fautes graves", rule: "max" },
  caseAccuracy: { label: "Cas justes", rule: "min" },
  needlessQuestionRate: { label: "Questions inutiles", rule: "max" },
  pairTop1Accuracy: { label: "Paires justes en premier choix", rule: "min" },
  absentFalsePositiveRate: { label: "Fiche choisie pour un terme absent", rule: "max" },
  firstEventMedianMs: { label: "Premier retour diffusé (médiane)", rule: "below" },
  completeMedianMs: { label: "Séance complète (médiane)", rule: "below" },
};

export function checkThresholds(input: ThresholdInput, thresholds = E2E_THRESHOLDS): ThresholdVerdict[] {
  return (Object.keys(RULES) as ThresholdKey[]).map((key) => {
    const { label, rule } = RULES[key];
    const value = input[key],
      limit = thresholds[key];
    const ok =
      value === null ? null : rule === "max" ? value <= limit : rule === "min" ? value >= limit : value < limit;
    return { key, label, value, limit, rule, ok };
  });
}

/** Un passage tient si aucun seuil mesuré n'échoue. Un seuil non mesuré ne vaut pas réussite : voir `complete`. */
export const thresholdsHeld = (verdicts: readonly ThresholdVerdict[]) => verdicts.every((v) => v.ok !== false);
