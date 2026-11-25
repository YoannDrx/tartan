import {
  sessionSequence,
  type PlannerReviewedDraft,
  type PlannerRichInterpretation,
  type PlannerRichPrescription,
  type PlannerRichSession,
  type PlannerWarning,
  type Prescription,
  type SequenceNode,
} from "@tartan/contracts";
import { isPlannerSlotToken } from "./planner-slots";
import { validSessionStructure } from "./session-sequence";

// La séance telle qu'elle est à l'écran devient la séance que le serveur garde. Le coach l'a retouchée dans
// l'éditeur (une prescription, une fiche remplacée, un exercice ajouté, un ordre changé) : un ajustement ou le
// retrait d'un emplacement repart de là, pas de ce que le modèle avait écrit. Fonction pure : le service a déjà
// contrôlé que chaque fiche et chaque destinataire sont permis.

export type PlannerRebaseContext = {
  /** Le préfixe des références des brouillons préparés (`ai-<proposition>`) : `<préfixe>-<séance>-b<bloc>-i<rang>`. */
  refPrefix: string;
  /** Identifiant de fiche → jeton. */
  exerciseTokens: ReadonlyMap<string, string>;
  /** Jeton → nom de la fiche : c'est le terme d'un exercice que le coach a ajouté à la main. */
  exerciseNames: ReadonlyMap<string, string>;
  /** `group:<id>` ou `athlete:<id>` → jeton. */
  targetTokens: ReadonlyMap<string, string>;
  /** L'identifiant réservé que porte un emplacement à compléter dans un brouillon. */
  slotExerciseId: string;
};

export type PlannerRebased = {
  value: PlannerRichInterpretation;
  /** Référence d'un exercice à l'écran → sa référence dans les brouillons préparés ensuite. */
  refs: Map<string, string>;
};

type RichItem = PlannerRichSession["blocks"][number]["items"][number];

/** Une prescription de séance, dans la forme que garde le planificateur. Le chemin inverse de la conversion. */
export function plannerPrescriptionFromSession(prescription: Prescription): PlannerRichPrescription {
  const load = (value: Prescription["load"]) => (value ? { type: value.type, value: value.value } : null);
  return {
    sets: prescription.sets ?? null,
    reps: prescription.reps ?? null,
    distanceM: prescription.distance_m ?? null,
    durationS: prescription.duration_s ?? null,
    restS: prescription.rest_s ?? null,
    load: load(prescription.load),
    intensityTarget: prescription.intensityTarget ?? null,
    tempo: prescription.tempo ?? null,
    contacts: prescription.ground_contacts ?? null,
    ...(prescription.strides !== undefined ? { strides: prescription.strides } : {}),
    ...(prescription.cone_spacing_ft !== undefined ? { coneSpacingFt: prescription.cone_spacing_ft } : {}),
    notes: prescription.notes ?? null,
    setPlan: prescription.setPlan?.length
      ? prescription.setPlan.map((set) => ({
          reps: set.reps ?? null,
          load: load(set.load),
          warmup: Boolean(set.warmup),
        }))
      : null,
  };
}

/**
 * Les séances de l'écran, dans la forme que garde le serveur. Chaque exercice retrouve ce que le planificateur
 * savait de lui (le terme dit, le mouvement cité, le doute sur sa fiche) par sa référence ; une fiche changée par
 * le coach n'est plus un doute ; un exercice ajouté à la main est le sien, sous le nom de sa fiche. `null` : l'écran
 * ne correspond pas à cette proposition (séance en plus ou en moins, fiche ou destinataire inconnu, structure
 * invalide, séance vidée).
 */
