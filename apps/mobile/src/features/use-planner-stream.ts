import {
  plannerProposalResponse,
  type ClarifyPlannerProposalInput,
  type CreatePlannerProposalInput,
  type PlannerProposalResponse,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, openPlannerStream } from "../lib/api";
import {
  applyPlannerEvent,
  idlePlannerStream,
  readPlannerEvents,
  type PlannerStreamError,
  type PlannerStreamState,
} from "../lib/planner-stream";

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Génération diffusée : ce que le planificateur a compris, ses étapes, puis le plan de la séance à mesure qu'il
 * s'écrit, et la proposition. La génération ne dépend pas de la connexion : si le flux ne se lit pas (réseau coupé,
 * application en arrière-plan, corps de réponse illisible), la proposition se relit toutes les trois secondes
 * jusqu'à ce que le serveur ait fini, deux minutes au plus, sans jamais la relancer.
 */
export function usePlannerStream(orgId: string, onResult: (proposal: PlannerProposalResponse) => void) {
  const [state, setState] = useState<PlannerStreamState>(idlePlannerStream);
  const alive = useRef(true);
  const active = useRef<AbortController | null>(null);
  const result = useRef(onResult);
  useEffect(() => {
    result.current = onResult;
  }, [onResult]);
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

  const recover = useCallback(
    async (proposalId: string, signal: AbortSignal) => {
      for (let attempt = 0; attempt < 40 && !signal.aborted; attempt++) {
        const proposal = await api.plannerProposal(orgId, proposalId, signal).catch(() => null);
        if (proposal && proposal.state !== "processing") return proposal;
        await wait(3000, signal);
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
      setState({ ...idlePlannerStream, running: true });
      let finished = false;
      const fail = (error: PlannerStreamError) => {
        update({ error });
        finished = true;
      };
      try {
        const response = await openPlannerStream(`/orgs/${orgId}${path}`, body, controller.signal);
        const json = !(response.headers.get("content-type") ?? "").includes("text/event-stream");
        if (!response.ok || json || !response.body) {
          const data = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
          // Un serveur qui rend la proposition d'une seule pièce reste compris.
          const proposal = response.ok ? plannerProposalResponse.safeParse(data) : null;
          if (proposal?.success) {
            if (alive.current) result.current(proposal.data);
            finished = true;
          } else if (!response.ok)
            fail({
              status: response.status,
              code: data?.code ?? "network",
              message: data?.message ?? m.common.genericError,
            });
          return;
        }
        let current = { ...idlePlannerStream, running: true };
        await readPlannerEvents(response.body, (raw) => {
          const next = applyPlannerEvent(current, raw);
          current = next.state;
          if (alive.current) setState(current);
          if (next.result) {
            if (alive.current) result.current(next.result);
            finished = true;
          } else if (next.error) finished = true;
        });
      } catch {
        /* coupure : relue ci-dessous */
      } finally {
        if (!finished && !controller.signal.aborted) {
          const proposal = await recover(proposalId, controller.signal);
          if (proposal && alive.current) result.current(proposal);
          else if (!controller.signal.aborted)
            update({ error: { status: 0, code: "network", message: m.common.genericError } });
        }
        if (active.current === controller) active.current = null;
        update({ running: false });
      }
    },
    [orgId, recover, update],
  );

  return {
    state,
    create: (input: CreatePlannerProposalInput) => send("/planner", input, input.id),
    clarify: (proposalId: string, input: ClarifyPlannerProposalInput) =>
      send(`/planner/proposals/${proposalId}/clarify`, input, proposalId),
    clearError: useCallback(() => update({ error: null }), [update]),
    stop: useCallback(() => active.current?.abort(), []),
  };
}
