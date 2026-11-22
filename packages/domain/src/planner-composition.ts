import {
  sessionSequence,
  type PlannerComposedNode,
  type PlannerComposedSession,
  type PlannerComposition,
  type PlannerMatchConfidence,
  type PlannerRichInterpretation,
  type PlannerRichSession,
  type PlannerSlotSuggestion,
} from "@tartan/contracts";
import { plannerNormalizeSetPlan } from "./planner-generation";

// Étape « Composer », après le modèle : sa réponse devient la séance que le serveur garde. Ce que le coach a dit
// ne dépend plus du modèle : la date, l'heure et les destinataires viennent de la compréhension, et un mouvement
// cité porte toujours la fiche que l'étape « Retrouver » lui a donnée.

/** Un mouvement cité par le coach, avec la fiche (ou l'emplacement) retrouvée pour lui. */
export type PlannerComposeMovement = {
  id: string;
  session: number;
  said: string;
  prescription: string | null;
  replaces: string | null;
  // Jeton d'une fiche, ou d'un emplacement à compléter.
  exerciseToken: string;
  confidence: PlannerMatchConfidence;
  alternatives: readonly string[];
  // Emplacement à compléter : de quoi préremplir la création de sa fiche.
  suggestion?: PlannerSlotSuggestion;
};
export type PlannerComposeFrame = {
  sessions: readonly { date: string; startTime: string | null; targetTokens: readonly string[] }[];
  movements: readonly PlannerComposeMovement[];
  // Texte posé sur un exercice proposé sans raison écrite : les anciens clients exigent une citation non vide.
  proposedLabel: string;
  // Les jetons que le modèle pouvait citer (fiches données, emplacements). Un exercice qui en cite un autre sans
  // être un mouvement du coach n'existe pas : le schéma de sortie ne borne plus les jetons, le serveur le fait.
  tokens?: ReadonlySet<string>;
};

type Exercise = Extract<PlannerComposedNode, { kind: "exercise" }>;
// Deux lignes successives du même mouvement (« 3 × 5 à 70 %, puis 1 × 3 à 80 % ») sont un seul exercice dont les
// séries diffèrent : un détail série par série, dans l'ordre, sans rien ajouter ni retirer.
function mergeRepeated(content: PlannerComposedNode[]): PlannerComposedNode[] {
  const setsOf = (node: Exercise) =>
    node.prescription.setPlan?.length
      ? node.prescription.setPlan
      : Array.from({ length: node.prescription.sets ?? 1 }, () => ({
          reps: node.prescription.reps,
          load: node.prescription.load,
          warmup: false,
        }));
  const merged: PlannerComposedNode[] = [];
  for (const node of content) {
    const previous = merged.at(-1);
    if (
      node.kind === "exercise" &&
      previous?.kind === "exercise" &&
      previous.exerciseToken === node.exerciseToken &&
      previous.movementId === node.movementId &&
      !previous.autonomous &&
      !node.autonomous &&
      previous.prescription.distanceM === null &&
      node.prescription.distanceM === null &&
      previous.prescription.durationS === null &&
      node.prescription.durationS === null
    ) {
      const plan = [...setsOf(previous), ...setsOf(node)].slice(0, 30);
      merged[merged.length - 1] = {
        ...previous,
        prescription: { ...previous.prescription, sets: plan.length, setPlan: plan },
      };
      continue;
    }
    merged.push(node);
  }
  return merged;
}

