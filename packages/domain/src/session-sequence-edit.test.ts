import { expect, it } from "vitest";
import type { SessionDraft } from "@tartan/contracts";
import { editSessionSequence, sequenceNodeRef } from "./session-sequence-edit";
const block = (): SessionDraft["blocks"][number] => ({
  ref: "phase",
  name: "Force",
  variant: "club",
  items: ["a", "b"].map((ref) => ({ ref, exerciseId: ref, prescription: { sets: 1 } })),
});
let count = 0;
const id = () => `copy-${++count}`;
it("groupe, déplace, duplique puis dissocie sans perdre les liens ni modifier la source", () => {
  const source = block();
  const grouped = editSessionSequence(source, null, { kind: "repeatAll", ref: "g", name: "Superset" }, id);
  const moved = editSessionSequence(grouped, "g", { kind: "move", ref: "b", delta: -1 }, id);
  const duplicated = editSessionSequence(moved, null, { kind: "duplicate", ref: "g" }, id);
  expect(duplicated.items).toHaveLength(4);
  const flat = editSessionSequence(duplicated, null, { kind: "unwrap", ref: "g" }, id);
  expect(flat.sequence?.slice(0, 2).map(sequenceNodeRef)).toEqual(["b", "a"]);
  const last = flat.sequence!.at(-1)!;
  const removed = editSessionSequence(flat, null, { kind: "remove", ref: sequenceNodeRef(last) }, id);
  expect(removed.items.map((i) => i.ref)).toEqual(["a", "b"]);
  expect(source).toEqual(block());
});
it("borne l'imbrication même quand on regroupe une structure déjà imbriquée", () => {
  const first = editSessionSequence(block(), null, { kind: "repeatAll", ref: "g", name: "Tours" }, id);
  const second = editSessionSequence(first, null, { kind: "repeatAll", ref: "h", name: "Tours" }, id);
  expect(() => editSessionSequence(second, null, { kind: "repeatAll", ref: "i", name: "Tours" }, id)).toThrow(
    "sequence_depth_exceeded",
  );
  expect(() => editSessionSequence(second, "g", { kind: "repeatAll", ref: "i", name: "Tours" }, id)).toThrow(
    "sequence_depth_exceeded",
  );
});

it("déplace une définition imbriquée sans laisser de référence orpheline ni changer la prescription", async () => {
  const { moveSequenceExercise, withSessionSequences } = await import("./session-sequence-edit");
  const { validSessionStructure, sequenceOccurrences } = await import("./session-sequence");
  const source = block();
  source.items = source.items.map((item, index) => ({
    ...item,
    exerciseId: `00000000-0000-4000-8000-00000000000${index + 1}`,
  }));
  const grouped = editSessionSequence(source, null, { kind: "repeatAll", ref: "group", name: "Duo" }, id);
  const draft: SessionDraft = withSessionSequences({
    title: "Circuit",
    type: "strength",
    durationMin: null,
    coachNote: null,
    blocks: [grouped, { ref: "target", name: "Suite", variant: "club", items: [] }],
  });
  const moved = moveSequenceExercise(draft, "a", "target");
  expect(validSessionStructure(moved)).toBe(true);
  expect(moved.blocks[1]!.items[0]).toEqual(source.items[0]);
  expect(sequenceOccurrences(moved.blocks[0]!.sequence!).map((step) => step.node)).toEqual(
    Array(3).fill({ kind: "exercise", itemRef: "b" }),
  );
  const emptied = moveSequenceExercise(moved, "b", "target");
  expect(emptied.blocks[0]!.sequence).toEqual([]);
  expect(validSessionStructure(emptied)).toBe(true);
  expect(draft.blocks[0]!.items).toHaveLength(2);
  expect(moveSequenceExercise(draft, "missing", "target")).toBe(draft);
  expect(moveSequenceExercise(draft, "a", "phase")).toBe(draft);
});

it("insère à l'emplacement choisi, au milieu d'un niveau", () => {
  const source = block();
  const inserted = editSessionSequence(
    source,
    null,
    { kind: "insert", at: 1, node: { kind: "recovery", ref: "pause", durationS: 30 } },
    id,
  );
  expect(inserted.sequence!.map(sequenceNodeRef)).toEqual(["a", "pause", "b"]);
});

it("un exercice qui entre dans un groupe passe à une série par tour, sans repos entre séries", async () => {
  const { groupSequenceSelection, moveSequenceNode, sequenceGroupSummary, findSequenceNode } = await import(
    "./session-sequence-edit"
  );
  const source = block();
  source.items = [
    { ref: "a", exerciseId: "a", prescription: { sets: 4, reps: 5, rest_s: 150 } },
    { ref: "b", exerciseId: "b", prescription: { sets: 3, reps: 8 } },
    { ref: "c", exerciseId: "c", prescription: { sets: 2, reps: 10, rest_s: 60 } },
  ];
  const grouped = groupSequenceSelection(source, null, ["a", "b"], { ref: "g", name: "Superset" });
  expect(grouped.sequence!.map(sequenceNodeRef)).toEqual(["g", "c"]);
  expect(grouped.items.find((i) => i.ref === "a")!.prescription).toEqual({ sets: 1, reps: 5 });
  expect(grouped.items.find((i) => i.ref === "c")!.prescription).toEqual(source.items[2]!.prescription);
  const group = grouped.sequence![0]! as Extract<NonNullable<typeof grouped.sequence>[number], { kind: "repeat" }>;
  expect(sequenceGroupSummary(group, grouped.items)).toEqual({ rounds: 3, setsPerRound: 1, totalSets: 6 });

  const moved = moveSequenceNode(grouped, "c", "g");
  expect(findSequenceNode(moved, "c")).toEqual({ parent: "g", index: 2 });
  expect(moved.items.find((i) => i.ref === "c")!.prescription).toEqual({ sets: 1, reps: 10 });
  const out = moveSequenceNode(moved, "a", null);
  expect(out.sequence!.map(sequenceNodeRef)).toEqual(["g", "a"]);
  expect(source.items[0]!.prescription).toEqual({ sets: 4, reps: 5, rest_s: 150 });
});

it("refuse un déplacement qui dépasserait deux niveaux ou ferait entrer un groupe en lui-même", async () => {
  const { groupSequenceSelection, moveSequenceNode } = await import("./session-sequence-edit");
  const inner = groupSequenceSelection(block(), null, ["a"], { ref: "inner", name: "A" });
  const outer = groupSequenceSelection(inner, null, ["inner"], { ref: "outer", name: "B" });
  expect(() => moveSequenceNode(outer, "outer", "inner")).toThrow();
  const other = groupSequenceSelection(outer, null, ["b"], { ref: "other", name: "C" });
  expect(() => moveSequenceNode(other, "outer", "other")).toThrow("sequence_depth_exceeded");
});
