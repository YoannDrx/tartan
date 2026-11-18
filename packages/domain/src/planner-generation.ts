import type {
  PlannerGeneration,
  PlannerGenerationNode,
  PlannerGenerationPrescription,
  PlannerInterpretation,
  PlannerProposeGeneration,
  PlannerRichInterpretation,
  PlannerRichPrescription,
  PlannerRichSession,
} from "@tartan/contracts";
import { sessionSequence } from "@tartan/contracts";

type PlannedSet = NonNullable<PlannerGenerationPrescription["setPlan"]>[number];
const sameSet = (a: PlannedSet, b: PlannedSet) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Séries détaillées : le nombre de séries, les répétitions et la charge de la première série de travail restent
 * alignés sur le détail, pour les clients qui ne le lisent pas. Des séries toutes identiques ne sont pas un détail.
 */
export function plannerNormalizeSetPlan(prescription: PlannerGenerationPrescription): PlannerRichPrescription {
  const plan = prescription.setPlan;
  if (!plan?.length) return { ...prescription, setPlan: null };
  if (plan.every((set) => !set.warmup && sameSet(set, plan[0]!)))
    return {
      ...prescription,
      sets: plan.length,
      reps: plan[0]!.reps ?? prescription.reps,
      load: plan[0]!.load ?? prescription.load,
      setPlan: null,
    };
  const work = plan.find((set) => !set.warmup) ?? plan[0]!;
  return {
    ...prescription,
    sets: plan.length,
    reps: work.reps ?? prescription.reps,
    load: work.load ?? prescription.load,
    setPlan: plan,
  };
}

/** Traduction pure : aucun exercice, répétition, récupération ou charge inventé. */
export function plannerGenerationToInterpretation(generation: PlannerGeneration): PlannerRichInterpretation {
  return {
    ...generation,
    sessions: generation.sessions.map(({ blocks, ...session }) => ({ ...session, blocks: blocks.map(convertBlock) })),
  };
}

/** Mode « Proposer » : la date, l'heure et les destinataires sont ceux de la demande, jamais ceux du modèle. */
export function plannerProposeGenerationToInterpretation(
  generation: PlannerProposeGeneration,
  request: { date: string; startTime: string | null; targetTokens: readonly string[] },
): PlannerRichInterpretation {
  return {
    ...generation,
    sessions: generation.sessions.map(({ blocks, ...session }) => ({
      ...session,
      date: request.date,
      startTime: request.startTime,
      targetTokens: [...request.targetTokens],
      blocks: blocks.map(convertBlock),
    })),
  };
}

type ExerciseNode = Extract<PlannerGenerationNode, { kind: "exercise" }>;
const setsOf = (node: ExerciseNode): PlannedSet[] =>
  node.prescription.setPlan?.length
    ? node.prescription.setPlan
    : Array.from({ length: node.prescription.sets ?? 1 }, () => ({
        reps: node.prescription.reps,
        load: node.prescription.load,
        warmup: false,
      }));
/**
 * Deux lignes successives du même exercice (« 3 × 5 à 70 %, puis 1 × 3 à 80 % ») sont un seul exercice dont les
 * séries diffèrent : elles deviennent un détail série par série, dans l'ordre, sans rien ajouter ni retirer.
 */
export function plannerMergeRepeatedExercise(content: PlannerGenerationNode[]): PlannerGenerationNode[] {
  const merged: PlannerGenerationNode[] = [];
  for (const node of content) {
    const previous = merged.at(-1);
    if (
      node.kind === "exercise" &&
      previous?.kind === "exercise" &&
      previous.exerciseToken === node.exerciseToken &&
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
        instruction: previous.instruction,
        prescription: { ...previous.prescription, sets: plan.length, setPlan: plan },
      };
      continue;
    }
    merged.push(node);
  }
  return merged;
}

function convertBlock(block: { name: string; content: PlannerGenerationNode[] }) {
  block = { ...block, content: plannerMergeRepeatedExercise(block.content) };
  const items: PlannerRichSession["blocks"][number]["items"] = [];
  let nextRef = 0;
  const convert = (nodes: readonly PlannerGenerationNode[]): unknown[] =>
    nodes.map((node) => {
      const ref = `node-${nextRef++}`;
      if (node.kind === "exercise") {
        const { kind: _kind, autonomous, prescription, ...item } = node;
        items.push({
          ...item,
          ref,
          prescription: plannerNormalizeSetPlan(prescription),
          autonomous: autonomous
            ? {
                exerciseToken: autonomous.exerciseToken,
                prescription: plannerNormalizeSetPlan(autonomous.prescription),
              }
            : null,
        });
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
}

const legacyPrescription = ({ setPlan, ...prescription }: PlannerRichPrescription) =>
  setPlan?.length ? withoutPlan(plannerNormalizeSetPlan({ ...prescription, setPlan })) : prescription;
const withoutPlan = ({ setPlan: _setPlan, ...prescription }: PlannerRichPrescription) => prescription;

/**
 * Projection lue par les applications déjà installées : elles ne connaissent ni le détail des séries, ni
 * l'autonomie, ni les points à vérifier. Le nombre de séries, les répétitions et la charge restent justes.
 */
export function plannerLegacyInterpretation(value: PlannerRichInterpretation): PlannerInterpretation {
  return {
    ...value,
    sessions: value.sessions.map(({ warnings: _warnings, ...session }) => ({
      ...session,
      blocks: session.blocks.map((block) => ({
        ...block,
        items: block.items.map(({ autonomous: _autonomous, prescription, ...item }) => ({
          ...item,
          prescription: legacyPrescription(prescription),
        })),
      })),
    })),
  };
}

/** Le chemin inverse, pour « Ajuster » : la séance précédente renvoyée au modèle dans le format qu'il écrit. */
export function plannerSessionToGeneration(session: PlannerRichSession): PlannerGeneration["sessions"][number] {
  const { warnings: _warnings, ...rest } = session;
  return {
    ...rest,
    blocks: session.blocks.map((block) => {
      const byRef = new Map(block.items.map((item, index) => [item.ref ?? `item-${index}`, item]));
      const leafOf = (item: (typeof block.items)[number]) => ({
        kind: "exercise" as const,
        exerciseToken: item.exerciseToken,
        instruction: item.instruction,
        prescription: { ...item.prescription, setPlan: item.prescription.setPlan ?? null },
        autonomous: item.autonomous
          ? {
              exerciseToken: item.autonomous.exerciseToken,
              instruction: item.instruction,
              prescription: { ...item.autonomous.prescription, setPlan: item.autonomous.prescription.setPlan ?? null },
            }
          : null,
      });
      type Node = NonNullable<typeof block.sequence>[number];
      const toContent = (nodes: readonly Node[]): PlannerGenerationNode[] =>
        nodes.flatMap((node): PlannerGenerationNode[] => {
          if (node.kind === "exercise") {
            const item = byRef.get(node.itemRef);
            return item ? [leafOf(item)] : [];
          }
          if (node.kind === "recovery") return [{ kind: "recovery", durationS: node.durationS }];
          return [
            {
              kind: "repeat",
              name: node.name,
              rounds: node.rounds,
              restBetweenRoundsS: node.restBetweenRoundsS,
              children: toContent(node.children) as never,
            },
          ];
        });
      return {
        name: block.name,
        content: block.sequence ? toContent(block.sequence) : block.items.map(leafOf),
      };
    }),
  };
}
