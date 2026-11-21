import "server-only";
import type { PlannerProposalResponse, PlannerStreamEvent, PlannerStreamPlanLine } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { after } from "next/server";
import { AppError } from "@/lib/errors";
import type { PlannerProgress } from "./provider";

export type PlannerStreamHooks = {
  onProgress: (progress: PlannerProgress | { step: "saved" }) => void;
  onPlan: (lines: PlannerStreamPlanLine[]) => void;
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
 * Réponse diffusée. La génération ne dépend pas de la connexion : un onglet fermé n'interrompt ni l'appel au
 * prestataire ni l'enregistrement ; le résultat se relit ensuite par la proposition.
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
  let lastPlan = "";
  const done = work({
    onProgress: ({ step }) => send({ event: "step", data: { step } }),
    onPlan: (lines) => {
      const key = JSON.stringify(lines);
      if (key === lastPlan) return;
      lastPlan = key;
      send({ event: "plan", data: { lines } });
    },
  })
    .then((result) => send({ event: "result", data: result }))
    .catch((error: unknown) =>
      send({
        event: "error",
        data:
          error instanceof AppError
            ? { status: error.status, code: error.code, message: error.message }
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
