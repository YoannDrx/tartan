import {
  MAX_SESSION_EXECUTION_STEPS,
  sequenceRef,
  sessionDraft,
  type ExecutionRound,
  type SequenceNode,
  type SessionDraft,
  type SessionSnapshot,
  type SnapshotItem,
} from "@tartan/contracts";

// La séquence référence les exercices du bloc, une fois chacun. Les répétitions
// créent des occurrences, jamais plusieurs définitions d'un même exercice.
export function validSessionStructure(draft: SessionDraft): boolean {
  if (draft.structureVersion !== 2) return draft.blocks.every((b) => b.sequence === undefined);
  if (!sessionDraft.safeParse(draft).success) return false;
  const refs = new Set<string>();
  let steps = 0;
  const claim = (ref: string | undefined): boolean => {
    if (!sequenceRef.safeParse(ref).success || refs.has(ref!)) return false;
    refs.add(ref!);
    return true;
  };
  for (const block of draft.blocks) {
    if (!claim(block.ref) || !block.sequence) return false;
    const items = new Map(block.items.map((item) => [item.ref, item]));
    if (items.size !== block.items.length || block.items.some((item) => !claim(item.ref))) return false;
    const used = new Set<string>();
    const walk = (nodes: SequenceNode[], multiplier: number): boolean => {
      for (const node of nodes) {
        if (node.kind === "exercise") {
          const item = items.get(node.itemRef);
          if (!item || used.has(node.itemRef)) return false;
          used.add(node.itemRef);
          steps += multiplier * (item.prescription.sets ?? 1);
        } else {
          if (!claim(node.ref)) return false;
          if (node.kind === "recovery") steps += multiplier;
          else {
            if (node.restBetweenRoundsS) steps += multiplier * (node.rounds - 1);
            if (!walk(node.children, multiplier * node.rounds)) return false;
          }
        }
        if (steps > MAX_SESSION_EXECUTION_STEPS) return false;
      }
      return true;
    };
    if (!walk(block.sequence, 1) || used.size !== block.items.length) return false;
  }
  return true;
}

export const occurrenceRef = (ref: string, rounds: ExecutionRound[]) =>
  `seq:${ref}:${rounds.map((r) => r.round).join(".") || "0"}`;

export function sequenceOccurrences(nodes: SequenceNode[]) {
  const occurrences: { node: Exclude<SequenceNode, { kind: "repeat" }>; rounds: ExecutionRound[] }[] = [];
  const add = (node: Exclude<SequenceNode, { kind: "repeat" }>, rounds: ExecutionRound[]) => {
    if (occurrences.length >= MAX_SESSION_EXECUTION_STEPS) throw new Error("sequence_budget_exceeded");
    occurrences.push({ node, rounds });
  };
  const walk = (entries: SequenceNode[], rounds: ExecutionRound[]) => {
    for (const node of entries) {
      if (node.kind !== "repeat") add(node, rounds);
      else {
        if (rounds.length >= 2) throw new Error("sequence_depth_exceeded");
        for (let round = 1; round <= node.rounds; round++) {
          const path = [...rounds, { ref: node.ref, name: node.name, round, rounds: node.rounds }];
          walk(node.children, path);
          if (round < node.rounds && node.restBetweenRoundsS)
            add({ kind: "recovery", ref: node.ref, durationS: node.restBetweenRoundsS }, path);
        }
      }
    }
  };
  walk(nodes, []);
  return occurrences;
}

export function validExecutionBudget(
  snapshot: SessionSnapshot,
  overrides: { itemRef: string; prescription: { sets?: number } }[] = [],
): boolean {
  if (snapshot.structureVersion !== 2) return true;
  const byRef = new Map(overrides.map((override) => [override.itemRef, override.prescription]));
  return (
    snapshot.blocks.reduce(
      (total, block) =>
        total +
        block.items.reduce(
          (count, item) =>
            count +
            (item.kind === "recovery"
              ? 1
              : ((byRef.get(item.ref) ?? byRef.get(item.sourceRef ?? ""))?.sets ?? item.prescription.sets ?? 1)),
          0,
        ),
      0,
    ) <= MAX_SESSION_EXECUTION_STEPS
  );
}

// Copie déjà résolue depuis la bibliothèque autorisée. Le libellé vient de i18n
// chez l'appelant ; le domaine ne dépend ni de la base ni de l'interface.
export function expandSessionSnapshot(
  draft: SessionDraft,
  snapshot: SessionSnapshot,
  recoveryLabel: string,
): SessionSnapshot {
  if (!validSessionStructure(draft)) throw new Error("invalid_session_structure");
  if (draft.structureVersion !== 2) return snapshot;
  return {
    ...snapshot,
    structureVersion: 2,
    blocks: snapshot.blocks.map((block, index) => {
      const sources = new Map(block.items.map((item) => [item.ref, item]));
      const items: SnapshotItem[] = [];
      const rest = (ref: string, durationS: number, rounds: ExecutionRound[]) =>
        items.push({
          ref: occurrenceRef(ref, rounds),
          sourceRef: ref,
          rounds,
          kind: "recovery",
          exerciseId: null,
          name: recoveryLabel,
          category: "warmup",
          cues: [],
          media: null,
          prescription: { sets: 1, duration_s: durationS, rest_s: 0 },
          restAfterLastSetS: 0,
        });
      for (const { node, rounds } of sequenceOccurrences(draft.blocks[index]!.sequence!)) {
        if (node.kind === "recovery") rest(node.ref, node.durationS, rounds);
        else {
          const source = sources.get(node.itemRef);
          if (!source) throw new Error("missing_sequence_exercise");
          items.push({
            ...source,
            ref: occurrenceRef(source.ref, rounds),
            sourceRef: source.ref,
            kind: "exercise",
            rounds,
            restAfterLastSetS: 0,
          });
        }
      }
      return { ...block, items };
    }),
  };
}

export function remapSequence(nodes: SequenceNode[], refs: Map<string, string>, newRef: () => string): SequenceNode[] {
  return nodes.map((node): SequenceNode => {
    if (node.kind === "exercise") return { ...node, itemRef: refs.get(node.itemRef) ?? node.itemRef };
    if (node.kind === "recovery") return { ...node, ref: newRef() };
    // La profondeur est conservée ; les contrats bornés restent validés après copie.
    return { ...node, ref: newRef(), children: remapSequence(node.children, refs, newRef) } as SequenceNode;
  });
}

// References accepted for an individual adaptation: a definition or one executed occurrence.
export function sessionExerciseReferences(draft: SessionDraft) {
  const entries = new Map<string, SessionDraft["blocks"][number]["items"][number]>();
  for (const block of draft.blocks) {
    const items = new Map(block.items.map((item) => [item.ref, item]));
    for (const item of block.items) if (item.ref) entries.set(item.ref, item);
    if (draft.structureVersion === 2)
      for (const { node, rounds } of sequenceOccurrences(block.sequence ?? [])) {
        const item = node.kind === "exercise" ? items.get(node.itemRef) : undefined;
        if (item && node.kind === "exercise") entries.set(occurrenceRef(node.itemRef, rounds), item);
      }
  }
  return entries;
}
