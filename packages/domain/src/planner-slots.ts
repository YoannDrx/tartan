import {
  PLANNER_SLOT_PREFIX,
  type PlannerRichInterpretation,
  type PlannerRichSession,
  type PlannerSlotSuggestion,
  type SequenceNode,
} from "@tartan/contracts";

// Emplacement à compléter : un mouvement que le coach a cité et qu'aucune fiche ne décrit. Il garde sa place et sa
// prescription dans la séance ; le coach choisit une fiche, en crée une, ou le retire. Tout se fait ici sans
// modèle : remplir ou retirer un emplacement ne réécrit jamais le reste de la séance.

export const isPlannerSlotToken = (token: string) => token.startsWith(PLANNER_SLOT_PREFIX);

export type PlannerOpenSlot = {
  id: string;
  said: string;
  session: number;
  block: number;
  item: number;
  // Les fiches voisines proposées au coach, en jetons.
  alternatives: string[];
  // De quoi préremplir la création de la fiche.
  suggestion?: PlannerSlotSuggestion;
};

/** Les emplacements encore à compléter, dans l'ordre de la séance. Un même emplacement n'est listé qu'une fois. */
export function plannerOpenSlots(value: Pick<PlannerRichInterpretation, "sessions">): PlannerOpenSlot[] {
  const slots = new Map<string, PlannerOpenSlot>();
  value.sessions.forEach((session, s) =>
    session.blocks.forEach((block, b) =>
      block.items.forEach((item, i) => {
        for (const token of [item.exerciseToken, ...(item.autonomous ? [item.autonomous.exerciseToken] : [])])
          if (isPlannerSlotToken(token) && !slots.has(token))
            slots.set(token, {
              id: token,
              said: item.said ?? token,
              session: s,
              block: b,
              item: i,
              alternatives: item.alternatives ?? [],
              ...(item.suggestion ? { suggestion: item.suggestion } : {}),
            });
      }),
    ),
  );
  return [...slots.values()];
}

/** Le coach a choisi ou créé une fiche : elle prend la place de l'emplacement, la prescription ne bouge pas. */
export function plannerFillSlot(value: PlannerRichInterpretation, slotId: string, token: string) {
  return {
    ...value,
    sessions: value.sessions.map((session) => ({
      ...session,
      blocks: session.blocks.map((block) => ({
        ...block,
        items: block.items.map((item) => {
          const filled =
            item.exerciseToken === slotId
              ? // Une fiche choisie par le coach n'est plus un doute : ni « À vérifier », ni autres propositions.
                (({ alternatives: _alternatives, suggestion: _suggestion, ...rest }) => ({
                  ...rest,
                  exerciseToken: token,
                  confidence: "exact" as const,
                }))(item)
              : item;
          return filled.autonomous?.exerciseToken === slotId
            ? { ...filled, autonomous: { ...filled.autonomous, exerciseToken: token } }
            : filled;
        }),
      })),
    })),
  };
}

type Block = PlannerRichSession["blocks"][number];
// Un tour qui ne contient plus aucun exercice disparaît avec lui : une récupération seule ne se répète pas.
const prune = (nodes: readonly SequenceNode[], removed: ReadonlySet<string>): SequenceNode[] =>
  nodes.flatMap((node): SequenceNode[] => {
    if (node.kind === "exercise") return removed.has(node.itemRef) ? [] : [node];
    if (node.kind === "recovery") return [node];
    const children = prune(node.children, removed);
    return children.some((child) => child.kind !== "recovery") ? [{ ...node, children } as SequenceNode] : [];
  });
function withoutItems(block: Block, drop: (item: Block["items"][number]) => boolean): Block | null {
  if (!block.items.some(drop)) return block;
  const removed = new Set(block.items.filter(drop).flatMap((item) => (item.ref ? [item.ref] : [])));
  const items = block.items.filter((item) => !drop(item));
  const sequence = block.sequence ? prune(block.sequence, removed) : block.sequence;
  if (!items.length) return null;
  // Une séquence réduite à ses exercices, sans tour ni pause, redevient une simple liste.
  return { ...block, items, sequence: sequence?.some((node) => node.kind !== "exercise") ? sequence : null };
}

/**
 * Retire des exercices d'une séance en gardant l'ordre du reste ; un bloc vidé disparaît. Les points « À vérifier »
 * suivent leur exercice : ceux d'un exercice retiré partent avec lui.
 */
