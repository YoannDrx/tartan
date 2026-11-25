import "server-only";
import { PLANNER_SLOT_PREFIX, plannerComposition, type PlannerComposition, type PlannerMatch } from "@tartan/contracts";
import {
  PLANNER_WEEKDAYS,
  plannerExerciseMentions,
  plannerEquipmentAvailable,
  plannerRequiredEquipment,
  plannerSlotDefaults,
  plannerWeekdayOf,
  selectPlannerCandidates,
  type PlannerComposeFrame,
  type PlannerComposeMovement,
  type PlannerRequest,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { plannerStep } from "./step";
import type { PlannerComposeInput, PlannerProvider, PlannerProviderContext } from "./types";
import { plannerCoachTexts } from "./understand";

// Au plus 60 fiches proposables quand plusieurs séances laissent chacune une partie à composer.
const CANDIDATES_TOTAL = 60;
// Une séance voisine n'est utile que si le coach laisse composer, ou s'il en cite une (« refais la séance de mardi »).
const REUSE =
  /refai|repren|redonn|meme seance|comme (?:la|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|hier)|habitu|derniere fois/;
const plain = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");

export type PlannerComposePlan = {
  input: PlannerComposeInput;
  frame: PlannerComposeFrame;
  // Les charges que le contexte porte déjà (séance à ajuster, séances voisines citées) : jamais inventées.
  knownLoads: number[];
};

/**
 * Ce que l'étape « Composer » reçoit : la compréhension, les seules fiches utiles (celles retrouvées, plus 20 à 40
 * candidates choisies par règles pour la partie à proposer), enrichies, et le contexte. Sans appel au modèle.
 */
export function planComposition(
  context: PlannerProviderContext,
  request: PlannerRequest,
  matches: readonly PlannerMatch[],
): PlannerComposePlan {
  const texts = plannerCoachTexts(context);
  const adjusting = Boolean(context.previous);
  const byToken = new Map(context.exercises.map((exercise) => [exercise.token, exercise]));
  const matchOf = new Map(matches.map((match) => [match.id, match]));
  // Un mouvement sans fiche devient un emplacement à compléter : il a son propre jeton, posé comme une fiche.
  const previousSlots = (context.previous?.sessions ?? []).flatMap((session) =>
    session.movements.flatMap((movement) =>
      movement.exerciseToken.startsWith(PLANNER_SLOT_PREFIX)
        ? [Number(movement.exerciseToken.slice(PLANNER_SLOT_PREFIX.length)) || 0]
        : [],
    ),
  );
  let slot = Math.max(0, ...previousSlots);
  // « Ajuster » : les mouvements déjà cités gardent leur identifiant ; les nouveaux sont numérotés à la suite.
  const offset = Math.max(
    0,
    ...(context.previous?.sessions ?? []).flatMap((session) =>
      session.movements.map((movement) => Number(movement.id.slice(1)) || 0),
    ),
  );
  const renamed = new Map<string, string>();
  for (const session of request.sessions)
    for (const movement of session.movements)
      renamed.set(movement.id, adjusting ? `m${offset + Number(movement.id.slice(1))}` : movement.id);
  const cited: PlannerComposeMovement[] = request.sessions.flatMap((session, index) =>
    session.movements.map((movement) => {
      const match = matchOf.get(movement.id);
      const absent = !match || match.confidence === "absent" || !match.exerciseToken;
      return {
        id: renamed.get(movement.id)!,
        // Un ajustement vaut pour la séance ajustée, quel que soit son rang.
        session: adjusting ? -1 : index,
        said: movement.said,
        prescription: movement.prescription,
        replaces: movement.replaces ? (renamed.get(movement.replaces) ?? null) : null,
        exerciseToken: absent ? `${PLANNER_SLOT_PREFIX}${++slot}` : match.exerciseToken!,
        confidence: absent ? ("absent" as const) : match.confidence,
        alternatives: match?.alternatives ?? [],
        ...(absent ? { suggestion: match?.suggestion ?? plannerSlotDefaults(movement.said, null) } : {}),
      };
    }),
  );
  const kept: PlannerComposeMovement[] = (context.previous?.sessions ?? []).flatMap((session, index) =>
    session.movements.map((movement) => ({
      id: movement.id,
      session: index,
      said: movement.said,
      prescription: null,
      replaces: null,
      exerciseToken: movement.exerciseToken,
      confidence: movement.confidence,
      alternatives: movement.alternatives,
      ...(movement.suggestion ? { suggestion: movement.suggestion } : {}),
    })),
  );
  const movements = [...kept, ...cited];
  const sessions = adjusting
    ? context.previous!.sessions.map((session) => ({
        date: session.date,
        startTime: session.startTime,
        targetTokens: session.targetTokens,
      }))
    : request.sessions.map((session) => ({
        date: session.date!,
        startTime: session.startTime,
        targetTokens: session.targetTokens,
      }));

  // Les fiches proposables : relues ou créées par le coach, au matériel disponible, par familles et niveau.
  const candidates = new Set<string>();
  for (const session of request.sessions) {
    if (!session.proposal) continue;
    // Une fiche que la demande nomme exactement passe d'abord, si elle est proposable avec ce matériel.
    for (const mention of plannerExerciseMentions(texts.join("\n"), context.exercises)) {
      const exercise = byToken.get(mention.token);
      if (
        exercise &&
        (exercise.approved || exercise.own) &&
        plannerEquipmentAvailable(
          { equipment: plannerRequiredEquipment(exercise.catalogKey, exercise.classification?.equipment) },
          session.proposal.equipment,
        )
      )
        candidates.add(mention.token);
    }
    const picked = selectPlannerCandidates(
      context.exercises.map((exercise) => ({
        token: exercise.token,
        family: exercise.family ?? null,
        level: exercise.level ?? null,
        equipment: plannerRequiredEquipment(exercise.catalogKey, exercise.classification?.equipment),
        approved: exercise.approved,
        own: exercise.own,
        preferred: exercise.preferred ?? null,
      })),
      { equipment: session.proposal.equipment, families: session.proposal.families, level: session.proposal.level },
    );
    for (const exercise of picked) if (candidates.size < CANDIDATES_TOTAL) candidates.add(exercise.token);
  }
  const proposing = request.sessions.some((session) => session.proposal !== null);
  const reuse = REUSE.test(plain(texts.join("\n")));
  const neighbours = proposing || reuse ? (context.neighbours ?? []) : [];
  const previousTokens = (context.previous?.sessions ?? []).flatMap((entry) =>
    entry.session.blocks.flatMap((block) => tokensIn(block.content)),
  );
  const useful = new Set<string>([
    ...movements.map((movement) => movement.exerciseToken),
    ...candidates,
    ...previousTokens,
    // Une séance voisine que le coach cite doit pouvoir être reprise : ses fiches sont utilisables.
    ...(reuse ? neighbours.flatMap((n) => n.exercises.flatMap((e) => (e.exerciseToken ? [e.exerciseToken] : []))) : []),
  ]);
  if (reuse)
    for (const neighbour of neighbours)
      for (const exercise of neighbour.exercises) if (exercise.exerciseToken) candidates.add(exercise.exerciseToken);
  const exercises = [...useful].flatMap((token) => {
    const exercise = byToken.get(token);
    return exercise
      ? [
          {
            token,
            name: exercise.name,
            family: exercise.family ?? null,
            level: exercise.level ?? null,
            unit: exercise.unit ?? null,
            sides: exercise.sides ?? null,
            loadKind: exercise.strengthLoadKind ?? null,
            equipment: plannerRequiredEquipment(exercise.catalogKey, exercise.classification?.equipment),
            objective: exercise.objective?.slice(0, 160) ?? null,
          },
        ]
      : [];
  });
  const covered = new Set(
    (context.strength ?? []).filter((entry) => entry.coverage === "all").map((entry) => entry.exerciseToken),
  );
  const input: PlannerComposeInput = {
    today: context.today,
    request: texts[0]!,
    followUps: adjusting ? texts.slice(1, -1) : texts.slice(1),
    understanding: {
      intent: request.intent,
      sessions: adjusting
        ? context.previous!.sessions.map((session, index) => ({
            index,
            date: session.date,
            weekday: PLANNER_WEEKDAYS[plannerWeekdayOf(session.date)]!,
            startTime: session.startTime,
            targetTokens: session.targetTokens,
            structure: request.sessions[0]?.structure ?? null,
            movements: cited.map(({ id, said, prescription, replaces, exerciseToken, confidence }) => ({
              id,
              said,
              prescription,
              replaces,
              exerciseToken,
              confidence,
            })),
            proposal: request.sessions[0]?.proposal ?? null,
          }))
        : request.sessions.map((session, index) => ({
            index,
            date: session.date!,
            weekday: PLANNER_WEEKDAYS[plannerWeekdayOf(session.date!)]!,
            startTime: session.startTime,
            targetTokens: session.targetTokens,
            structure: session.structure,
            movements: cited
              .filter((movement) => movement.session === index)
              .map(({ id, said, prescription, replaces, exerciseToken, confidence }) => ({
                id,
                said,
                prescription,
                replaces,
                exerciseToken,
                confidence,
              })),
            proposal: session.proposal,
          })),
      corrections: request.corrections,
    },
    exercises,
    slots: movements
      .filter((movement) => movement.exerciseToken.startsWith(PLANNER_SLOT_PREFIX))
      .map((movement) => ({ token: movement.exerciseToken, said: movement.said })),
    candidates: [...candidates].filter((token) => byToken.has(token)),
    percentAllowed: exercises.filter((exercise) => covered.has(exercise.token)).map((exercise) => exercise.token),
    space: context.space ?? null,
    neighbours: neighbours.map((neighbour) => ({ ...neighbour, exercises: neighbour.exercises.slice(0, 15) })),
    phases: sessions.flatMap((session, index) =>
      (context.phaseCalendar ?? []).flatMap((entry) =>
        entry.date === session.date && entry.phase && session.targetTokens.includes(entry.targetToken)
          ? [{ index, targetToken: entry.targetToken, phase: entry.phase }]
          : [],
      ),
    ),
    previous: context.previous ? { sessions: context.previous.sessions.map((entry) => entry.session) } : null,
    adjustment: adjusting ? texts.at(-1)! : null,
  };
  const knownLoads = [
    ...(context.previous?.sessions ?? []).flatMap((entry) =>
      entry.session.blocks.flatMap((block) => loadsIn(block.content)),
    ),
    ...neighbours.flatMap((neighbour) => neighbour.exercises.flatMap((e) => (e.load ? [e.load.value] : []))),
  ];
  // Les seuls jetons que la séance peut citer : les fiches données au modèle et les emplacements.
  const tokens = new Set([
    ...input.exercises.map((exercise) => exercise.token),
    ...input.slots.map((slot) => slot.token),
  ]);
  return { input, frame: { sessions, movements, proposedLabel: m.aiPlanner.proposedExercise, tokens }, knownLoads };
}

type Content = PlannerComposition["sessions"][number]["blocks"][number]["content"];
const tokensIn = (nodes: Content): string[] =>
  nodes.flatMap((node) =>
    node.kind === "exercise"
      ? [node.exerciseToken, ...(node.autonomous ? [node.autonomous.exerciseToken] : [])]
      : node.kind === "repeat"
        ? tokensIn(node.children as Content)
        : [],
  );
const loadsIn = (nodes: Content): number[] =>
  nodes.flatMap((node) => {
    if (node.kind === "repeat") return loadsIn(node.children as Content);
    if (node.kind !== "exercise") return [];
    return [node.prescription, ...(node.autonomous ? [node.autonomous.prescription] : [])].flatMap((p) => [
      ...(p.load ? [p.load.value] : []),
      ...(p.setPlan ?? []).flatMap((set) => (set.load ? [set.load.value] : [])),
    ]);
  });

/** Étape 3, « Composer » : le modèle principal écrit la séance, diffusée pendant qu'elle s'écrit. */
export async function composeSession(
  input: PlannerComposeInput,
  provider: PlannerProvider,
  deadline: AbortSignal,
  onDelta?: (text: string) => void,
): Promise<PlannerComposition> {
  return plannerStep("compose", deadline, plannerComposition, (signal) =>
    provider.compose(input, { signal, ...(onDelta ? { onDelta } : {}) }),
  );
}
