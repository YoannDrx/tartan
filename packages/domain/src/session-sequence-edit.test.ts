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
