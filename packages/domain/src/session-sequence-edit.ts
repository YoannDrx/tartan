import type { SequenceNode, SessionDraft } from "@tartan/contracts";
import { remapSequence } from "./session-sequence";

type Block = SessionDraft["blocks"][number];
export const sequenceNodeRef = (node: SequenceNode): string => (node.kind === "exercise" ? node.itemRef : node.ref);
export const sequenceDepth = (nodes: SequenceNode[]): number =>
  Math.max(0, ...nodes.map((node) => (node.kind === "repeat" ? 1 + sequenceDepth(node.children) : 0)));

export type SequenceEdit =
  | { kind: "append"; node: SequenceNode; item?: Block["items"][number] }
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
