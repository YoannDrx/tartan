"use client";

import { createApiClient } from "@tartan/api-client";
import type {
  CreatePlannerProposalInput,
  ExerciseList,
  ExerciseSummary,
  PlannerProposalResponse,
  PlannerSelection,
  PlannerUsageResponse,
} from "@tartan/contracts";
import { plannerProposalsExhausted } from "@tartan/domain";
import { w } from "@tartan/i18n/web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LaneNumber } from "@/components/lane-number";
import { TrackLine } from "@/components/track";
import { ExerciseSource } from "@/features/sessions/exercise-picker";
import { PlannerSolo } from "./planner-solo";
import { cn } from "@/lib/cn";
import { PlannerAliases } from "./planner-aliases";
import { PlannerProgress } from "./planner-progress";
import {
  PlannerRequest,
  plannerRequestFrom,
  type PlannerContext,
  type PlannerEquipment,
  type PlannerRequestValue,
} from "./planner-request";
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
 * Planificateur IA en deux temps. « Demande » : pour qui, quand, et un seul champ, en un seul envoi. « Séance » :
 * ce qui a été compris, puis la séance dans l'éditeur du constructeur et une seule action pour créer le brouillon.
 */
export function WebPlanner({
  orgId,
  context,
  lists,
  initial,
  routeProposal,
  initialUsage,
  initialSelection,
  equipment,
  solo = false,
}: {
  orgId: string;
  context: PlannerContext;
  /** Les listes du coach, pour chercher une fiche dans toute sa bibliothèque. */
  lists: ExerciseList[];
  initial: PlannerProposalResponse | null;
  /** La proposition que l'adresse désigne, ou null : elle change quand le coach navigue, pas quand l'écran travaille. */
  routeProposal: string | null;
  initialUsage: PlannerUsageResponse;
  initialSelection: PlannerSelection;
  /** Le matériel du profil de l'espace. */
  equipment: PlannerEquipment[];
  /** Espace personnel : la séance est pour son titulaire, sans destinataires à choisir. */
  solo?: boolean;
}) {
  const [proposal, setProposal] = useState(initial);
  // Les fiches connues de l'écran : la bibliothèque à l'ouverture, puis chaque fiche trouvée ou créée depuis.
  const [known, setKnown] = useState(() => new Map(context.exercises.map((exercise) => [exercise.id, exercise])));
  const remember = useCallback(
    (items: ExerciseSummary[]) =>
      setKnown((current) => {
        if (items.every((item) => current.has(item.id))) return current;
        const next = new Map(current);
        for (const item of items) next.set(item.id, item);
        return next;
      }),
    [],
  );
  const library = useMemo(() => ({ ...context, exercises: [...known.values()] }), [context, known]);
  const source = useMemo(() => ({ lists, remember }), [lists, remember]);
  const [request, setRequest] = useState<PlannerRequestValue>(() =>
    plannerRequestFrom(initial?.selection ?? initialSelection, equipment),
  );
  const [usage, setUsage] = useState(initialUsage);
  const [error, setError] = useState("");
  // La page se rend de nouveau après une action du serveur (une fiche créée depuis la séance) : l'écran garde alors
  // son travail. Il ne repart de la page que si le coach a navigué vers une autre proposition, ou vers une demande
  // neuve.
  const [route, setRoute] = useState(routeProposal);
  if (route !== routeProposal) {
    setRoute(routeProposal);
    if (routeProposal !== (proposal?.id ?? null)) {
      setProposal(initial);
      setRequest(plannerRequestFrom(initial?.selection ?? initialSelection, equipment));
      setError("");
    }
  }
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
    <PlannerSolo.Provider value={solo}>
      <ExerciseSource.Provider value={source}>
        <div className="on-card flex min-w-0 flex-col gap-6 rounded-card bg-card p-4 desktop:p-6">
          <p className="t-caption font-normal text-soft">{exhausted ? t.quotaExceeded : t.quota(left)}</p>
          <Stages current={proposal ? 2 : 1} />
          {shown ? (
            <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-button border border-st-missed px-3 py-2">
              {/* Une panne du planificateur dit aussi à quelle étape elle est survenue. */}
              {!error && stream.state.error?.step ? (
                <span className="font-semibold">{t.failedAt(stream.state.error.step)} </span>
              ) : null}
              <span>{shown}</span>
            </p>
          ) : null}
          {/* Pendant la génération, les étapes prennent la place de la demande : visibles sans défiler, au téléphone. */}
          {!proposal && stream.state.running ? <PlannerProgress state={stream.state} /> : null}
          {!proposal && !stream.state.running ? (
            <>
              <PlannerRequest
                orgId={orgId}
                context={library}
                spaceEquipment={equipment}
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
              <PlannerAliases orgId={orgId} />
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
              onRestart={() => {
                // La demande reste préremplie : une nouvelle proposition repart de ce que le coach avait écrit.
                setRequest({
                  ...plannerRequestFrom(proposal.selection, equipment),
                  text: proposal.messages[0] ?? "",
                });
                setProposal(null);
                reset();
                showProposal(null);
              }}
            />
          ) : null}
        </div>
      </ExerciseSource.Provider>
    </PlannerSolo.Provider>
  );
}
