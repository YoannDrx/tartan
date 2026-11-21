// Prix par modèle, en dollars par million de jetons : le seul endroit où ils sont écrits.
// À RELIRE DANS LA DOCUMENTATION DU FOURNISSEUR avant chaque mesure réelle : ces valeurs sont recopiées de mémoire
// des tarifs publics d'OpenAI et n'ont pas été relues le jour où ce fichier a été écrit (21 novembre 2026).
// Un modèle absent de la table n'a pas de coût connu : le lanceur s'arrête plutôt que de dépenser sans compter.
export type ModelPrice = {
  inputPerMillion: number;
  // Jetons d'entrée déjà en cache chez le fournisseur, facturés moins cher.
  cachedInputPerMillion: number;
  outputPerMillion: number;
};

export const PRICES_STATUS = "à relire dans la documentation du fournisseur";

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  // À relire dans la documentation du fournisseur.
  "gpt-4.1": { inputPerMillion: 2, cachedInputPerMillion: 0.5, outputPerMillion: 8 },
  // À relire dans la documentation du fournisseur.
  "gpt-4.1-mini": { inputPerMillion: 0.4, cachedInputPerMillion: 0.1, outputPerMillion: 1.6 },
  // À relire dans la documentation du fournisseur.
  "gpt-4.1-nano": { inputPerMillion: 0.1, cachedInputPerMillion: 0.025, outputPerMillion: 0.4 },
  // À relire dans la documentation du fournisseur.
  "gpt-5": { inputPerMillion: 1.25, cachedInputPerMillion: 0.125, outputPerMillion: 10 },
  // À relire dans la documentation du fournisseur.
  "gpt-5-mini": { inputPerMillion: 0.25, cachedInputPerMillion: 0.025, outputPerMillion: 2 },
  // À relire dans la documentation du fournisseur.
  "gpt-5-nano": { inputPerMillion: 0.05, cachedInputPerMillion: 0.005, outputPerMillion: 0.4 },
};

/** Le prix d'un modèle, sous son nom exact ou suivi de sa date de version (`gpt-4.1-2025-04-14`). */
export function priceOf(model: string): ModelPrice | null {
  const name = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return MODEL_PRICES[name] ?? null;
}

export type TokenUsage = {
  model: string;
  // Tous les jetons d'entrée, cache compris.
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/** Coût en dollars d'un appel, ou `null` si le modèle n'est pas dans la table. */
export function costOf(usage: TokenUsage): number | null {
  const price = priceOf(usage.model);
  if (!price) return null;
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  return (
    ((usage.inputTokens - cached) * price.inputPerMillion +
      cached * price.cachedInputPerMillion +
      usage.outputTokens * price.outputPerMillion) /
    1e6
  );
}

/** Somme de coûts : `null` dès qu'un seul est inconnu, pour ne jamais afficher un total trop bas. */
export const sumCosts = (costs: readonly (number | null)[]): number | null =>
  costs.some((cost) => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + cost!, 0);
