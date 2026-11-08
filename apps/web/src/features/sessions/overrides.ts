type Block = { items: readonly { key: string }[] };
type ReferencedOverride<P> = { athleteId: string; itemRef: string; prescription: P };
export type KeyedOverride<P> = { athleteId: string; itemKey: string; prescription: P };

// Les clés sont les références persistantes du brouillon, y compris après déplacement.
const refsByKey = (blocks: readonly Block[]): Map<string, string> =>
  new Map(
    blocks
      .filter((block) => block.items.length > 0)
      .flatMap((block) => block.items.map((item) => [item.key, item.key] as const)),
  );

// À l'ouverture : une adaptation suit désormais son exercice, pas sa position.
export const attachItemKeys = <P>(
  overrides: readonly ReferencedOverride<P>[],
  blocks: readonly Block[],
): KeyedOverride<P>[] => {
  const keys = new Map([...refsByKey(blocks)].map(([key, ref]) => [ref, key]));
  return overrides.flatMap(({ athleteId, itemRef, prescription }) => {
    const itemKey = keys.get(itemRef);
    return itemKey ? [{ athleteId, itemKey, prescription }] : [];
  });
};

// L'adaptation d'un exercice retiré disparaît avec lui.
export const overridesForSubmit = <P>(
  overrides: readonly KeyedOverride<P>[],
  blocks: readonly Block[],
): ReferencedOverride<P>[] => {
  const refs = refsByKey(blocks);
  return overrides.flatMap(({ athleteId, itemKey, prescription }) => {
    const itemRef = refs.get(itemKey);
    return itemRef ? [{ athleteId, itemRef, prescription }] : [];
  });
};
