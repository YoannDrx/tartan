import { expect, it } from "vitest";
import type { SessionDraft } from "@tartan/contracts";
import { copyDraftWithNewRefs, hasUniqueSessionRefs, withSessionRefs } from "./session-identity";

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
