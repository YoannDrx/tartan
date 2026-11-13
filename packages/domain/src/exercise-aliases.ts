// Normalisation typographique seulement : aucune distance de nom, traduction
// ou rapprochement de variante n'est utilisé pour affecter un exercice.
export const normalizeExerciseTerm = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/\s+/g, " ");

// Inflections used only to recognize mentions, never to merge catalog records.
// Keep all movement qualifiers (direction, height, grip and equipment).
export const normalizeExerciseMention = (value: string) =>
  normalizeExerciseTerm(value)
    .replace(/['-]/g, " ")
    .replace(/\ben\s+/g, "")
    .replace(/[\p{L}]+/gu, (word) => (word.length > 3 ? word.replace(/s$/, "") : word))
    .replace(/\s+/g, " ")
    .trim();

export function cleanExerciseAliases(name: string, aliases: readonly string[]): string[] {
  const seen = new Set([normalizeExerciseTerm(name)]);
  return aliases
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter((value) => {
      const key = normalizeExerciseTerm(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Toutes les correspondances restent présentes en cas de collision, y compris
// un alias identique au nom d'une autre fiche. Le modèle doit alors clarifier.
export function ambiguousExerciseTerms(
  exercises: readonly { token: string; name: string; aliases: readonly string[] }[],
) {
  const terms = new Map<string, { label: string; tokens: Set<string> }>();
  for (const exercise of exercises)
    for (const label of [exercise.name, ...exercise.aliases]) {
      const key = normalizeExerciseMention(label);
      if (!key) continue;
      const entry = terms.get(key) ?? { label, tokens: new Set<string>() };
      entry.tokens.add(exercise.token);
      terms.set(key, entry);
    }
  return [...terms.values()]
    .filter((entry) => entry.tokens.size > 1)
    .map((entry) => ({ term: entry.label, exerciseTokens: [...entry.tokens].sort() }));
}

// Une occurrence d'un nom long prime sur les termes qu'elle contient :
// « front squat » ne devient pas le « squat » partagé entre deux variantes.
// Ce contrôle typographique ne prétend pas interpréter une négation ou le sens
// de la consigne ; ces situations restent dans le corpus d'évaluation du modèle.
export function unresolvedExerciseAlias(
  instruction: string,
  selectedToken: string,
  exercises: readonly { token: string; name: string; aliases: readonly string[] }[],
  resolutions: readonly { term: string; token: string }[] = [],
) {
  const text = normalizeExerciseMention(instruction);
  const terms = new Map<string, Set<string>>();
  for (const e of exercises)
    for (const label of [e.name, ...e.aliases]) {
      const key = normalizeExerciseMention(label);
      if (key) terms.set(key, new Set([...(terms.get(key) ?? []), e.token]));
    }
  const resolved = new Map(resolutions.map((choice) => [normalizeExerciseMention(choice.term), choice.token]));
  for (const [term, token] of resolved)
    if (exercises.some((exercise) => exercise.token === token)) terms.set(term, new Set([token]));
  const matches: { start: number; end: number; term: string; tokens: Set<string> }[] = [];
  for (const [term, tokens] of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu");
    for (const match of text.matchAll(pattern))
      matches.push({ start: match.index, end: match.index + match[0].length, term, tokens });
  }
  const specific = matches.filter(
    (hit) =>
      !matches.some(
        (other) => other.start <= hit.start && other.end >= hit.end && other.end - other.start > hit.end - hit.start,
      ),
  );
  const contradicted = specific.find((hit) => resolved.has(hit.term) && !hit.tokens.has(selectedToken));
  if (contradicted) return { term: contradicted.term, exerciseTokens: [...contradicted.tokens] };
  if (specific.some((hit) => hit.tokens.size === 1 && hit.tokens.has(selectedToken))) return null;
  const ambiguous = specific.find((hit) => hit.tokens.size > 1 && hit.tokens.has(selectedToken));
  return ambiguous ? { term: ambiguous.term, exerciseTokens: [...ambiguous.tokens].sort() } : null;
}
