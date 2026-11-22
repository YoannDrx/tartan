import "server-only";
import { plannerMatchGeneration, type PlannerMatch } from "@tartan/contracts";
import { plannerMatchShortlist, plannerModelMatches, plannerRuleMatches } from "@tartan/domain";
import { plannerStep } from "./step";
import type { PlannerMatchInput, PlannerProvider, PlannerProviderContext } from "./types";

export type PlannerMatchMovement = { id: string; said: string; prescription: string | null; session?: number };

/**
 * Étape 2, « Retrouver » : à chaque mouvement cité, une fiche. Dans l'ordre : alias appris de l'espace, nom
 * exact, alias exact, puis un seul appel au modèle rapide pour tout ce qui reste, sur toute la bibliothèque (ou
 * son préfiltre au-delà de 600 fiches), réduite à cinq champs par fiche.
 */
export async function matchMovements(
  context: Pick<PlannerProviderContext, "exercises" | "learnedAliases" | "resolvedExercises">,
  movements: readonly PlannerMatchMovement[],
  provider: PlannerProvider,
  deadline: AbortSignal,
): Promise<PlannerMatch[]> {
  if (!movements.length) return [];
  // Un choix fait pendant cette demande passe devant un alias appris plus ancien.
  const learned = [...(context.learnedAliases ?? []), ...(context.resolvedExercises ?? [])];
  const rules = plannerRuleMatches(movements, context.exercises, learned);
  const found = new Map(rules.matches.map((match) => [match.id, match]));
  if (rules.remaining.length) {
    const shortlist = plannerMatchShortlist(
      rules.remaining.map((movement) => movement.said),
      context.exercises,
    );
    // Ordre stable d'une demande à l'autre : le début de l'entrée reste le même, donc en cache chez le fournisseur.
    const ordered = [...shortlist].sort(
      (a, b) => a.name.localeCompare(b.name, "fr") || a.token.localeCompare(b.token, "en", { numeric: true }),
    );
    const keys = new Map(ordered.map((exercise, index) => [`f${index + 1}`, exercise.token]));
    const prescriptions = new Map(movements.map((movement) => [movement.id, movement.prescription]));
    // Les mentions voisines, dans la même séance : une mention elliptique (« en rotation ») s'y complète.
    const near = (id: string) => {
      const at = movements.findIndex((movement) => movement.id === id);
      const session = movements[at]?.session;
      return movements
        .slice(Math.max(0, at - 3), at + 3)
        .filter((movement) => movement.id !== id && movement.session === session)
        .map((movement) => movement.said);
    };
    const input: PlannerMatchInput = {
      movements: rules.remaining.map((movement) => ({
        id: movement.id,
        said: movement.said,
        prescription: prescriptions.get(movement.id) ?? null,
        near: near(movement.id),
      })),
      library: ordered.map((exercise, index) => ({
        key: `f${index + 1}`,
        name: exercise.name,
        aliases: exercise.aliases.slice(0, 8),
        family: exercise.family ?? null,
        equipment: exercise.classification?.equipment ?? null,
      })),
    };
    const answer = await plannerStep("match", deadline, plannerMatchGeneration, (signal) =>
      provider.match(input, { signal }),
    );
    for (const match of plannerModelMatches(rules.remaining, answer, keys)) found.set(match.id, match);
  }
  return movements.map((movement) => found.get(movement.id)!);
}