export function plannerDropItems(
  session: PlannerRichSession,
  drop: (item: Block["items"][number]) => boolean,
): PlannerRichSession {
  const blocks: Block[] = [];
  // Ancienne position (bloc, exercice) → nouvelle position.
  const moved = new Map<string, { block: number; item: number }>();
  const movedBlocks = new Map<number, number>();
  session.blocks.forEach((block, b) => {
    const kept = withoutItems(block, drop);
    if (!kept) return;
    let at = 0;
    block.items.forEach((item, i) => {
      if (!drop(item)) moved.set(`${b}:${i}`, { block: blocks.length, item: at++ });
    });
    movedBlocks.set(b, blocks.length);
    blocks.push(kept);
  });
  const warnings = (session.warnings ?? []).flatMap((warning) => {
    if (warning.block === null) return [warning];
    if (warning.item === null)
      return movedBlocks.has(warning.block) ? [{ ...warning, block: movedBlocks.get(warning.block)! }] : [];
    const place = moved.get(`${warning.block}:${warning.item}`);
    return place ? [{ ...warning, ...place }] : [];
  });
  return { ...session, blocks, ...(session.warnings ? { warnings } : {}) };
}

/**
 * Le coach retire l'emplacement : l'exercice quitte la séance, le reste ne bouge pas. `null` si cela viderait une
 * séance : une séance sans exercice ne se crée pas, il faut alors choisir une fiche.
 */
export function plannerRemoveSlot(value: PlannerRichInterpretation, slotId: string): PlannerRichInterpretation | null {
  const sessions = value.sessions.map((session) => {
    const cleared = {
      ...session,
      blocks: session.blocks.map((block) => ({
        ...block,
        // Un emplacement de remplacement en autonomie : seul le remplacement disparaît.
        items: block.items.map((item) =>
          item.autonomous?.exerciseToken === slotId ? { ...item, autonomous: null } : item,
        ),
      })),
    };
    return plannerDropItems(cleared, (item) => item.exerciseToken === slotId);
  });
  return sessions.some((session) => !session.blocks.length) ? null : { ...value, sessions };
}

export type PlannerItemPlace = { session: number; block: number; item: number };

/** La place d'un exercice dans la séance gardée, d'après sa référence dans les brouillons préparés. */
export function plannerDraftItemPlace(ref: string, prefix: string): PlannerItemPlace | null {
  if (!ref.startsWith(`${prefix}-`)) return null;
  const place = /^(\d+)-b(\d+)-i(\d+)$/.exec(ref.slice(prefix.length + 1));
  return place ? { session: Number(place[1]), block: Number(place[2]), item: Number(place[3]) } : null;
}

/** L'exercice dont la fiche est « À vérifier » à cette place, s'il y en a un. */
export function plannerProbableItem(value: Pick<PlannerRichInterpretation, "sessions">, place: PlannerItemPlace) {
  const item = value.sessions[place.session]?.blocks[place.block]?.items[place.item];
  return item && item.confidence === "probable" && !isPlannerSlotToken(item.exerciseToken) ? item : null;
}

/**
 * Le coach a tranché sur une fiche « À vérifier » : il la valide, ou en choisit une autre. Elle n'est plus un
 * doute ; la prescription ne bouge pas, et le point « À vérifier » sur sa fiche disparaît.
 */
export function plannerSettleProbable(
  value: PlannerRichInterpretation,
  place: PlannerItemPlace,
  token: string,
): PlannerRichInterpretation {
  return {
    ...value,
    sessions: value.sessions.map((session, s) =>
      s !== place.session
        ? session
        : {
            ...session,
            blocks: session.blocks.map((block, b) =>
              b !== place.block
                ? block
                : {
                    ...block,
                    items: block.items.map((item, i) =>
                      i !== place.item
                        ? item
                        : (({ alternatives: _alternatives, ...rest }) => ({
                            ...rest,
                            exerciseToken: token,
                            confidence: "exact" as const,
                          }))(item),
                    ),
                  },
            ),
            ...(session.warnings
              ? {
                  warnings: session.warnings.filter(
                    (warning) =>
                      warning.code !== "approximate_exercise" ||
                      warning.block !== place.block ||
                      warning.item !== place.item,
                  ),
                }
              : {}),
          },
    ),
  };
}
