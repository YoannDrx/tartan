import type { SequenceNode, SessionDraft } from "@tartan/contracts";
import { remapSequence } from "./session-sequence";

type Block = SessionDraft["blocks"][number];
export const sequenceNodeRef = (node: SequenceNode): string => (node.kind === "exercise" ? node.itemRef : node.ref);
export const sequenceDepth = (nodes: SequenceNode[]): number =>
  Math.max(0, ...nodes.map((node) => (node.kind === "repeat" ? 1 + sequenceDepth(node.children) : 0)));

export type SequenceEdit =
  | { kind: "append"; node: SequenceNode; item?: Block["items"][number] }
  | { kind: "insert"; at: number; node: SequenceNode; item?: Block["items"][number] }
  | { kind: "move"; ref: string; delta: -1 | 1 }
  | { kind: "remove"; ref: string }
  | { kind: "unwrap"; ref: string }
  | { kind: "duplicate"; ref: string }
  | { kind: "update"; ref: string; node: SequenceNode }
  | { kind: "repeatAll"; ref: string; name: string };

// Commandes communes au web et au natif. Le parent désigne le groupe contenant
// l'élément ; null désigne la phase. Aucun changement d'identité lors d'un déplacement.
export function editSessionSequence(
  block: Block,
  parent: string | null,
  edit: SequenceEdit,
  newRef: () => string,
): Block {
  let items = [...block.items];
  let found = false;
  const sources = (nodes: SequenceNode[]): string[] =>
    nodes.flatMap((node) =>
      node.kind === "exercise" ? [node.itemRef] : node.kind === "repeat" ? sources(node.children) : [],
    );
  const apply = (nodes: SequenceNode[], depth: number): SequenceNode[] => {
    found = true;
    const index = "ref" in edit ? nodes.findIndex((node) => sequenceNodeRef(node) === edit.ref) : -1;
    const node = nodes[index];
    const next = [...nodes];
    if (edit.kind === "append") {
      if (edit.item) items.push(edit.item);
      next.push(edit.node);
    } else if (edit.kind === "insert") {
      if (edit.item) items.push(edit.item);
      next.splice(Math.max(0, Math.min(edit.at, next.length)), 0, edit.node);
    } else if (edit.kind === "repeatAll") {
      if (!nodes.length) return nodes;
      next.splice(0, next.length, {
        kind: "repeat",
        ref: edit.ref,
        name: edit.name,
        rounds: 3,
        restBetweenRoundsS: 0,
        children: nodes,
      } as SequenceNode);
    } else if (node) {
      if (edit.kind === "move") {
        const target = index + edit.delta;
        if (target < 0 || target >= nodes.length) return nodes;
        next.splice(index, 1);
        next.splice(target, 0, node);
      } else if (edit.kind === "remove") {
        const removed = new Set(sources([node]));
        items = items.filter((item) => !removed.has(item.ref!));
        next.splice(index, 1);
      } else if (edit.kind === "unwrap" && node.kind === "repeat") next.splice(index, 1, ...node.children);
      else if (edit.kind === "update") next[index] = edit.node;
      else if (edit.kind === "duplicate") {
        const copied = new Map(sources([node]).map((ref) => [ref, newRef()]));
        items.push(
          ...items
            .filter((item) => copied.has(item.ref!))
            .map((item) => ({ ...item, ref: copied.get(item.ref!)!, prescription: { ...item.prescription } })),
        );
        next.splice(index + 1, 0, ...remapSequence([node], copied, newRef));
      }
    }
    if (depth + sequenceDepth(next) > 2) throw new Error("sequence_depth_exceeded");
    return next;
  };
  const walk = (nodes: SequenceNode[], depth: number): SequenceNode[] =>
    nodes.map((node): SequenceNode => {
      if (node.kind !== "repeat") return node;
      const children = node.ref === parent ? apply(node.children, depth + 1) : walk(node.children, depth + 1);
      return { ...node, children } as SequenceNode;
    });
  const current = block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! }));
  const sequence = parent === null ? apply(current, 0) : walk(current, 0);
  if (!found) throw new Error("sequence_parent_missing");
  return { ...block, items, sequence };
}

/** Upgrade editing structure without changing the order or prescription of legacy content. */
export function withSessionSequences(draft: SessionDraft): SessionDraft {
  return {
    ...draft,
    structureVersion: 2,
    blocks: draft.blocks.map((block) => ({
      ...block,
      sequence: block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! })),
    })),
  };
}

