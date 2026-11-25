import type { SaveScheduledSessionInput, SessionDraft } from "@tartan/contracts";
import { remapSequence } from "./session-sequence";

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
  blocks: draft.blocks.map((block) => {
    const refs = new Map(block.items.map((item) => [item.ref ?? "", newRef()]));
    return {
      ...block,
      ref: newRef(),
      items: block.items.map((item) => ({ ...item, ref: item.ref ? refs.get(item.ref)! : newRef() })),
      ...(block.sequence ? { sequence: remapSequence(block.sequence, refs, newRef) } : {}),
    };
  }),
});

// Les fiches qu'un brouillon cite, remplacements en autonomie compris.
export const draftExerciseIds = (draft: Pick<SessionDraft, "blocks">) =>
  draft.blocks.flatMap((block) =>
    block.items.flatMap((item) => [item.exerciseId, ...(item.autonomous ? [item.autonomous.exerciseId] : [])]),
  );

type SessionContent = Pick<SaveScheduledSessionInput, "draft" | "overrides">;

// Les ajustements portent sur la définition de l'exercice ou sur un tour précis du circuit.
export function editSessionBlock(
  content: SessionContent,
  blockRef: string,
  action: "duplicate" | "remove",
  newRef: () => string,
): SessionContent {
  const draft = withSessionRefs(content.draft);
  const at = draft.blocks.findIndex((block) => block.ref === blockRef);
  const block = draft.blocks[at];
  if (!block || (action === "duplicate" && draft.blocks.length >= 12)) return content;
  const blocks = [...draft.blocks];
  const copy =
    action === "duplicate" ? copyDraftWithNewRefs({ ...draft, blocks: [block] }, newRef).blocks[0] : undefined;
  if (copy) blocks.splice(at + 1, 0, copy);
  else blocks.splice(at, 1);
  const refs = new Map(block.items.map((item, i) => [item.ref!, copy?.items[i]?.ref]));
  const overrides = content.overrides.flatMap((override) => {
    const occurrence = /^seq:([^:]+):(.+)$/.exec(override.itemRef);
    const ref = occurrence?.[1] ?? override.itemRef;
    if (!refs.has(ref)) return [override];
    const replacement = refs.get(ref);
    if (!replacement) return [];
    return [override, { ...override, itemRef: occurrence ? `seq:${replacement}:${occurrence[2]}` : replacement }];
  });
  return { draft: { ...draft, blocks }, overrides };
}