export function plannerCompositionToInterpretation(
  composition: PlannerComposition,
  frame: PlannerComposeFrame,
): { value: PlannerRichInterpretation; indexes: number[] } {
  const sessions: PlannerRichSession[] = [];
  const seen = new Set<number>();
  for (const session of [...composition.sessions].sort((a, b) => a.index - b.index)) {
    const request = frame.sessions[session.index];
    // Une séance que la compréhension n'a pas lue, ou écrite deux fois : elle n'existe pas.
    if (!request || seen.has(session.index)) continue;
    seen.add(session.index);
    // Rang −1 : un mouvement cité dans un ajustement, valable pour la séance ajustée quelle qu'elle soit.
    const mine = frame.movements.filter((movement) => movement.session === session.index || movement.session === -1);
    const byId = new Map(mine.map((movement) => [movement.id, movement]));
    const used = new Set<string>();
    const walk = (nodes: readonly PlannerComposedNode[], visit: (node: Exercise) => void) => {
      for (const node of nodes)
        if (node.kind === "exercise") visit(node);
        else if (node.kind === "repeat") walk(node.children as PlannerComposedNode[], visit);
    };
    for (const block of session.blocks)
      walk(block.content, (node) => {
        if (node.movementId && byId.has(node.movementId)) used.add(node.movementId);
      });
    // Un exercice sans identifiant qui porte la fiche d'un mouvement cité encore absent : c'est ce mouvement.
    const adopt = (node: Exercise) => {
      if (node.movementId && byId.has(node.movementId)) return byId.get(node.movementId)!;
      const orphan = mine.find(
        (movement) => !movement.replaces && !used.has(movement.id) && movement.exerciseToken === node.exerciseToken,
      );
      if (orphan) used.add(orphan.id);
      return orphan;
    };
    // Une fiche inventée ne passe pas : l'exercice disparaît, et un groupe vidé avec lui.
    const usable = (token: string, movementId: string | null) =>
      !frame.tokens || frame.tokens.has(token) || Boolean(movementId && byId.has(movementId));
    const known = (nodes: readonly PlannerComposedNode[]): PlannerComposedNode[] =>
      nodes.flatMap((node): PlannerComposedNode[] => {
        if (node.kind === "recovery") return [node];
        if (node.kind === "repeat") {
          const children = known(node.children as PlannerComposedNode[]);
          return children.some((child) => child.kind !== "recovery")
            ? [{ ...node, children } as PlannerComposedNode]
            : [];
        }
        if (!usable(node.exerciseToken, node.movementId)) return [];
        const away = node.autonomous;
        return [away && !usable(away.exerciseToken, away.movementId) ? { ...node, autonomous: null } : node];
      });
    const blocks = session.blocks.map((block) => {
      const items: PlannerRichSession["blocks"][number]["items"] = [];
      let nextRef = 0;
      const convert = (nodes: readonly PlannerComposedNode[]): unknown[] =>
        nodes.map((node) => {
          const ref = `node-${nextRef++}`;
          if (node.kind === "recovery") return { ...node, ref };
          if (node.kind === "repeat")
            return { ...node, ref, children: convert(node.children as PlannerComposedNode[]) };
          const movement = adopt(node);
          const away = node.autonomous;
          const awayMovement = away?.movementId ? byId.get(away.movementId) : undefined;
          items.push({
            ref,
            exerciseToken: movement ? movement.exerciseToken : node.exerciseToken,
            prescription: plannerNormalizeSetPlan(node.prescription),
            instruction: movement
              ? [movement.said, movement.prescription].filter(Boolean).join(", ").slice(0, 2000)
              : node.reason?.trim() || frame.proposedLabel,
            origin: movement ? "said" : "proposed",
            ...(movement
              ? {
                  movementId: movement.id,
                  said: movement.said,
                  confidence: movement.confidence,
                  ...(movement.alternatives.length ? { alternatives: [...movement.alternatives].slice(0, 3) } : {}),
                  ...(movement.suggestion ? { suggestion: movement.suggestion } : {}),
                }
              : {}),
            autonomous: away
              ? {
                  exerciseToken: awayMovement ? awayMovement.exerciseToken : away.exerciseToken,
                  prescription: plannerNormalizeSetPlan(away.prescription),
                }
              : null,
          });
          return { kind: "exercise", itemRef: ref };
        });
      const content = mergeRepeated(known(block.content));
      const sequence = sessionSequence.parse(convert(content));
      return {
        name: block.name,
        items,
        sequence: content.some((node) => node.kind !== "exercise") ? sequence : null,
      };
    });
    sessions.push({
      date: request.date,
      startTime: request.startTime,
      title: session.title,
      type: session.type,
      durationMin: session.durationMin,
      targetTokens: [...request.targetTokens],
      blocks: blocks.filter((block) => block.items.length),
    });
  }
  return {
    value: {
      status: "proposal",
      questions: [],
      sessions,
      assumptions: composition.assumptions,
      suggestions: composition.suggestions,
    },
    indexes: [...seen].sort((a, b) => a - b),
  };
}

type RichItem = PlannerRichSession["blocks"][number]["items"][number];
type SequenceLike =
  | { kind: "exercise"; itemRef: string }
  | { kind: "recovery"; durationS: number }
  | { kind: "repeat"; name: string; rounds: number; restBetweenRoundsS: number; children: SequenceLike[] };

/**
 * Le chemin inverse, pour « Ajuster » et pour la réparation ciblée : une séance gardée par le serveur, dans la
 * forme que le modèle écrit. `index` est son rang dans la demande.
 */
export function plannerSessionToComposition(session: PlannerRichSession, index: number): PlannerComposedSession {
  return {
    index,
    title: session.title,
    type: session.type,
    durationMin: session.durationMin,
    blocks: session.blocks.map((block) => {
      const byRef = new Map(block.items.map((item, i) => [item.ref ?? `item-${i}`, item]));
      const leaf = (item: RichItem): PlannerComposedNode => ({
        kind: "exercise",
        movementId: item.movementId ?? null,
        exerciseToken: item.exerciseToken,
        prescription: { ...item.prescription, setPlan: item.prescription.setPlan ?? null },
        reason: item.origin === "said" ? null : item.instruction.slice(0, 300),
        autonomous: item.autonomous
          ? {
              movementId: null,
              exerciseToken: item.autonomous.exerciseToken,
              prescription: { ...item.autonomous.prescription, setPlan: item.autonomous.prescription.setPlan ?? null },
            }
          : null,
      });
      const content = (nodes: readonly SequenceLike[]): PlannerComposedNode[] =>
        nodes.flatMap((node): PlannerComposedNode[] => {
          if (node.kind === "exercise") {
            const item = byRef.get(node.itemRef);
            return item ? [leaf(item)] : [];
          }
          if (node.kind === "recovery") return [{ kind: "recovery", durationS: node.durationS }];
          return [
            {
              kind: "repeat",
              name: node.name,
              rounds: node.rounds,
              restBetweenRoundsS: node.restBetweenRoundsS,
              children: content(node.children) as never,
            },
          ];
        });
      return {
        name: block.name,
        content: block.sequence ? content(block.sequence as SequenceLike[]) : block.items.map(leaf),
      };
    }),
  };
}

/** Les mouvements cités que porte déjà une séance gardée : pour « Ajuster », ils restent ceux du coach. */
export function plannerSessionMovements(session: PlannerRichSession, index: number): PlannerComposeMovement[] {
  const movements = new Map<string, PlannerComposeMovement>();
  for (const block of session.blocks)
    for (const item of block.items)
      if (item.origin === "said" && item.movementId && item.said && !movements.has(item.movementId))
        movements.set(item.movementId, {
          id: item.movementId,
          session: index,
          said: item.said,
          prescription: null,
          replaces: null,
          exerciseToken: item.exerciseToken,
          confidence: item.confidence ?? "exact",
          alternatives: item.alternatives ?? [],
          ...(item.suggestion ? { suggestion: item.suggestion } : {}),
        });
  return [...movements.values()];
}
