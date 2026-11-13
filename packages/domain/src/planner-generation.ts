import type { PlannerGeneration, PlannerGenerationNode } from "@tartan/contracts";
import { sessionSequence, type PlannerInterpretation } from "@tartan/contracts";

/** Pure translation: no invented exercise, repetition, recovery or load. */
export function plannerGenerationToInterpretation(generation: PlannerGeneration): PlannerInterpretation {
  return {
    ...generation,
    sessions: generation.sessions.map((session) => ({
      ...session,
      blocks: session.blocks.map((block) => {
        const items: PlannerInterpretation["sessions"][number]["blocks"][number]["items"] = [];
        let nextRef = 0;
        const convert = (nodes: readonly PlannerGenerationNode[]): unknown[] =>
          nodes.map((node) => {
            const ref = `node-${nextRef++}`;
            if (node.kind === "exercise") {
              const { kind: _kind, ...item } = node;
              items.push({ ...item, ref });
              return { kind: "exercise", itemRef: ref };
            }
            if (node.kind === "recovery") return { ...node, ref };
            return { ...node, ref, children: convert(node.children) };
          });
        const sequence = sessionSequence.parse(convert(block.content));
        return {
          name: block.name,
          items,
          sequence: block.content.some((node) => node.kind !== "exercise") ? sequence : null,
        };
      }),
    })),
  };
}
