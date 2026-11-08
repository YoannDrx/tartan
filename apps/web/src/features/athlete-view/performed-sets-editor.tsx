"use client";

import { ConfirmedRecords } from "../progression/confirmed-records";
import { sessionLogPaths } from "@/features/athlete-view/session-log-paths";

import {
  performedSetsDraft,
  performedDraftResolution,
  type AthleteSessionDetail,
  type PerformedSetDraftRow,
  type PerformedSetsDraft,
} from "@tartan/contracts";
import {
  confirmedRecordsFromResponse,
  confirmedSets,
  performedDraftContent,
  performedSetsKey,
  isResolvedDraft,
  draftFromSession,
  performedNumberFields,
  proposedSet,
  type PerformedSetIssue,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, CheckRow } from "@/components/ui/field";
import { sendValidation, newClientId } from "./validation-queue";
import { PerformedDraftReview } from "./performed-draft-review";
import { PreviousSets } from "./previous-sets";
import { getQueueOwner, pendingOps, reviewRequiredOps } from "@/features/offline/op-queue";

export const PerformedSetsEditor = ({
  session: initialSession,
  organizationId,
  userId,
  athleteId,
}: {
  session: AthleteSessionDetail;
  organizationId: string;
  userId: string;
  athleteId?: string;
}) => {
  const [reviewedSession, setReviewedSession] = useState<AthleteSessionDetail | null>(null);
  const session = reviewedSession ?? initialSession;
  const [reviewing, setReviewing] = useState(false);
  const key = performedSetsKey(userId, organizationId, session.id, athleteId);
  const paths = sessionLogPaths(organizationId, session.id, athleteId);
  const [draft, setDraft] = useState<PerformedSetsDraft>(() => draftFromSession(session));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<PerformedSetIssue[]>([]);
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState<ReturnType<typeof confirmedRecordsFromResponse>>([]);
  const [storageError, setStorageError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unreadableDraft, setUnreadableDraft] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = performedSetsDraft.safeParse(JSON.parse(stored));
          if (parsed.success) {
            const receipt = performedDraftResolution.safeParse(
              JSON.parse(localStorage.getItem(`${key}.resolution`) ?? "null"),
            );
            const acknowledged =
              (parsed.data.submittedClientId &&
                parsed.data.submittedClientId === session.log?.clientId &&
                parsed.data.submittedContent === performedDraftContent(parsed.data)) ||
              isResolvedDraft(parsed.data, receipt.success ? receipt.data : null, session.log?.clientId);
            setDraft(acknowledged ? draftFromSession(session) : parsed.data);
          } else {
            setUnreadableDraft(true);
            setStorageError(true);
          }
        }
        const queue = await pendingOps(true);
        if (!active) return;
        const relevant = queue.filter((op) => op.target === session.id && op.path === paths.write);
        if (relevant.length) {
          setLocked(true);
          setMessage(reviewRequiredOps(relevant).length ? m.offline.needsReview : m.progression.queuedSets);
        }
      } catch {
        if (active) {
          setUnreadableDraft(true);
          setStorageError(true);
        }
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
    // Le brouillon est relu à l'ouverture, jamais au milieu d'une saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const updateDraft = (next: PerformedSetsDraft) => {
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  const stale =
    !locked && (draft.sessionVersion !== session.sessionVersion || draft.logVersion !== (session.log?.version ?? 0));
  const patch = (index: number, change: Partial<PerformedSetDraftRow>) =>
    updateDraft({ ...draft, rows: draft.rows.map((row, i) => (i === index ? { ...row, ...change } : row)) });
  const save = async (allowEmpty = false) => {
    const checked = confirmedSets(draft);
    setIssues(checked.issues);
    if (checked.issues.length) {
      setMessage(m.progression.correctSets);
      return;
    }
    if (!allowEmpty && !checked.sets.length && session.log?.detailedSets?.length) {
      setClearConfirm(true);
      return;
    }
    setSaving(true);
    setRecords([]);
    setMessage("");
    const clientId = newClientId();
    updateDraft({ ...draft, submittedClientId: clientId, submittedContent: performedDraftContent(draft) });
    try {
      const result = await sendValidation({
        organizationId,
        sessionId: session.id,
        athleteId,
        athleteName: session.athlete?.name,
        input: {
          clientId,
          writeScope: "sets",
          status: draft.status,
          variantDone: draft.variant,
          expectedVersion: draft.logVersion,
          expectedSessionVersion: draft.sessionVersion,
          detailedSets: checked.sets,
        },
      });
      setMessage(
        result.state === "sent"
          ? m.progression.savedSets
          : result.state === "queued"
            ? m.progression.queuedSets
            : result.message,
      );
      if (result.state === "sent" && getQueueOwner() === userId) setRecords(confirmedRecordsFromResponse(result.data));
      // La relecture serveur est nécessaire avant une autre correction, également après un envoi différé.
      if (result.state !== "error") setLocked(true);
      if (result.state === "sent") localStorage.removeItem(key);
    } catch {
      setMessage(m.common.genericError);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p>{m.progression.setsHint}</p>
      <p className="t-caption">{m.progression.loadHint}</p>
      {stale ? <p role="alert">{m.progression.draftStale}</p> : null}
      {storageError ? <p role="alert">{m.offline.deviceStorageError}</p> : null}
      {stale && ready && !unreadableDraft && !reviewing ? (
        <Button variant="secondary" disabled={saving} onClick={() => setReviewing(true)}>
          {m.progression.reviewDraft}
        </Button>
      ) : null}
      {reviewing ? (
        <PerformedDraftReview
          draft={draft}
          organizationId={organizationId}
          athleteId={athleteId}
          sessionId={session.id}
          onCancel={() => setReviewing(false)}
          onResolve={async (next, current) => {
            const queue = await pendingOps(true);
            const stored = performedSetsDraft.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
            if (
              getQueueOwner() !== userId ||
              !stored.success ||
              performedDraftContent(stored.data) !== performedDraftContent(draft) ||
              queue.some((op) => op.target === session.id && op.path === paths.write)
            )
              throw new Error("DRAFT_CHANGED");
            localStorage.setItem(key, JSON.stringify(next));
            setDraft(next);
            setReviewedSession(current);
            setIssues([]);
            setStorageError(false);
            setMessage(m.progression.draftReady);
            setReviewing(false);
          }}
        />
      ) : null}
      <fieldset
        disabled={
          !ready ||
          saving ||
          locked ||
          unreadableDraft ||
          reviewing ||
          (Boolean(athleteId) && session.canRecordSets !== true)
        }
        className="flex min-w-0 flex-col gap-4"
      >
        {session.blocks
          .flatMap((block) => block.items)
          .map((item) => (
            <section key={item.ref} className="on-card rounded-card bg-card p-4">
              <h2 className="t-h2">{item.name}</h2>
              <p className="t-caption mb-3 text-soft">{item.summary}</p>
              <PreviousSets
                item={item}
                rows={draft.rows}
                previous={session.previousExerciseSets}
                athleteId={session.historyAthleteId}
              />
              <div className="divide-y divide-card-line">
                {draft.rows.map((row, index) =>
                  row.itemRef !== item.ref ? null : (
                    <fieldset key={`${row.itemRef}-${row.setIndex}`} className="grid min-w-0 grid-cols-2 gap-3 py-3">
                      <legend className="t-section">{m.progression.setNumber(row.setIndex + 1)}</legend>
                      <CheckRow
                        className="col-span-2"
                        label={m.progression.confirmSet}
                        checked={row.done}
                        onChange={(event) => patch(index, { done: event.target.checked })}
                      />
                      {performedNumberFields.slice(0, 2).map((field) => (
                        <Field
                          key={field}
                          label={m.progression.fields[field]}
                          error={
                            issues.find(
                              (issue) =>
                                issue.itemRef === row.itemRef &&
                                issue.setIndex === row.setIndex &&
                                issue.field === field,
                            )
                              ? m.progression.issue.invalid
                              : undefined
                          }
                        >
                          {(props) => (
                            <Input
                              {...props}
                              inputMode="decimal"
                              value={row[field]}
                              onChange={(event) => patch(index, { [field]: event.target.value })}
                            />
                          )}
                        </Field>
                      ))}
                      <Field
                        className="col-span-2"
                        label={m.progression.loadKind}
                        error={
                          issues.find(
                            (issue) =>
                              issue.itemRef === row.itemRef &&
                              issue.setIndex === row.setIndex &&
                              issue.field === "loadKind",
                          )
                            ? m.progression.issue.convention
                            : undefined
                        }
                      >
                        {(props) => (
                          <Select
                            {...props}
                            value={row.loadKind}
                            onChange={(event) =>
                              patch(index, {
                                loadKind: event.target.value as PerformedSetDraftRow["loadKind"],
                                ...(event.target.value === "bodyweight" ? { loadKg: "" } : {}),
                              })
                            }
                          >
                            <option value="">{m.progression.chooseConvention}</option>
                            <option value="external">{m.progression.external}</option>
                            <option value="bodyweight">{m.progression.bodyweight}</option>
                            <option value="assisted">{m.progression.assisted}</option>
                          </Select>
                        )}
                      </Field>
                      <details
                        className="col-span-2"
                        open={
                          item.prescription.distance_m !== undefined ||
                          item.prescription.duration_s !== undefined ||
                          item.prescription.ground_contacts !== undefined ||
                          issues.some(
                            (issue) =>
                              issue.itemRef === row.itemRef &&
                              issue.setIndex === row.setIndex &&
                              !["loadKind", "reps", "loadKg"].includes(issue.field),
                          ) ||
                          undefined
                        }
                      >
                        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                          {m.progression.advancedSet}
                        </summary>
                        <div className="grid grid-cols-2 gap-3">
                          {performedNumberFields.slice(2).map((field) => (
                            <Field key={field} label={m.progression.fields[field]}>
                              {(props) => (
                                <Input
                                  {...props}
                                  inputMode="decimal"
                                  value={row[field]}
                                  onChange={(event) => patch(index, { [field]: event.target.value })}
                                />
                              )}
                            </Field>
                          ))}
                          <Field label={m.progression.setKind}>
                            {(props) => (
                              <Select
                                {...props}
                                value={row.setKind}
                                onChange={(event) =>
                                  patch(index, { setKind: event.target.value as PerformedSetDraftRow["setKind"] })
                                }
                              >
                                <option value="work">{m.progression.work}</option>
                                <option value="warmup">{m.progression.warmup}</option>
                              </Select>
                            )}
                          </Field>
                          <Field label={m.progression.repetitionScope}>
                            {(props) => (
                              <Select
                                {...props}
                                value={row.repetitionScope}
                                onChange={(event) =>
                                  patch(index, {
                                    repetitionScope: event.target.value as PerformedSetDraftRow["repetitionScope"],
                                    sideCount: event.target.value === "total" ? 1 : 2,
                                  })
                                }
                              >
                                <option value="total">{m.progression.totalReps}</option>
                                <option value="per_side">{m.progression.perSide}</option>
                              </Select>
                            )}
                          </Field>
                          {row.repetitionScope === "per_side" ? (
                            <Field label={m.progression.sideCount}>
                              {(props) => (
                                <Select
                                  {...props}
                                  value={row.sideCount}
                                  onChange={(event) => patch(index, { sideCount: Number(event.target.value) as 1 | 2 })}
                                >
                                  <option value="1">{m.progression.oneSide}</option>
                                  <option value="2">{m.progression.twoSides}</option>
                                </Select>
                              )}
                            </Field>
                          ) : null}
                        </div>
                      </details>
                      {issues
                        .filter((issue) => issue.itemRef === row.itemRef && issue.setIndex === row.setIndex)
                        .map((issue, i) => (
                          <p key={i} role="alert" className="col-span-2 t-caption">
                            {m.progression.issue[issue.code]}
                          </p>
                        ))}
                    </fieldset>
                  ),
                )}
              </div>
              <Button
                variant="darkSecondary"
                disabled={draft.rows.length >= 500 || draft.rows.filter((row) => row.itemRef === item.ref).length > 100}
                onClick={() =>
                  updateDraft({
                    ...draft,
                    rows: [
                      ...draft.rows,
                      proposedSet(
                        item,
                        Math.max(
                          -1,
                          ...draft.rows.filter((row) => row.itemRef === item.ref).map((row) => row.setIndex),
                        ) + 1,
                      ),
                    ],
                  })
                }
              >
                {m.progression.addSet}
              </Button>
            </section>
          ))}
        <Field label={m.progression.sessionStatus}>
          {(props) => (
            <Select
              {...props}
              value={draft.status}
              onChange={(event) =>
                updateDraft({ ...draft, status: event.target.value as PerformedSetsDraft["status"] })
              }
            >
              <option value="partial">{m.progression.partial}</option>
              <option value="done">{m.progression.done}</option>
            </Select>
          )}
        </Field>
        <Button disabled={stale} onClick={() => void save()}>
          {saving ? m.common.loading : athleteId ? m.progression.saveCoachSets : m.progression.saveSets}
        </Button>
      </fieldset>
      {message ? <p role="status">{message}</p> : null}
      {locked ? <ConfirmedRecords records={records} /> : null}
      <ConfirmDialog
        open={clearConfirm}
        onOpenChange={setClearConfirm}
        title={m.progression.setsTitle}
        description={m.progression.clearSetsConfirm}
        confirmLabel={m.common.save}
        tone="neutral"
        onConfirm={() => void save(true)}
      />
    </div>
  );
};
