// Résolution locale, uniquement à partir du contexte déjà autorisé renvoyé au
// coach. Aucun nom n'est ajouté au contexte envoyé au prestataire.
export function plannerDisplayText(
  text: string,
  context: {
    targets: readonly { token: string; label: string }[];
    exercises: readonly { token: string; name: string }[];
  } | null,
) {
  if (!context) return text;
  const labels = new Map([
    ...context.targets.map((target) => [target.token, target.label] as const),
    ...context.exercises.map((exercise) => [exercise.token, exercise.name] as const),
  ]);
  // Remplacement en une passe : un libellé n'est jamais interprété à son tour,
  // ni tronqué. Les jetons inconnus restent visibles, sans inventer un nom.
  return text.replace(
    /(?<![\p{L}\p{N}_])(?:group|athlete|exercise)_[0-9]+(?![\p{L}\p{N}_])/gu,
    (token) => labels.get(token) ?? token,
  );
}
