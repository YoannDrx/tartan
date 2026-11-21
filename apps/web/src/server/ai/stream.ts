import "server-only";
import type {
  PlannerProposalResponse,
  PlannerStreamEvent,
  PlannerStreamMatch,
  PlannerStreamPlanLine,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { after } from "next/server";
import { AppError } from "@/lib/errors";
import { PlannerFailureError } from "./failure";

/** Ce que le service donne à voir, une fonction par étape : comprendre, retrouver, composer, contrôler. */
export type PlannerStreamHooks = {
  onUnderstanding: (summary: string | null, done: boolean) => void;
  onMatching: (movements: PlannerStreamMatch[], done: boolean) => void;
  onPlan: (lines: PlannerStreamPlanLine[]) => void;
  onChecking: (repairs: number, done: boolean) => void;
};

export const wantsPlannerStream = (request: Request) =>
  (request.headers.get("accept") ?? "").includes("text/event-stream");

/**
 * Lignes du plan lisibles dans le texte encore incomplet du modèle : noms de blocs ou de groupes, et exercices
 * (jeton traduit en nom de fiche). Seules les valeurs déjà fermées sont lues ; rien n'est deviné.
 */
export function plannerPlanLines(text: string, nameOf: (token: string) => string | null): PlannerStreamPlanLine[] {
  const lines: PlannerStreamPlanLine[] = [];
  for (const match of text.matchAll(/"(name|exerciseToken)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    if (match[1] === "exerciseToken") {
      const name = nameOf(match[2]!);
      if (name) lines.push({ kind: "exercise", label: name });
    } else {
      let label: string;
      try {
        label = JSON.parse(`"${match[2]}"`) as string;
      } catch {
        continue;
      }
      lines.push({ kind: "block", label: label.slice(0, 200) });
    }
  }
  return lines.slice(0, 200);
}

const encode = (event: PlannerStreamEvent) =>
  new TextEncoder().encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);

/**
 * Réponse diffusée : un événement par étape, puis le résultat ou l'erreur lisible. La génération ne dépend pas de
 * la connexion : un onglet fermé n'interrompt ni les appels au prestataire ni l'enregistrement ; le résultat se
 * relit ensuite par la proposition.
 */
export function plannerEventStream(work: (hooks: PlannerStreamHooks) => Promise<PlannerProposalResponse>): Response {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const send = (event: PlannerStreamEvent) => {
    try {
      controller?.enqueue(encode(event));
    } catch {
      controller = null; // le navigateur est parti : la génération continue sans écran
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null;
    },
  });
  // Un même contenu n'est pas renvoyé deux fois de suite : le résumé et le plan grandissent par morceaux.
  const last = new Map<string, string>();
  const once = (event: PlannerStreamEvent) => {
    const key = JSON.stringify(event.data);
    if (last.get(event.event) === key) return;
    last.set(event.event, key);
    send(event);
  };
  const done = work({
    onUnderstanding: (summary, finished) => once({ event: "understanding", data: { summary, done: finished } }),
    onMatching: (movements, finished) =>
      once({ event: "matching", data: { movements: movements.slice(0, 120), done: finished } }),
    onPlan: (lines) => once({ event: "composing", data: { lines } }),
    onChecking: (repairs, finished) =>
      once({ event: "checking", data: { repairs: Math.min(2, repairs), done: finished } }),
  })
    .then((result) => send({ event: "result", data: result }))
    .catch((error: unknown) =>
      send({
        event: "error",
        data:
          error instanceof AppError
            ? {
                status: error.status,
                code: error.code,
                message: error.message,
                ...(error instanceof PlannerFailureError && error.step ? { step: error.step } : {}),
              }
            : { status: 500, code: "internal", message: m.common.genericError },
      }),
    )
    .finally(() => {
      try {
        controller?.close();
      } catch {
        /* déjà fermé */
      }
    });
  try {
    after(() => done);
  } catch {
    /* hors requête (essais) : la promesse se termine d'elle-même */
  }
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