/** Move a definition to another phase, preserving its ref and removing empty groups left behind. */
export function moveSequenceExercise(draft: SessionDraft, itemRef: string, targetBlockRef: string): SessionDraft {
  const source = draft.blocks.find((block) => block.items.some((item) => item.ref === itemRef));
  const target = draft.blocks.find((block) => block.ref === targetBlockRef);
  const item = source?.items.find((item) => item.ref === itemRef);
  if (!item || !target || source === target || target.items.length >= 60) return draft;
  const remove = (nodes: SequenceNode[]): SequenceNode[] =>
    nodes.flatMap((node): SequenceNode[] => {
      if (node.kind === "exercise") return node.itemRef === itemRef ? [] : [node];
      if (node.kind === "recovery") return [node];
      const children = remove(node.children);
      return children.length ? [{ ...node, children } as SequenceNode] : [];
    });
  const structured = withSessionSequences(draft);
  return {
    ...structured,
    blocks: structured.blocks.map((block) =>
      block.ref === targetBlockRef
        ? { ...block, items: [...block.items, item], sequence: [...block.sequence!, { kind: "exercise", itemRef }] }
        : { ...block, items: block.items.filter((entry) => entry.ref !== itemRef), sequence: remove(block.sequence!) },
    ),
  };
}

type Prescription = Block["items"][number]["prescription"];

// Dans un groupe à répéter, les tours font les séries : un exercice y entre à une série par tour,
// sans repos entre séries (la récupération du groupe ou un nœud de récupération en tient lieu).
export const prescriptionForGroup = (prescription: Prescription): Prescription => {
  const { rest_s: _rest, ...rest } = prescription;
  return { ...rest, sets: 1 };
};

const exerciseRefs = (nodes: SequenceNode[]): string[] =>
  nodes.flatMap((node) =>
    node.kind === "exercise" ? [node.itemRef] : node.kind === "repeat" ? exerciseRefs(node.children) : [],
  );

const withGroupPrescriptions = (block: Block, refs: string[]): Block => {
  const inGroup = new Set(refs);
  return {
    ...block,
    items: block.items.map((item) =>
      inGroup.has(item.ref!) ? { ...item, prescription: prescriptionForGroup(item.prescription) } : item,
    ),
  };
};

const sequenceOf = (block: Block): SequenceNode[] =>
  block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! }));

/** Où se trouve un élément : le groupe parent (null pour la phase) et sa position. */
export function findSequenceNode(block: Block, ref: string): { parent: string | null; index: number } | null {
  const search = (nodes: SequenceNode[], parent: string | null): { parent: string | null; index: number } | null => {
    for (const [index, node] of nodes.entries()) {
      if (sequenceNodeRef(node) === ref) return { parent, index };
      if (node.kind === "repeat") {
        const found = search(node.children, node.ref);
        if (found) return found;
      }
    }
    return null;
  };
  return search(sequenceOf(block), null);
}

/** Les groupes où un élément peut aller sans dépasser deux niveaux. */
export function sequenceGroups(block: Block): { ref: string; name: string; depth: number }[] {
  const out: { ref: string; name: string; depth: number }[] = [];
  const walk = (nodes: SequenceNode[], depth: number) => {
    for (const node of nodes)
      if (node.kind === "repeat") {
        out.push({ ref: node.ref, name: node.name, depth: depth + 1 });
        walk(node.children, depth + 1);
      }
  };
  walk(sequenceOf(block), 0);
  return out;
}

/**
 * Déplace un élément dans un groupe, hors d'un groupe ou à la racine de la phase, en fin de destination.
 * L'identité ne change pas ; un exercice qui entre dans un groupe passe à une série par tour.
 */
