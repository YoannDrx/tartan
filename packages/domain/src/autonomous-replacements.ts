import type { SequenceNode, SessionDraft } from "@tartan/contracts";
import { withSessionRefs } from "./session-identity";

type Block = SessionDraft["blocks"][number];
const SUFFIX = "-auto";

/** La référence de la copie « autonomie » d'un élément : stable d'une publication à l'autre, bornée à 64 signes. */
export const autonomousRef = (ref: string): string => `${ref.slice(0, 64 - SUFFIX.length)}${SUFFIX}`;

const remap = (nodes: SequenceNode[]): SequenceNode[] =>
  nodes.map((node): SequenceNode => {
    if (node.kind === "exercise") return { ...node, itemRef: autonomousRef(node.itemRef) };
    if (node.kind === "recovery") return { ...node, ref: autonomousRef(node.ref) };
    return { ...node, ref: autonomousRef(node.ref), children: remap(node.children) } as SequenceNode;
  });

/** Un bloc commun dont au moins un exercice change pour les athlètes en autonomie. */
export const hasAutonomousReplacement = (block: Pick<Block, "variant" | "items">): boolean =>
  block.variant === "both" && block.items.some((item) => item.autonomous);

const withoutReplacement = (item: Block["items"][number]): Block["items"][number] => {
  const { autonomous: _replacement, ...rest } = item;
  return rest;
};

/**
 * Au moment de figer la séance, un bloc commun qui remplace des exercices en autonomie devient deux blocs voisins :
 * la version du club, puis celle de l'autonomie, où chaque élément prend une référence propre. La copie figée garde
 * ainsi son format (blocs club, autonomie, communs) : les applications déjà installées la lisent sans changement.
 */
export function withAutonomousReplacements(draft: SessionDraft): SessionDraft {
  const normalized = withSessionRefs(draft);
  return {
    ...normalized,
    blocks: normalized.blocks.flatMap((block): Block[] => {
      if (!hasAutonomousReplacement(block)) return [{ ...block, items: block.items.map(withoutReplacement) }];
      const club: Block = { ...block, variant: "club", items: block.items.map(withoutReplacement) };
      const autonomous: Block = {
        ...block,
        ref: autonomousRef(block.ref!),
        variant: "autonomous",
        items: block.items.map((item) => ({
          ref: autonomousRef(item.ref!),
          exerciseId: item.autonomous?.exerciseId ?? item.exerciseId,
          prescription: item.autonomous?.prescription ?? item.prescription,
        })),
        ...(block.sequence ? { sequence: remap(block.sequence) } : {}),
      };
      return [club, autonomous];
    }),
  };
}
