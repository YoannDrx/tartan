import { expect, it } from "vitest";
import type { SessionDraft } from "@tartan/contracts";
import { copyDraftWithNewRefs, editSessionBlock, hasUniqueSessionRefs, withSessionRefs } from "./session-identity";

const draft: SessionDraft = {
  title: "Force",
  type: "strength",
  durationMin: null,
  coachNote: null,
  blocks: [
    {
      name: "Bloc",
      variant: "both",
      items: [
        { exerciseId: "squat", prescription: { reps: 4 } },
        { exerciseId: "squat", prescription: { reps: 8 } },
      ],
    },
  ],
};

it("distingue deux occurrences du même exercice et conserve leur identité après déplacement", () => {
  const saved = withSessionRefs(draft);
  saved.blocks[0]!.items.reverse();
  expect(withSessionRefs(saved).blocks[0]?.items.map((i) => i.ref)).toEqual(["b0-i1", "b0-i0"]);
  expect(draft.blocks[0]?.items[0]?.ref).toBeUndefined();
});

it("un modèle appliqué de nouveau ne réutilise pas les identités et garde la variante partagée", () => {
  let seq = 0;
  const newRef = () => `new-${++seq}`;
  const a = copyDraftWithNewRefs(draft, newRef);
  const b = copyDraftWithNewRefs(a, newRef);
  expect(a.blocks[0]?.variant).toBe("both");
  expect(a.blocks[0]?.items[0]?.ref).not.toBe(b.blocks[0]?.items[0]?.ref);
  expect(hasUniqueSessionRefs(a)).toBe(true);
});

it("détecte aussi une collision entre référence explicite et référence historique implicite", () => {
  const invalid = structuredClone(draft);
  invalid.blocks[0]!.items[0]!.ref = "b0-i1";
  expect(hasUniqueSessionRefs(invalid)).toBe(false);
});

it("duplique le circuit et les charges de chaque tour, puis retire leur copie indépendamment", () => {
  let i = 0;
  const fresh = () => `new-${++i}`;
  const source = withSessionRefs(draft);
  const block = source.blocks[0]!;
  block.sequence = [
    {
      kind: "repeat",
      ref: "c",
      restBetweenRoundsS: 0,
      name: "Circuit",
      rounds: 2,
      children: block.items.map((item) => ({ kind: "exercise", itemRef: item.ref! })),
    },
  ];
  const original = {
    draft: { ...source, structureVersion: 2 as const },
    overrides: [{ athleteId: "a", itemRef: "seq:b0-i0:2", prescription: { reps: 6 } }],
  };
  const doubled = editSessionBlock(original, block.ref!, "duplicate", fresh);
  const copy = doubled.draft.blocks[1]!;
  expect(copy.variant).toBe("both");
  expect(copy.sequence?.[0]).toMatchObject({
    kind: "repeat",
    ref: expect.not.stringMatching(/^c$/),
    children: copy.items.map((item) => ({ kind: "exercise", itemRef: item.ref })),
  });
  expect(doubled.overrides[1]).toMatchObject({ itemRef: `seq:${copy.items[0]!.ref}:2`, prescription: { reps: 6 } });
  expect(editSessionBlock(doubled, copy.ref!, "remove", fresh)).toEqual(original);
});
