// Prestataire d'essai scénarisé : chaque étape rend ce que l'essai lui a dicté, et garde ce qu'elle a reçu.
// Il ne contrôle rien : c'est le serveur qui applique les règles, comme à OpenAI et au prestataire simulé.
import { vi } from "vitest";
import type {
  PlannerComposedNode,
  PlannerComposition,
  PlannerMatchGeneration,
  PlannerUnderstanding,
} from "@tartan/contracts";
import type {
  PlannerComposeInput,
  PlannerMatchInput,
  PlannerProvider,
  PlannerProviderContext,
  PlannerRepairInput,
  PlannerUnderstandInput,
} from "@/server/ai/pipeline";

export const understoodSession = (
  patch: Partial<PlannerUnderstanding["sessions"][number]> = {},
): PlannerUnderstanding["sessions"][number] => ({
  date: null,
  dateSaid: null,
  startTime: null,
  targetTokens: [],
  movements: [],
  structure: null,
  proposal: null,
  ...patch,
});
export const understanding = (patch: Partial<PlannerUnderstanding> = {}): PlannerUnderstanding => ({
  summary: "Tu veux une séance.",
  offTopic: false,
  intent: "described",
  sessions: [understoodSession()],
  corrections: [],
  ...patch,
});
export const said = (id: string, term: string, prescription: string | null = null, replaces: string | null = null) => ({
  id,
  said: term,
  prescription,
  replaces,
});

type Prescription = Extract<PlannerComposedNode, { kind: "exercise" }>["prescription"];
export const prescribed = (patch: Partial<Prescription> = {}): Prescription => ({
  sets: 3,
  reps: 8,
  distanceM: null,
  durationS: null,
  restS: null,
  load: null,
  intensityTarget: null,
  tempo: null,
  contacts: null,
  notes: null,
  setPlan: null,
  ...patch,
});
export const node = (
  movementId: string | null,
  exerciseToken: string,
  patch: Partial<Prescription> = {},
): PlannerComposedNode => ({
  kind: "exercise",
  movementId,
  exerciseToken,
  prescription: prescribed(patch),
  reason: movementId ? null : "Sert l'objectif.",
  autonomous: null,
});
export const composed = (content: PlannerComposedNode[], patch = {}): PlannerComposition => ({
  sessions: [{ index: 0, title: "Séance", type: "strength", durationMin: null, blocks: [{ name: "Bloc", content }], ...patch }],
  assumptions: [],
  suggestions: [],
});
/** La séance qui pose chaque mouvement cité, dans l'ordre, sur la fiche (ou l'emplacement) retrouvée pour lui. */
export const followUnderstanding = (input: PlannerComposeInput): PlannerComposition => ({
  sessions: input.understanding.sessions.map((session) => ({
    index: session.index,
    title: "Séance",
    type: "strength" as const,
    durationMin: null,
    blocks: [
      {
        name: "Bloc",
        content: session.movements.length
          ? session.movements.map((movement) => node(movement.id, movement.exerciseToken))
          : [node(null, input.candidates[0] ?? input.exercises[0]!.token)],
      },
    ],
  })),
  assumptions: [],
  suggestions: [],
});

export type Script = {
  understand: (input: PlannerUnderstandInput) => PlannerUnderstanding;
  match?: (input: PlannerMatchInput) => PlannerMatchGeneration;
  compose?: (input: PlannerComposeInput) => PlannerComposition;
  repair?: (input: PlannerRepairInput) => PlannerComposition;
};
export const scripted = (script: Script) => {
  const provider = {
    understand: vi.fn(async (input: PlannerUnderstandInput) => script.understand(input)),
    // Par défaut, aucun terme n'a de fiche : l'essai dit lui-même ce que le modèle retrouve.
    match: vi.fn(async (input: PlannerMatchInput) =>
      script.match
        ? script.match(input)
        : {
            matches: input.movements.map((movement) => ({
              id: movement.id,
              confidence: "absent" as const,
              key: null,
              others: [],
              suggestion: null,
            })),
          },
    ),
    compose: vi.fn(async (input: PlannerComposeInput) => (script.compose ?? followUnderstanding)(input)),
    repair: vi.fn(async (input: PlannerRepairInput) => (script.repair ?? script.compose ?? followUnderstanding)(input)),
  } satisfies PlannerProvider;
  return provider;
};

export const fiche = (index: number, name: string, patch: Partial<PlannerProviderContext["exercises"][number]> = {}) => ({
  token: `exercise_${index}`,
  name,
  category: "strength" as const,
  aliases: [],
  classification: { movement: null, equipment: [] },
  strengthLoadKind: null,
  family: "strength" as const,
  approved: true,
  ...patch,
});
// Lundi 23 novembre 2026, une fenêtre de quatre semaines, un groupe choisi.
export const pipelineContext = (
  text: string,
  exercises: PlannerProviderContext["exercises"],
  patch: Partial<PlannerProviderContext> = {},
): PlannerProviderContext => ({
  period: { from: "2026-11-23", to: "2026-12-20" },
  today: "2026-11-23",
  timeZone: "Europe/Paris",
  targets: [{ token: "group_1", kind: "group", phase: null }],
  targetsChosen: true,
  exercises,
  instructions: [text],
  ...patch,
});
