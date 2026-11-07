"use client";

import { athleteSessionDetail, type AthleteSessionDetail, type PerformedSetsDraft } from "@tartan/contracts";
import { draftFromSession, performedNumberFields, rebasePerformedDraft } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const Summary = ({
  title,
  draft,
  session,
}: {
  title: string;
  draft: PerformedSetsDraft;
  session: AthleteSessionDetail;
}) => (
  <section aria-label={title} className="on-card min-w-0 rounded-card bg-card p-4">
    <h3 className="t-section">{title}</h3>
    <p>{m.status[draft.status]}</p>
    <ul className="mt-3 flex flex-col gap-3">
      {draft.rows.map((row) => (
        <li key={`${row.itemRef}:${row.setIndex}`} className="break-words border-t border-card-line pt-2">
          <p className="font-semibold">
            {session.blocks.flatMap((block) => block.items).find((item) => item.ref === row.itemRef)?.name ??
              m.syncReview.unknownExercise}{" "}
            — {m.progression.setNumber(row.setIndex + 1)}
          </p>
          <p>{row.done ? m.progression.confirmSet : m.sessionMode.setTodo(row.setIndex + 1)}</p>
          {performedNumberFields.map((field) =>
            row[field] ? (
              <p key={field}>
                {m.progression.fields[field]} : {row[field]}
              </p>
            ) : null,
          )}
          <p className="t-caption">
            {row.loadKind ? m.progression[row.loadKind] : m.progression.chooseConvention} ·{" "}
            {m.progression[row.setKind === "work" ? "work" : "warmup"]} ·{" "}
            {row.repetitionScope === "total" ? m.progression.totalReps : `${m.progression.perSide} (${row.sideCount})`}
          </p>
        </li>
      ))}
    </ul>
  </section>
);

export const PerformedDraftReview = ({
  draft,
  organizationId,
  sessionId,
  onResolve,
  onCancel,
}: {
  draft: PerformedSetsDraft;
  organizationId: string;
  sessionId: string;
  onResolve: (next: PerformedSetsDraft, current: AthleteSessionDetail) => Promise<void>;
  onCancel: () => void;
}) => {
  const [session, setSession] = useState<AthleteSessionDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"keep" | "reset" | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/orgs/${organizationId}/sessions/${sessionId}/me`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("READ_FAILED");
        const current = athleteSessionDetail.parse(await response.json());
        if (active) setSession(current);
      })
      .catch(() => {
        if (active) setError(m.syncReview.unreadable);
      });
    return () => {
      active = false;
    };
  }, [organizationId, sessionId]);
  const review = session ? rebasePerformedDraft(draft, session) : null;
  const resolve = async (keep: boolean) => {
    if (!session || busy || (keep && !review?.draft)) return;
    setBusy(true);
    try {
      await onResolve(keep ? review!.draft! : draftFromSession(session), session);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "DRAFT_CHANGED"
          ? m.progression.draftChanged
          : m.offline.deviceStorageError,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label={m.progression.reviewDraft} className="flex flex-col gap-4">
      <h2 className="t-h2">{m.progression.reviewDraft}</h2>
      <p>{m.progression.reviewDraftHint}</p>
      {!session && !error ? <p role="status">{m.common.loading}</p> : null}
      {session && review ? (
        <>
          <div className="grid gap-4 tablet:grid-cols-2">
            <Summary title={m.syncReview.server} draft={draftFromSession(session)} session={session} />
            <Summary title={m.progression.localDraft} draft={draft} session={session} />
          </div>
          {review.reason ? <p role="alert">{m.syncReview.reason[review.reason]}</p> : null}
          <Button disabled={busy || !review.draft} onClick={() => setConfirm("keep")}>
            {m.progression.keepDraft}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !session.progressionEnabled || session.sessionVersion === undefined}
            onClick={() => setConfirm("reset")}
          >
            {m.progression.resetDraft}
          </Button>
        </>
      ) : null}
      <Button variant="secondary" disabled={busy} onClick={onCancel}>
        {m.common.cancel}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm === "keep" ? m.progression.keepDraft : m.progression.resetDraft}
        description={confirm === "keep" ? m.progression.keepDraftConfirm : m.progression.resetDraftConfirm}
        confirmLabel={confirm === "keep" ? m.progression.keepDraft : m.progression.resetDraft}
        tone={confirm === "keep" ? "neutral" : "danger"}
        onConfirm={() => void resolve(confirm === "keep")}
      />
    </section>
  );
};