export function moveSequenceNode(block: Block, ref: string, target: string | null): Block {
  const from = findSequenceNode(block, ref);
  if (!from || from.parent === target) return block;
  const found: { node: SequenceNode | null } = { node: null };
  const take = (nodes: SequenceNode[]): SequenceNode[] =>
    nodes.flatMap((node): SequenceNode[] => {
      if (sequenceNodeRef(node) === ref) {
        found.node = node;
        return [];
      }
      return node.kind === "repeat" ? [{ ...node, children: take(node.children) } as SequenceNode] : [node];
    });
  const without = take(sequenceOf(block));
  const node = found.node;
  if (!node) return block;
  // Un groupe ne peut pas entrer dans l'un de ses propres sous-groupes.
  if (target !== null && sequenceRefs(node).has(target)) throw new Error("sequence_move_into_itself");
  const put = (nodes: SequenceNode[], depth: number): SequenceNode[] =>
    nodes.map((entry): SequenceNode => {
      if (entry.kind !== "repeat") return entry;
      if (entry.ref === target) {
        const children = [...entry.children, node];
        if (depth + 1 + sequenceDepth(children) > 2) throw new Error("sequence_depth_exceeded");
        return { ...entry, children } as SequenceNode;
      }
      return { ...entry, children: put(entry.children, depth + 1) } as SequenceNode;
    });
  const sequence = target === null ? [...without, node] : put(without, 0);
  if (sequenceDepth(sequence) > 2) throw new Error("sequence_depth_exceeded");
  const moved = { ...block, sequence };
  return target === null ? moved : withGroupPrescriptions(moved, exerciseRefs([node]));
}

const sequenceRefs = (node: SequenceNode): Set<string> =>
  new Set(node.kind === "repeat" ? node.children.flatMap((child) => [sequenceNodeRef(child), ...sequenceRefs(child)]) : []);

/** Regroupe des éléments voisins d'un même niveau en un groupe à répéter, à la place du premier. */
export function groupSequenceSelection(
  block: Block,
  parent: string | null,
  refs: string[],
  group: { ref: string; name: string; rounds?: number },
): Block {
  const chosen = new Set(refs);
  const wrap = (nodes: SequenceNode[], depth: number): SequenceNode[] => {
    const picked = nodes.filter((node) => chosen.has(sequenceNodeRef(node)));
    if (!picked.length) return nodes;
    const created = {
      kind: "repeat",
      ref: group.ref,
      name: group.name,
      rounds: group.rounds ?? 3,
      restBetweenRoundsS: 0,
      children: picked,
    } as SequenceNode;
    if (depth + sequenceDepth([created]) > 2) throw new Error("sequence_depth_exceeded");
    const first = nodes.findIndex((node) => chosen.has(sequenceNodeRef(node)));
    const rest = nodes.filter((node) => !chosen.has(sequenceNodeRef(node)));
    rest.splice(first, 0, created);
    return rest;
  };
  const walk = (nodes: SequenceNode[], depth: number): SequenceNode[] =>
    nodes.map((node): SequenceNode =>
      node.kind !== "repeat"
        ? node
        : ({
            ...node,
            children: node.ref === parent ? wrap(node.children, depth + 1) : walk(node.children, depth + 1),
          } as SequenceNode),
    );
  const sequence = parent === null ? wrap(sequenceOf(block), 0) : walk(sequenceOf(block), 0);
  const grouped = { ...block, sequence };
  return withGroupPrescriptions(grouped, exerciseRefs(sequence.length ? picked(sequence, group.ref) : []));
}

const picked = (nodes: SequenceNode[], ref: string): SequenceNode[] => {
  for (const node of nodes)
    if (node.kind === "repeat") {
      if (node.ref === ref) return [node];
      const inner = picked(node.children, ref);
      if (inner.length) return inner;
    }
  return [];
};

/** Résumé d'un groupe : tours, séries faites par exercice, et total des séries de travail. */
export function sequenceGroupSummary(
  node: Extract<SequenceNode, { kind: "repeat" }>,
  items: Block["items"],
): { rounds: number; setsPerRound: number | null; totalSets: number } {
  const byRef = new Map(items.map((item) => [item.ref, item]));
  const perRound = (nodes: SequenceNode[]): number[] =>
    nodes.flatMap((child) =>
      child.kind === "exercise"
        ? [byRef.get(child.itemRef)?.prescription.sets ?? 1]
        : child.kind === "repeat"
          ? perRound(child.children).map((sets) => sets * child.rounds)
          : [],
    );
  const sets = perRound(node.children);
  const same = sets.length > 0 && sets.every((value) => value === sets[0]);
  return {
    rounds: node.rounds,
    setsPerRound: same ? sets[0]! : null,
    totalSets: sets.reduce((total, value) => total + value * node.rounds, 0),
  };
}
