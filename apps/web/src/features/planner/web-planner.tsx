"use client";

import { createApiClient } from "@tartan/api-client";
import type {
  CreatePlannerProposalInput,
  PlannerProposalResponse,
  PlannerSelection,
  PlannerUsageResponse,
} from "@tartan/contracts";
import { plannerProposalsExhausted } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chip } from "@/components/states";
import { LaneNumber } from "@/components/lane-number";
import { TrackLine } from "@/components/track";
import { cn } from "@/lib/cn";
import { PlannerProgress } from "./planner-progress";
import { PlannerRequest, plannerRequestFrom, type PlannerContext, type PlannerRequestValue } from "./planner-request";
import { PlannerResult } from "./planner-result";
import { usePlannerStream } from "./use-planner-stream";

const api = createApiClient({ baseUrl: "" });
const t = w.planner;
const showProposal = (id: string | null) => {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("proposition", id);
  else url.searchParams.delete("proposition");
  window.history.replaceState(null, "", url);
};

/** Les deux temps de l'écran, numérotés comme des couloirs : la demande, puis la séance. */
function Stages({ current }: { current: 1 | 2 }) {
  return (
    <ol
      className="flex items-center gap-3"
      aria-label={t.stage(current, current === 1 ? t.stages.request : t.stages.session)}
    >
      {([1, 2] as const).map((n) => (
        <li key={n} aria-current={n === current ? "step" : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={cn("flex items-baseline gap-2", n === current ? "font-semibold" : "text-soft")}>
            <LaneNumber n={n} className="text-2xl" />
            {n === 1 ? t.stages.request : t.stages.session}
          </span>
          <TrackLine className={cn(n === current ? "border-accent" : "opacity-50")} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Planificateur IA en deux temps. « Demande » : qui, quand, le mode et la consigne, en un seul envoi.
 * « Séance » : la réponse diffusée, puis la séance dans l'éditeur du constructeur et une seule confirmation.
 */
export function WebPlanner({
  orgId,
  context,
  initial,
  initialUsage,
  initialSelection,
  equipment,
}: {
  orgId: string;
  context: PlannerContext;
  initial: PlannerProposalResponse | null;
  initialUsage: PlannerUsageResponse;
  initialSelection: PlannerSelection;
  equipment: string[];
}) {
  const [proposal, setProposal] = useState(initial);
  // La bibliothèque peut grandir pendant une clarification (fiche privée créée) : l'éditeur la relit.
  const [library, setLibrary] = useState(context);
  const [request, setRequest] = useState<PlannerRequestValue>(() =>
    plannerRequestFrom(initial?.selection ?? initialSelection, equipment),
  );
  const [usage, setUsage] = useState(initialUsage);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const receive = useCallback(
    (next: PlannerProposalResponse) => {
      setProposal(next);
      setError("");
      showProposal(next.id);
      void api
        .plannerUsage(orgId)
        .then(setUsage)
        .catch(() => undefined);
    },
    [orgId],
  );
  const stream = usePlannerStream(orgId, receive);
  // L'erreur affichée : celle de l'écran, sinon celle du flux. Une seule à la fois, toujours lisible.
  const shown = error || stream.state.error?.message || "";
  useEffect(() => {
    if (shown) errorRef.current?.focus();
  }, [shown]);
  const { clearError } = stream;
  const reset = useCallback(() => {
    setError("");
    clearError();
  }, [clearError]);
  const fail = useCallback((message: string) => setError(message), []);
  const exhausted = plannerProposalsExhausted(usage);
  const left = Math.max(0, usage.limit.proposals - usage.used.proposals - usage.reserved.proposals);

  return (
    <div className="on-card flex min-w-0 flex-col gap-6 rounded-card bg-card p-4 desktop:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip>{m.aiPlanner.beta}</Chip>
        <p className="t-caption text-soft">{exhausted ? m.aiPlanner.quotaExceeded : t.quota(left)}</p>
      </div>
      <Stages current={proposal ? 2 : 1} />
      {shown ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-button border border-st-missed px-3 py-2">
          {shown}
        </p>
      ) : null}
      {/* Pendant la génération, les étapes prennent la place de la demande : visibles sans défiler, au téléphone. */}
      {!proposal && stream.state.running ? <PlannerProgress state={stream.state} /> : null}
      {!proposal && !stream.state.running ? (
        <>
          <PlannerRequest
            orgId={orgId}
            context={library}
            value={request}
            onChange={setRequest}
            busy={stream.state.running}
            exhausted={exhausted}
            onSubmit={(input: CreatePlannerProposalInput) => {
              reset();
              // L'adresse porte la demande dès l'envoi : un rechargement relit son résultat, même en échec.
              showProposal(input.id);
              void stream.create(input);
            }}
          />
        </>
      ) : null}
      {proposal ? (
        <PlannerResult
          key={proposal.id}
          orgId={orgId}
          context={library}
          proposal={proposal}
          stream={stream.state}
          onClarify={(input) => {
            reset();
            void stream.clarify(proposal.id, input);
          }}
          onProposal={receive}
          onError={fail}
          onExercises={(exercises) => setLibrary((current) => ({ ...current, exercises }))}
          onRestart={() => {
            // La demande reste préremplie : une nouvelle proposition repart de ce que le coach avait écrit.
            setRequest({
              ...plannerRequestFrom(proposal.selection, equipment),
              text: proposal.selection.brief?.objective ?? proposal.messages[0] ?? "",
            });
            setProposal(null);
            reset();
            showProposal(null);
          }}
        />
      ) : null}
    </div>
  );
}