export function plannerRebaseOnDrafts(
  stored: PlannerRichInterpretation,
  drafts: readonly PlannerReviewedDraft[],
  context: PlannerRebaseContext,
): PlannerRebased | null {
  if (stored.status !== "proposal" || drafts.length !== stored.sessions.length) return null;
  const position = new RegExp(`^${context.refPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)-b(\\d+)-i(\\d+)$`);
  const refs = new Map<string, string>();
  // Les mouvements ajoutés à la main sont numérotés à la suite de ceux que le coach avait cités.
  let movement = Math.max(
    0,
    ...stored.sessions.flatMap((session) =>
      session.blocks.flatMap((block) => block.items.map((item) => Number(item.movementId?.slice(1)) || 0)),
    ),
  );
  const sessions: PlannerRichSession[] = [];
  for (const [s, draft] of drafts.entries()) {
    const before = stored.sessions[s]!;
    if (!validSessionStructure(draft.draft)) return null;
    const targetTokens: string[] = [];
    for (const assignment of draft.assignments) {
      const token = context.targetTokens.get(`${assignment.targetType}:${assignment.targetId}`);
      if (!token) return null;
      if (!targetTokens.includes(token)) targetTokens.push(token);
    }
    if (!targetTokens.length) return null;
    // Ancienne place d'un exercice gardé → nouvelle place, pour faire suivre ses points « À vérifier ».
    const moved = new Map<string, { block: number; item: number; sameExercise: boolean }>();
    const movedBlocks = new Map<number, number>();
    const blocks: PlannerRichSession["blocks"] = [];
    for (const [d, block] of draft.draft.blocks.entries()) {
      const byRef = new Map(block.items.map((item) => [item.ref!, item]));
      const order: string[] = [];
      const walk = (nodes: readonly SequenceNode[]) => {
        for (const node of nodes)
          if (node.kind === "exercise") order.push(node.itemRef);
          else if (node.kind === "repeat") walk(node.children);
      };
      walk(block.sequence ?? []);
      for (const item of block.items) if (!order.includes(item.ref!)) order.push(item.ref!);
      if (!order.length) continue;
      const at = blocks.length;
      const renamed = new Map<string, string>();
      const items: RichItem[] = [];
      for (const [i, ref] of order.entries()) {
        const item = byRef.get(ref);
        if (!item) return null;
        const place = position.exec(ref);
        const known =
          place && Number(place[1]) === s ? before.blocks[Number(place[2])]?.items[Number(place[3])] : undefined;
        // Un emplacement à compléter garde son jeton : seul le coach le remplit, par le service.
        const tokenOf = (exerciseId: string, slot: string | undefined) =>
          exerciseId === context.slotExerciseId
            ? slot && isPlannerSlotToken(slot)
              ? slot
              : null
            : (context.exerciseTokens.get(exerciseId) ?? null);
        const token = tokenOf(item.exerciseId, known?.exerciseToken);
        if (!token) return null;
        const away = item.autonomous
          ? tokenOf(item.autonomous.exerciseId, known?.autonomous?.exerciseToken)
          : undefined;
        if (away === null) return null;
        const sameExercise = Boolean(known && known.exerciseToken === token);
        const name = context.exerciseNames.get(token) ?? token;
        const node = `node-${i}`;
        renamed.set(ref, node);
        refs.set(ref, `${context.refPrefix}-${s}-b${at}-i${i}`);
        if (known && place) moved.set(`${place[2]}:${place[3]}`, { block: at, item: i, sameExercise });
        items.push({
          ref: node,
          exerciseToken: token,
          prescription: plannerPrescriptionFromSession(item.prescription),
          ...(known
            ? {
                instruction: known.instruction,
                ...(known.origin ? { origin: known.origin } : {}),
                ...(known.movementId ? { movementId: known.movementId } : {}),
                ...(known.said ? { said: known.said } : {}),
                // Une fiche que le coach a changée n'est plus un doute : ni autres fiches, ni création proposée.
                ...(sameExercise
                  ? {
                      ...(known.confidence ? { confidence: known.confidence } : {}),
                      ...(known.alternatives ? { alternatives: known.alternatives } : {}),
                      ...(known.suggestion ? { suggestion: known.suggestion } : {}),
                    }
                  : known.confidence
                    ? { confidence: "exact" as const }
                    : {}),
              }
            : {
                instruction: name.slice(0, 2000),
                origin: "said" as const,
                movementId: `m${++movement}`,
                said: name.slice(0, 120),
                confidence: "exact" as const,
              }),
          autonomous:
            item.autonomous && away
              ? { exerciseToken: away, prescription: plannerPrescriptionFromSession(item.autonomous.prescription) }
              : null,
        });
      }
      const rename = (nodes: readonly SequenceNode[]): SequenceNode[] =>
        nodes.map((node) =>
          node.kind === "exercise"
            ? { ...node, itemRef: renamed.get(node.itemRef)! }
            : node.kind === "repeat"
              ? ({ ...node, children: rename(node.children) } as SequenceNode)
              : node,
        );
      const sequence = sessionSequence.safeParse(rename(block.sequence ?? []));
      if (!sequence.success) return null;
      const origin = /-b(\d+)$/.exec(block.ref ?? "");
      movedBlocks.set(origin ? Number(origin[1]) : d, at);
      blocks.push({
        name: block.name,
        items,
        // Une suite d'exercices sans tour ni pause reste une simple liste, comme à l'écriture.
        sequence: sequence.data.some((node) => node.kind !== "exercise") ? sequence.data : null,
      });
    }
    if (!blocks.length) return null;
    const warnings = (before.warnings ?? []).flatMap((warning): PlannerWarning[] => {
      if (warning.block === null) return [warning];
      if (warning.item === null)
        return movedBlocks.has(warning.block) ? [{ ...warning, block: movedBlocks.get(warning.block)! }] : [];
      const place = moved.get(`${warning.block}:${warning.item}`);
      // Le doute sur une fiche part avec elle : le coach en a choisi une autre.
      if (!place || (warning.code === "approximate_exercise" && !place.sameExercise)) return [];
      return [{ ...warning, block: place.block, item: place.item }];
    });
    sessions.push({
      date: draft.date,
      startTime: draft.startTime,
      title: draft.draft.title,
      type: draft.draft.type,
      durationMin: draft.draft.durationMin,
      targetTokens,
      blocks,
      ...(before.warnings ? { warnings } : {}),
    });
  }
  return { value: { ...stored, status: "proposal", questions: [], sessions }, refs };
}
