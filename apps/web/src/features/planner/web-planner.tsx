"use client";

import { createApiClient } from "@tartan/api-client";
import {
  plannerBrief,
  createPlannerProposalInput,
  clarifyPlannerProposalInput,
  confirmPlannerProposalInput,
  type PlannerProposalResponse,
  type PlannerSelection,
  type PlannerUsageResponse,
  type PlannerReviewedDraft,
  type CreatePlannerProposalInput,
  type ClarifyPlannerProposalInput,
  type ConfirmPlannerProposalInput,
} from "@tartan/contracts";
import {
  plannerDisplayText,
  plannerProposalsExhausted,
  phasePlanningKey,
  type PhasePlanningReadiness,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chip } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import { PlannerSelectionForm, type PlannerContext } from "./planner-selection";
import { PlannerDraftReview } from "./planner-review";
import { DateInput } from "@/components/ui/date-input";
import { PlannerExerciseResolution } from "./planner-exercise-resolution";
import { WebPlannerDictation } from "./web-dictation";

const api = createApiClient({ baseUrl: "" });
const t = m.aiPlanner;
const proposalUrl = (id: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("proposition", id);
  window.history.replaceState(null, "", url);
};

export function WebPlanner({
  orgId,
  context: initialContext,
  initial,
  initialUsage,
  initialSelection,
}: {
  orgId: string;
  context: PlannerContext;
  initial: PlannerProposalResponse | null;
  initialUsage: PlannerUsageResponse;
  initialSelection: PlannerSelection;
}) {
  const [context, setContext] = useState(initialContext);
  const [selection, setSelection] = useState(initial?.selection ?? initialSelection);
  const [contextReady, setContextReady] = useState(Boolean(initial));
  const [text, setText] = useState("");
  const [equipmentText, setEquipmentText] = useState(initial?.selection.brief?.equipment.join(", ") ?? "");
  const [reviewed, setReviewed] = useState(false);
  const [proposal, setProposal] = useState(initial);
  const verifiedCatalogAvailable = context.exercises.some((exercise) => exercise.guide?.technicalReview === "approved");
  const displayText = (value: string) => plannerDisplayText(value, proposal);
  const [usage, setUsage] = useState(initialUsage);
  const [reply, setReply] = useState("");
  const [replyReviewed, setReplyReviewed] = useState(false);
  const [drafts, setDrafts] = useState<PlannerReviewedDraft[] | null>(null);
  const [draftsReviewed, setDraftsReviewed] = useState(false);
  const [phases, setPhases] = useState<Record<number, PhasePlanningReadiness>>({});
  const [loads, setLoads] = useState<Record<number, { key: string; ready: boolean }>>({});
  const [created, setCreated] = useState(initial?.draftIds ?? null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [online, setOnline] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const pendingCreate = useRef<CreatePlannerProposalInput | null>(null);
  const pendingReply = useRef<ClarifyPlannerProposalInput | null>(null);
  const pendingConfirmation = useRef<ConfirmPlannerProposalInput | null>(null);
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    alive.current = true;
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      alive.current = false;
      active.current?.abort();
      active.current = null;
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const dirty = !created && (busy || recording || Boolean(text.trim()) || Boolean(reply.trim()) || Boolean(drafts));
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const follow = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download"))
        return;
      const url = new URL(anchor.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(anchor.href);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", follow, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", follow, true);
    };
  }, [dirty]);
  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (active.current || recording || !online) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      await work(controller.signal);
    } catch (cause) {
      if (alive.current && active.current === controller)
        setError(cause instanceof Error ? cause.message : m.common.genericError);
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        if (alive.current) setBusy(false);
      }
    }
  };
  const updateUsage = async (signal: AbortSignal) => {
    try {
      const next = await api.plannerUsage(orgId, signal);
      if (alive.current && !signal.aborted) setUsage(next);
    } catch {
      /* le résultat reçu reste visible */
    }
  };
  const receive = (next: PlannerProposalResponse) => {
    if (!alive.current) return;
    setProposal(next);
    setText("");
    setDrafts(null);
    setDraftsReviewed(false);
    setCreated(next.draftIds);
    setReply("");
    setReplyReviewed(false);
    setReplySent(false);
    pendingReply.current = null;
    proposalUrl(next.id);
  };
  const generate = () =>
    run(async (signal) => {
      const input =
        pendingCreate.current ??
        createPlannerProposalInput.parse({
          id: crypto.randomUUID(),
          requestedAt: new Date().toISOString(),
          selection:
            selection.mode === "propose"
              ? { ...selection, brief: { ...selection.brief!, objective: text } }
              : selection,
          text,
          reviewed,
        });
      pendingCreate.current = input;
      setSent(true);
      proposalUrl(input.id);
      const result = await api.createPlannerProposal(orgId, input, signal);
      if (!signal.aborted) receive(result);
      await updateUsage(signal);
    });
  const refresh = () =>
    run(async (signal) => {
      const id = proposal?.id ?? pendingCreate.current?.id;
      if (id) {
        const next = await api.plannerProposal(orgId, id, signal);
        if (!alive.current || signal.aborted) return;
        if (pendingConfirmation.current && next.state !== "committed" && next.version === proposal?.version) {
          pendingConfirmation.current = null;
          setConfirmationPending(false);
          setDraftsReviewed(false);
          setError(t.reviewAgain);
        } else receive(next);
      }
      await updateUsage(signal);
    });
  const clarify = () =>
    run(async (signal) => {
      if (!proposal) return;
      const input =
        pendingReply.current ??
        clarifyPlannerProposalInput.parse({
          operationId: crypto.randomUUID(),
          expectedVersion: proposal.version,
          text: reply,
          reviewed: replyReviewed,
        });
      pendingReply.current = input;
      setReplySent(true);
      const result = await api.clarifyPlannerProposal(orgId, proposal.id, input, signal);
      if (!signal.aborted) receive(result);
      await updateUsage(signal);
    });
  const prepare = () =>
    run(async (signal) => {
      if (!proposal) return;
      const result = await api.preparePlannerDrafts(orgId, proposal.id, proposal.version, signal);
      if (!alive.current || signal.aborted) return;
      setDrafts(result.sessions);
      setPhases({});
      setLoads({});
      setDraftsReviewed(false);
      pendingConfirmation.current = null;
      setConfirmationPending(false);
    });
  const updateDraft = useCallback((index: number, update: (draft: PlannerReviewedDraft) => PlannerReviewedDraft) => {
    setDrafts((old) => {
      if (!old?.[index]) return old;
      const next = update(old[index]);
      return next === old[index] ? old : old.map((s, i) => (i === index ? next : s));
    });
    setDraftsReviewed(false);
  }, []);
  const acceptPhase = useCallback(
    (index: number, state: PhasePlanningReadiness) =>
      setPhases((old) => (JSON.stringify(old[index]) === JSON.stringify(state) ? old : { ...old, [index]: state })),
    [],
  );
  const acceptLoads = useCallback(
    (index: number, key: string, ready: boolean) =>
      setLoads((old) =>
        old[index]?.key === key && old[index]?.ready === ready ? old : { ...old, [index]: { key, ready } },
      ),
    [],
  );
  const phasesReady =
    !context.phasesEnabled ||
    Boolean(
      drafts?.every(
        (draft, index) =>
          phases[index]?.ready &&
          phases[index]?.key ===
            phasePlanningKey(
              draft.date,
              draft.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
              draft.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
            ),
      ),
    );
  const loadsReady = Boolean(
    drafts?.every((draft, index) => loads[index]?.ready && loads[index]?.key === JSON.stringify(draft)),
  );
  const draftsValid =
    proposal &&
    drafts &&
    drafts.every(
      (draft) =>
        draft.date >= selection.period.from && draft.date <= selection.period.to && draft.assignments.length > 0,
    ) &&
    confirmPlannerProposalInput.safeParse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true })
      .success;
  const confirm = () =>
    run(async (signal) => {
      if (!proposal || !drafts || !draftsReviewed || !phasesReady || !loadsReady || !draftsValid) return;
      const input =
        pendingConfirmation.current ??
        confirmPlannerProposalInput.parse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true });
      pendingConfirmation.current = input;
      setConfirmationPending(true);
      const result = await api.confirmPlannerProposal(orgId, proposal.id, input, signal);
      if (alive.current && !signal.aborted) setCreated(result.sessions);
    });
  const disabled = busy || recording || !online;
  const exhausted = plannerProposalsExhausted(usage);
  const startNew = () => {
    pendingCreate.current = null;
    pendingReply.current = null;
    pendingConfirmation.current = null;
    setConfirmationPending(false);
    setProposal(null);
    setCreated(null);
    setDrafts(null);
    setContextReady(false);
    setText("");
    setReply("");
    setReviewed(false);
    setReplyReviewed(false);
    setSent(false);
    setReplySent(false);
    setError("");
    setPhases({});
    setLoads({});
    const url = new URL(window.location.href);
    url.searchParams.delete("proposition");
    window.history.replaceState(null, "", url);
  };
  return (
    <div className="on-card flex min-w-0 flex-col gap-4 rounded-card bg-card p-4 desktop:p-6">
      <div>
        <Chip>{t.beta}</Chip>
      </div>
      {exhausted && !proposal ? <p role="status">{t.quotaExceeded}</p> : null}
      <details>
        <summary className="min-h-11 cursor-pointer py-2">{t.quotaDetails}</summary>
        <p>{t.usage(usage.used.proposals, usage.reserved.proposals, usage.limit.proposals)}</p>
        <p>{t.audioUsage(usage.used.audioSeconds, usage.reserved.audioSeconds, usage.limit.audioSeconds)}</p>
        <p>{t.timeZone(usage.timeZone)}</p>
      </details>
      {!online ? <p role="status">{m.offline.bar}</p> : null}
      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert">
          {error}
        </p>
      ) : null}
      {!proposal && !contextReady ? (
        <PlannerSelectionForm
          orgId={orgId}
          context={context}
          initial={selection}
          onContinue={(next) => {
            setSelection(next);
            setContextReady(true);
          }}
        />
      ) : null}
      {!proposal && contextReady ? (
        <section className="flex min-w-0 flex-col gap-3">
          <p className="font-semibold">
            {historyDate(selection.period.from)} – {historyDate(selection.period.to)}
          </p>
          <p className="break-words">
            {[
              ...context.groups.filter((g) => selection.groupIds.includes(g.id)).map((g) => g.name),
              ...context.athletes
                .filter((a) => selection.athleteIds.includes(a.id))
                .map((a) => `${a.firstName} ${a.lastName}`),
            ].join(", ")}
          </p>
          <Button type="button" variant="secondary" disabled={disabled || sent} onClick={() => setContextReady(false)}>
            {t.changeContext}
          </Button>
          <Field label={t.mode}>
            {(a) => (
              <Select
                {...a}
                value={selection.mode ?? "format"}
                disabled={disabled || sent}
                onChange={(e) => {
                  const mode = e.target.value as "format" | "propose";
                  setSelection((old) => ({
                    ...old,
                    mode,
                    ...(mode === "propose" ? { exerciseIds: [] } : {}),
                    brief:
                      mode === "propose"
                        ? (old.brief ?? {
                            objective: text,
                            date: old.period.from,
                            durationMin: 45,
                            level: "intermediate",
                            equipment: [],
                          })
                        : undefined,
                  }));
                  setReviewed(false);
                }}
              >
                <option value="format">{t.formatMode}</option>
                <option value="propose">{t.proposeMode}</option>
              </Select>
            )}
          </Field>
          {selection.mode === "propose" && selection.brief ? (
            <>
              <p>{t.proposalNotice}</p>
              {!verifiedCatalogAvailable ? <p role="status">{t.verifiedCatalogRequired}</p> : null}
              <Field label={t.proposalDate}>
                {(a) => (
                  <DateInput
                    {...a}
                    value={selection.brief!.date}
                    disabled={disabled || sent}
                    min={selection.period.from}
                    max={selection.period.to}
                    onChange={(value) => {
                      setSelection((old) => ({ ...old, brief: { ...old.brief!, date: value.target.value } }));
                      setReviewed(false);
                    }}
                  />
                )}
              </Field>
              <Field label={t.proposalDuration}>
                {(a) => (
                  <Input
                    {...a}
                    type="number"
                    min={5}
                    max={180}
                    value={selection.brief!.durationMin}
                    disabled={disabled || sent}
                    onChange={(e) => {
                      setSelection((old) => ({
                        ...old,
                        brief: { ...old.brief!, durationMin: Number(e.target.value) },
                      }));
                      setReviewed(false);
                    }}
                  />
                )}
              </Field>
              <Field label={t.proposalLevel}>
                {(a) => (
                  <Select
                    {...a}
                    value={selection.brief!.level}
                    disabled={disabled || sent}
                    onChange={(e) => {
                      setSelection((old) => ({
                        ...old,
                        brief: { ...old.brief!, level: e.target.value as "beginner" | "intermediate" | "advanced" },
                      }));
                      setReviewed(false);
                    }}
                  >
                    {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                      <option key={level} value={level}>
                        {t.proposalLevels[level]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t.proposalEquipment}>
                {(a) => (
                  <Input
                    {...a}
                    value={equipmentText}
                    disabled={disabled || sent}
                    onChange={(e) => {
                      setSelection((old) => ({
                        ...old,
                        brief: {
                          ...old.brief!,
                          equipment: e.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        },
                      }));
                      setEquipmentText(e.target.value);
                      setReviewed(false);
                    }}
                  />
                )}
              </Field>
            </>
          ) : null}
          <Field
            label={selection.mode === "propose" ? t.objective : t.instructions}
            hint={selection.mode === "propose" ? t.objectiveHint : t.instructionsHint}
          >
            {(a) => (
              <Textarea
                {...a}
                value={text}
                disabled={disabled || sent}
                onChange={(e) => {
                  setText(e.target.value);
                  if (selection.mode === "propose")
                    setSelection((old) => ({ ...old, brief: { ...old.brief!, objective: e.target.value } }));
                  setReviewed(false);
                }}
              />
            )}
          </Field>
          {text.length > (selection.mode === "propose" ? 1000 : 12000) ? (
            <p role="alert">{t.textLimit(text.length, selection.mode === "propose" ? 1000 : 12000)}</p>
          ) : null}
          {!sent ? (
            <WebPlannerDictation
              key={orgId}
              orgId={orgId}
              disabled={busy || !online}
              onBusyChange={setRecording}
              onText={(value) => {
                setText((old) => (old.trim() ? `${old}\n${value}` : value));
                setReviewed(false);
              }}
            />
          ) : null}
          <CheckRow
            label={t.reviewed}
            checked={reviewed}
            disabled={disabled || sent}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          {sent ? <p>{t.immutableRequest}</p> : null}
          <Button
            type="button"
            disabled={
              disabled ||
              exhausted ||
              !reviewed ||
              !text.trim() ||
              text.length > 12000 ||
              (selection.mode === "propose" &&
                (!verifiedCatalogAvailable || !plannerBrief.safeParse({ ...selection.brief, objective: text }).success))
            }
            onClick={() => {
              void generate();
            }}
          >
            {busy ? m.common.loading : t.propose}
          </Button>
          {sent ? (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                void refresh();
              }}
            >
              {t.recover}
            </Button>
          ) : null}
          <p className="text-soft">{t.leaveDraft}</p>
        </section>
      ) : null}
      {proposal && !created ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="t-section">{t.instructions}</h2>
            {proposal.messages.map((message, i) => (
              <p key={i} className="whitespace-pre-wrap break-words">
                {displayText(message)}
              </p>
            ))}
            {proposal.pendingText ? (
              <>
                <h3 className="font-semibold">{t.pendingAnswer}</h3>
                <p className="whitespace-pre-wrap break-words">{displayText(proposal.pendingText)}</p>
              </>
            ) : null}
            <p className="text-soft">{t.expiry(new Date(proposal.expiresAt).toLocaleString("fr-FR"))}</p>
          </section>
          {proposal.state === "processing" ? <p role="status">{t.processing}</p> : null}
          {proposal.state === "failed" ? <p role="alert">{t.proposalFailed}</p> : null}
          {proposal.state === "clarification" ? (
            <section className="flex flex-col gap-3">
              <h2 className="t-section">{t.clarifyTitle}</h2>
              <p>{t.clarificationCount(proposal.clarificationCount)}</p>
              {proposal.interpretation?.questions.map((q) => (
                <div key={`${proposal.clarificationCount}-${q.id}`} className="flex flex-col gap-2">
                  <p className="font-semibold">{displayText(q.question)}</p>
                  {q.field === "exercise" ? (
                    <PlannerExerciseResolution
                      questionId={q.id}
                      requestedName={q.exerciseName}
                      version={proposal.version}
                      exercises={
                        proposal.selection.mode === "propose"
                          ? context.exercises.filter((exercise) => exercise.guide?.technicalReview === "approved")
                          : context.exercises
                      }
                      allowCreate={proposal.selection.mode !== "propose"}
                      disabled={disabled || replySent}
                      resolved={proposal.exerciseResolutions?.find((entry) => entry.questionId === q.id)?.name}
                      onResolve={(input) =>
                        run(async (signal) => {
                          const updated = await api.resolvePlannerExercise(orgId, proposal.id, input, signal);
                          setProposal(updated);
                          setReplyReviewed(false);
                          const exercises = await api.exercises(orgId);
                          if (alive.current && !signal.aborted) setContext((old) => ({ ...old, exercises }));
                        })
                      }
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((option, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant="secondary"
                        disabled={disabled || replySent}
                        onClick={() => {
                          setReply(
                            (old) => `${old}${old ? "\n" : ""}${displayText(q.question)} ${displayText(option)}`,
                          );
                          setReplyReviewed(false);
                        }}
                      >
                        {displayText(option)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {proposal.clarificationCount < 5 ? (
                <>
                  <Field label={t.clarificationAnswer}>
                    {(a) => (
                      <Textarea
                        {...a}
                        value={reply}
                        disabled={disabled || replySent}
                        onChange={(e) => {
                          setReply(e.target.value);
                          setReplyReviewed(false);
                        }}
                      />
                    )}
                  </Field>
                  {reply.length > 12000 ? <p role="alert">{t.textTooLong}</p> : null}
                  <CheckRow
                    label={t.reviewed}
                    checked={replyReviewed}
                    disabled={disabled || replySent}
                    onChange={(e) => setReplyReviewed(e.target.checked)}
                  />
                  {replySent ? <p>{t.immutableRequest}</p> : null}
                  <Button
                    type="button"
                    disabled={disabled || !replyReviewed || !reply.trim() || reply.length > 12000}
                    onClick={() => {
                      void clarify();
                    }}
                  >
                    {t.clarify}
                  </Button>
                </>
              ) : (
                <p>{t.clarificationLimit}</p>
              )}
            </section>
          ) : null}
          {proposal.interpretation?.assumptions.length ? (
            <section>
              <h2 className="t-section">{t.assumptions}</h2>
              <ul className="list-disc pl-5">
                {proposal.interpretation.assumptions.map((s, i) => (
                  <li key={i}>{displayText(s)}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {proposal.interpretation?.suggestions.length ? (
            <section>
              <h2 className="t-section">{t.suggestions}</h2>
              <ul className="list-disc pl-5">
                {proposal.interpretation.suggestions.map((s, i) => (
                  <li key={i}>{displayText(s)}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {proposal.state === "proposal" && !drafts ? (
            <>
              <h2 className="t-section">{t.quotedInstruction}</h2>
              {proposal.interpretation?.sessions.map((s, i) => (
                <section key={i} className="rounded-card border border-card-line p-3">
                  <h3 className="font-semibold">
                    {historyDate(s.date)} · {displayText(s.title)}
                  </h3>
                  {s.blocks
                    .flatMap((b) => b.items)
                    .map((item, j) => (
                      <blockquote
                        key={j}
                        className="mt-2 border-l-2 border-card-line pl-3 whitespace-pre-wrap break-words"
                      >
                        {displayText(item.instruction)}
                      </blockquote>
                    ))}
                </section>
              ))}
              <Button
                type="button"
                disabled={disabled}
                onClick={() => {
                  void prepare();
                }}
              >
                {t.prepareReview}
              </Button>
            </>
          ) : null}
          {!drafts || confirmationPending ? (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                void refresh();
              }}
            >
              {t.refresh}
            </Button>
          ) : null}
          {drafts ? (
            <>
              <p>{t.noAutomaticLoad}</p>
              {drafts.map((session, index) => (
                <PlannerDraftReview
                  key={index}
                  index={index}
                  session={session}
                  context={context}
                  proposal={proposal}
                  orgId={orgId}
                  busy={disabled || confirmationPending}
                  onUpdate={updateDraft}
                  onPhaseReady={acceptPhase}
                  onLoadsReady={acceptLoads}
                />
              ))}
              <p>{t.noPublication}</p>
              {!draftsValid ? <p role="status">{t.draftsInvalid}</p> : null}
              {!loadsReady ? <p>{t.previewRequired}</p> : null}
              <CheckRow
                label={t.reviewedDrafts}
                checked={draftsReviewed}
                disabled={disabled}
                onChange={(e) => setDraftsReviewed(e.target.checked)}
              />
              <Button
                type="button"
                disabled={disabled || !draftsReviewed || !phasesReady || !loadsReady || !draftsValid}
                onClick={() => {
                  void confirm();
                }}
              >
                {t.confirmDrafts(drafts.length)}
              </Button>
              <p className="text-soft">{t.leaveDraft}</p>
            </>
          ) : null}
        </>
      ) : null}
      {created ? (
        <section className="flex flex-col gap-3">
          <p role="status">{t.draftsCreated}</p>
          {created.map((session, index) => (
            <Button key={session.id} asChild variant="secondary">
              <Link href={`/seances/${session.id}`}>
                {m.common.edit} · {drafts?.[index]?.draft.title ?? t.createdDraft(index + 1)}
              </Link>
            </Button>
          ))}
          <Button asChild>
            <Link href="/calendrier">{m.nav.calendrier}</Link>
          </Button>
        </section>
      ) : null}
      {(proposal || sent) && !disabled ? (
        <Button type="button" variant="quiet" onClick={() => setNewOpen(true)}>
          {t.newProposal}
        </Button>
      ) : null}
      <ConfirmDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        title={t.newProposal}
        description={`${t.newProposalHint} ${t.leaveDraft}`}
        tone="neutral"
        confirmLabel={m.common.yes}
        onConfirm={startNew}
      />
      <ConfirmDialog
        open={Boolean(leaveHref)}
        onOpenChange={(open) => {
          if (!open) setLeaveHref(null);
        }}
        title={m.common.back}
        description={t.leaveDraft}
        tone="neutral"
        confirmLabel={m.common.yes}
        onConfirm={() => {
          if (!leaveHref) return;
          const url = new URL(leaveHref);
          active.current?.abort();
          setLeaveHref(null);
          if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);
          else window.location.assign(url);
        }}
      />
    </div>
  );
}
