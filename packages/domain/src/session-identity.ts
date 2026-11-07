import type { SessionDraft } from "@tartan/contracts";

// Les anciennes références sont conservées exactement. Une lecture ne réécrit pas la base.
// Une fois ces références enregistrées, elles suivent l'item, jamais sa position.
export const withSessionRefs = (draft: SessionDraft): SessionDraft => ({
  ...draft,
  blocks: draft.blocks.map((block, b) => ({
    ...block,
    ref: block.ref ?? `b${b}`,
    items: block.items.map((item, i) => ({ ...item, ref: item.ref ?? `b${b}-i${i}` })),
  })),
});

export const hasUniqueSessionRefs = (draft: SessionDraft): boolean => {
  const normalized = withSessionRefs(draft);
  const blocks = normalized.blocks.map((b) => b.ref);
  const items = normalized.blocks.flatMap((b) => b.items.map((i) => i.ref));
  return new Set(blocks).size === blocks.length && new Set(items).size === items.length;
};

// Le générateur est fourni par l'appelant (crypto natif/web/serveur).
export const copyDraftWithNewRefs = (draft: SessionDraft, newRef: () => string): SessionDraft => ({
  ...draft,
  blocks: draft.blocks.map((block) => ({
    ...block,
    ref: newRef(),
    items: block.items.map((item) => ({ ...item, ref: newRef() })),
  })),
});
