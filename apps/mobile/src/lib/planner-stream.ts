import {
  plannerProposalResponse,
  plannerStreamEvent,
  type PlannerProposalResponse,
  type PlannerStepName,
  type PlannerStreamPlanLine,
} from "@tartan/contracts";

// Réponse diffusée du planificateur (`text/event-stream`), lue sans React Native : le découpage des événements et
// ce que l'écran en montre. Le crochet qui ouvre la connexion vit dans `features/use-planner-stream.ts`.

/** Les étapes que l'écran affiche : lire la demande, retrouver les fiches, écrire, contrôler, corriger un point. */
export type PlannerProgressStep = "context" | "matching" | "model" | "checks" | "retry";
export const PLANNER_PROGRESS_STEPS: readonly PlannerProgressStep[] = ["context", "matching", "model", "checks"];
export type PlannerStreamError = { status: number; code: string; message: string; step?: PlannerStepName | null };
export type PlannerStreamState = {
  running: boolean;
  steps: PlannerProgressStep[];
  // « Ce que j'ai compris », à mesure que le serveur l'écrit.
  summary: string | null;
  plan: PlannerStreamPlanLine[];
  error: PlannerStreamError | null;
};
export const idlePlannerStream: PlannerStreamState = {
  running: false,
  steps: [],
  summary: null,
  plan: [],
  error: null,
};
export type PlannerRawEvent = { event: string; data: unknown };

/**
 * Découpe un flux d'événements serveur en événements complets, morceau par morceau : un événement n'est rendu que
 * lorsque sa ligne vide de fin est arrivée. Les fins de ligne `\r\n` sont acceptées, une donnée illisible est
 * ignorée sans arrêter la lecture.
 */
export function createPlannerEventParser() {
  let buffer = "";
  const parse = (chunk: string): PlannerRawEvent | null => {
    let event: string | null = null;
    const data: string[] = [];
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!event || !data.length) return null;
    try {
      return { event, data: JSON.parse(data.join("\n")) as unknown };
    } catch {
      return null;
    }
  };
  const drain = (final: boolean) => {
    const chunks = buffer.split("\n\n");
    buffer = final ? "" : chunks.pop()!;
    return chunks.map(parse).filter((value): value is PlannerRawEvent => value !== null);
  };
  return {
    push: (text: string) => {
      buffer += text.replace(/\r\n?/g, "\n");
      return drain(false);
    },
    end: () => drain(true),
  };
}

/** Ce qu'un événement change à l'écran, et le résultat ou la panne quand il en porte un. */
export function applyPlannerEvent(
  state: PlannerStreamState,
  raw: PlannerRawEvent,
): { state: PlannerStreamState; result?: PlannerProposalResponse; error?: PlannerStreamError } {
  if (raw.event === "result") {
    const parsed = plannerProposalResponse.safeParse(raw.data);
    return parsed.success ? { state, result: parsed.data } : { state };
  }
  const parsed = plannerStreamEvent.safeParse(raw);
  if (!parsed.success) return { state };
  const reach = (step: PlannerProgressStep, patch: Partial<PlannerStreamState> = {}): PlannerStreamState => ({
    ...state,
    ...patch,
    steps: state.steps.includes(step) ? state.steps : [...state.steps, step],
  });
  const event = parsed.data;
  switch (event.event) {
    case "understanding":
      return { state: reach("context", event.data.summary ? { summary: event.data.summary } : {}) };
    case "matching":
      return { state: reach("matching") };
    case "composing":
      return { state: reach("model", { plan: event.data.lines }) };
    case "checking":
      return { state: reach(event.data.repairs ? "retry" : "checks") };
    case "error":
      return { state: { ...state, error: event.data }, error: event.data };
    default:
      return { state };
  }
}

/** L'étape en cours : la dernière atteinte, tant que la génération tourne. */
export const plannerCurrentStep = (state: PlannerStreamState): PlannerProgressStep | null =>
  state.running ? (state.steps.at(-1) ?? "context") : null;

/** Lit un flux d'octets jusqu'au bout, et rend chaque événement complet dans l'ordre. */
export async function readPlannerEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: PlannerRawEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createPlannerEventParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (value) for (const event of parser.push(decoder.decode(value, { stream: true }))) onEvent(event);
    if (done) {
      for (const event of parser.push(decoder.decode())) onEvent(event);
      for (const event of parser.end()) onEvent(event);
      return;
    }
  }
}
