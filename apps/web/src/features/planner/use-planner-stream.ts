"use client";

import { createApiClient } from "@tartan/api-client";
import {
  plannerProposalResponse,
  plannerStreamEvent,
  type ClarifyPlannerProposalInput,
  type CreatePlannerProposalInput,
  type PlannerProposalResponse,
  type PlannerStepName,
  type PlannerStreamPlanLine,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

const api = createApiClient({ baseUrl: "" });

// Les étapes que l'écran affiche : comprendre, retrouver les fiches, écrire, contrôler, et la réparation ciblée.
export type PlannerProgressStep = "context" | "matching" | "model" | "checks" | "retry";
export type PlannerStreamError = { status: number; code: string; message: string; step?: PlannerStepName | null };
export type PlannerStreamState = {
  running: boolean;
  steps: PlannerProgressStep[];
  // « Ce que j'ai compris », à mesure que le serveur l'écrit.
  summary: string | null;
  plan: PlannerStreamPlanLine[];
  error: PlannerStreamError | null;
};
const idle: PlannerStreamState = { running: false, steps: [], summary: null, plan: [], error: null };

/** Lit un flux `text/event-stream` : chaque événement complet, dans l'ordre. */
async function* events(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = done ? "" : chunks.pop()!;
    for (const chunk of chunks) {
      const event = /^event: (.+)$/m.exec(chunk)?.[1];
      const data = /^data: (.+)$/m.exec(chunk)?.[1];
      if (event && data) yield { event, data: JSON.parse(data) as unknown };
    }
    if (done) return;
  }
}

/**
 * Génération diffusée : les étapes, puis le plan de la séance à mesure qu'il s'écrit, puis la proposition.
 * Si la connexion tombe, la génération continue sur le serveur : on relit la proposition sans la relancer.
 */
export function usePlannerStream(orgId: string, onResult: (proposal: PlannerProposalResponse) => void) {
  const [state, setState] = useState<PlannerStreamState>(idle);
  const alive = useRef(true);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, []);
  const update = useCallback((patch: Partial<PlannerStreamState>) => {
    if (alive.current) setState((old) => ({ ...old, ...patch }));
  }, []);

  // Après une coupure, la proposition se relit jusqu'à ce que le serveur ait fini (au plus deux minutes).
  const recover = useCallback(
    async (proposalId: string, signal: AbortSignal) => {
      for (let attempt = 0; attempt < 40 && !signal.aborted; attempt++) {
        const proposal = await api.plannerProposal(orgId, proposalId, signal).catch(() => null);
        if (proposal && proposal.state !== "processing") return proposal;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      return null;
    },
    [orgId],
  );

  const send = useCallback(
    async (path: string, body: unknown, proposalId: string) => {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      setState({ running: true, steps: [], summary: null, plan: [], error: null });
      let finished = false;
      try {
        const response = await fetch(`/api/v1/orgs/${orgId}${path}`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(body),
        });
        if (!response.ok || !response.body) {
          const error = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
          update({
            error: {
              status: response.status,
              code: error?.code ?? "network",
              message: error?.message ?? m.common.genericError,
            },
          });
          finished = true;
          return;
        }
        for await (const raw of events(response.body)) {
          if (raw.event === "result") {
            const proposal = plannerProposalResponse.safeParse(raw.data);
            if (proposal.success && alive.current) onResult(proposal.data);
            finished = true;
            continue;
          }
          const event = plannerStreamEvent.safeParse(raw);
          if (!event.success) continue;
          const reach = (step: PlannerProgressStep, patch: Partial<PlannerStreamState> = {}) =>
            setState((old) => ({
              ...old,
              ...patch,
              steps: old.steps.includes(step) ? old.steps : [...old.steps, step],
            }));
          if (event.data.event === "understanding")
            reach("context", event.data.data.summary ? { summary: event.data.data.summary } : {});
          else if (event.data.event === "matching") reach("matching");
          else if (event.data.event === "composing") reach("model", { plan: event.data.data.lines });
          else if (event.data.event === "checking") reach(event.data.data.repairs ? "retry" : "checks");
          else if (event.data.event === "error") {
            update({ error: event.data.data });
            finished = true;
          }
        }
      } catch {
        /* coupure : relue ci-dessous */
      } finally {
        if (!finished && !controller.signal.aborted) {
          const proposal = await recover(proposalId, controller.signal);
          if (proposal && alive.current) onResult(proposal);
          else update({ error: { status: 0, code: "network", message: m.common.genericError } });
        }
        if (active.current === controller) active.current = null;
        update({ running: false });
      }
    },
    [orgId, onResult, recover, update],
  );

  return {
    state,
    create: (input: CreatePlannerProposalInput) => send("/planner", input, input.id),
    clarify: (proposalId: string, input: ClarifyPlannerProposalInput) =>
      send(`/planner/proposals/${proposalId}/clarify`, input, proposalId),
    clearError: useCallback(() => update({ error: null }), [update]),
  };
}
