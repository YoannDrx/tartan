// Prix par modèle, en dollars par million de jetons : le seul endroit où ils sont écrits.
// Lus le 21 novembre 2026 sur la page « Pricing » d'OpenAI (https://platform.openai.com/docs/pricing, tarif
// Standard, contexte court : 272 000 jetons d'entrée au plus) et recoupés avec les pages des modèles
// (https://platform.openai.com/docs/models/gpt-6.2-sol, gpt-6.1-terra, gpt-6-luna). À RELIRE avant chaque mesure
// réelle : un prix change sans prévenir.
// Depuis GPT-5.6, une écriture en cache se paie 1,25 fois le prix d'entrée (conservation de 30 minutes, guide
// « Prompt caching »), et une lecture 0,05 à 0,1 fois. Chaque jeton d'entrée est compté à un seul de ces tarifs.
// Un modèle absent de la table n'a pas de coût connu : le lanceur s'arrête plutôt que de dépenser sans compter.
export type ModelPrice = {
  inputPerMillion: number;
  // Jetons d'entrée déjà en cache chez le fournisseur, facturés moins cher.
  cachedInputPerMillion: number;
  outputPerMillion: number;
  // Jetons d'entrée écrits en cache par cette demande. Absent : le modèle ne facture pas l'écriture.
  cacheWritePerMillion?: number;
};

export const PRICES_STATUS = "lus le 21 novembre 2026 sur platform.openai.com/docs/pricing (Standard)";

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  // Gamme courante.
  "gpt-6.2-astra": { inputPerMillion: 8, cachedInputPerMillion: 0.4, outputPerMillion: 40, cacheWritePerMillion: 10 },
  "gpt-6.2-sol": { inputPerMillion: 2, cachedInputPerMillion: 0.1, outputPerMillion: 10, cacheWritePerMillion: 2.5 },
  "gpt-6.1-sol": { inputPerMillion: 2, cachedInputPerMillion: 0.1, outputPerMillion: 10, cacheWritePerMillion: 2.5 },
  "gpt-6.1-terra": {
    inputPerMillion: 1,
    cachedInputPerMillion: 0.05,
    outputPerMillion: 5,
    cacheWritePerMillion: 1.25,
  },
  "gpt-6-luna": {
    inputPerMillion: 0.1,
    cachedInputPerMillion: 0.01,
    outputPerMillion: 0.5,
    cacheWritePerMillion: 0.125,
  },
  "gpt-6-sol": { inputPerMillion: 2, cachedInputPerMillion: 0.2, outputPerMillion: 10, cacheWritePerMillion: 2.5 },
  "gpt-6-astra": { inputPerMillion: 10, cachedInputPerMillion: 1, outputPerMillion: 50, cacheWritePerMillion: 12.5 },
  "gpt-5.6-sol": { inputPerMillion: 4, cachedInputPerMillion: 0.4, outputPerMillion: 20, cacheWritePerMillion: 5 },
  "gpt-5.6-terra": { inputPerMillion: 2, cachedInputPerMillion: 0.2, outputPerMillion: 12, cacheWritePerMillion: 2.5 },
  "gpt-5.6-luna": {
    inputPerMillion: 0.2,
    cachedInputPerMillion: 0.02,
    outputPerMillion: 1.2,
    cacheWritePerMillion: 0.25,
  },
  // Dépréciés, arrêtés le 14 janvier 2027 (page « Deprecations ») : gardés pour relire les anciens rapports.
  "gpt-4.1": { inputPerMillion: 2, cachedInputPerMillion: 0.5, outputPerMillion: 8 },
  "gpt-4.1-mini": { inputPerMillion: 0.4, cachedInputPerMillion: 0.1, outputPerMillion: 1.6 },
};

/** Le prix d'un modèle, sous son nom exact ou suivi de sa date de version (`gpt-4.1-2025-04-14`). */
export function priceOf(model: string): ModelPrice | null {
  const name = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return MODEL_PRICES[name] ?? null;
}

export type TokenUsage = {
  model: string;
  // Tous les jetons d'entrée, lectures et écritures en cache comprises.
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  // Jetons d'entrée écrits en cache. Absent des anciens rapports.
  cacheWriteTokens?: number;
};

/** Coût en dollars d'un appel, ou `null` si le modèle n'est pas dans la table. */
export function costOf(usage: TokenUsage): number | null {
  const price = priceOf(usage.model);
  if (!price) return null;
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const written = Math.min(usage.cacheWriteTokens ?? 0, usage.inputTokens - cached);
  return (
    ((usage.inputTokens - cached - written) * price.inputPerMillion +
      cached * price.cachedInputPerMillion +
      written * (price.cacheWritePerMillion ?? price.inputPerMillion) +
      usage.outputTokens * price.outputPerMillion) /
    1e6
  );
}

/** Somme de coûts : `null` dès qu'un seul est inconnu, pour ne jamais afficher un total trop bas. */
export const sumCosts = (costs: readonly (number | null)[]): number | null =>
  costs.some((cost) => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + cost!, 0);
