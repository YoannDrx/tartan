"use client";
import {
  performedSetsDraft,
  performedDraftResolution,
  athleteSessionDetail,
  type AthleteSessionDetail,
  type SessionLogInput,
} from "@tartan/contracts";
import { resolvedDraftReceipt, reviewSessionLogs } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { flushOps, pendingOps, replaceReviewedLogs, reviewRequiredOps, type QueuedOp } from "./op-queue";

const Values = ({
  session,
  input,
  title,
}: {
  session: AthleteSessionDetail;
  input: Omit<SessionLogInput, "clientId">;
  title: string;
}) => {
  const sets =
    input.detailedSets ?? (session.log?.detailedSets?.length ? session.log.detailedSets : (input.sets ?? []));
  return (
    <section aria-label={title} className="on-card min-w-0 rounded-card bg-card p-4">
      <h3 className="t-section mb-3">{title}</h3>
      <dl className="grid grid-cols-2 gap-2 break-words">
        <dt>{m.progression.sessionStatus}</dt>
        <dd>{m.status[input.status]}</dd>
        <dt>{m.validation.duration}</dt>
        <dd>{input.durationMin ?? m.syncReview.missing}</dd>
        {session.healthConsent ? (
          <>
            <dt>{m.validation.rpe}</dt>
            <dd>{input.rpe ?? m.syncReview.missing}</dd>
            <dt>{m.validation.pain}</dt>
            <dd>
              {input.pain
                ? `${m.bodyArea[input.pain.bodyArea]}, ${m.bodySide[input.pain.side]}, ${input.pain.intensity}/10`
                : m.syncReview.missing}
            </dd>
          </>
        ) : null}
        <dt>{m.validation.comment}</dt>
        <dd className="whitespace-pre-wrap">{input.comment ?? m.syncReview.missing}</dd>
      </dl>
      <ul className="mt-4 flex flex-col gap-3">
        {sets.map((row) => (
          <li key={`${row.itemRef}:${row.setIndex}`} className="border-t border-card-line pt-2">
            <p className="font-semibold">
              {session.blocks.flatMap((b) => b.items).find((i) => i.ref === row.itemRef)?.name ??
                m.syncReview.unknownExercise}{" "}
              — {m.progression.setNumber(row.setIndex + 1)}
            </p>
            <p className="t-caption">{row.done ? m.progression.confirmSet : m.sessionMode.setTodo(row.setIndex + 1)}</p>
            <p>
              {[
                row.reps != null ? `${row.reps} ${m.progression.fields.reps}` : null,
                row.loadKg != null ? `${row.loadKg} kg` : null,
                row.distanceM != null ? `${row.distanceM} m` : null,
                row.timeS != null ? `${row.timeS} s` : null,
                "groundContacts" in row && row.groundContacts != null
                  ? `${row.groundContacts} ${m.progression.fields.groundContacts}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {"loadKind" in row ? (
              <p className="t-caption">
                {row.loadKind === "external"
                  ? m.progression.external
                  : row.loadKind === "assisted"
                    ? m.progression.assisted
                    : m.progression.bodyweight}
                {"setKind" in row ? `, ${row.setKind === "warmup" ? m.progression.warmup : m.progression.work}` : ""}
                {"repetitionScope" in row
                  ? `, ${row.repetitionScope === "per_side" ? `${m.progression.perSide} (${"sideCount" in row ? row.sideCount : "—"})` : m.progression.totalReps}`
                  : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {!sets.length ? <p className="t-caption mt-3">{m.syncReview.noSets}</p> : null}
    </section>
  );
};

const loadGroups = async (organizationId: string) => {
  const ops = reviewRequiredOps(await pendingOps(true)).filter(
    (op) => op.kind === "log" && op.path === `/orgs/${organizationId}/sessions/${op.target}/log`,
  );
  const grouped = new Map<string, QueuedOp[]>();
  for (const op of ops) grouped.set(op.path, [...(grouped.get(op.path) ?? []), op]);
  return [...grouped.values()].filter((batch) => batch.some((op) => op.blocked));
};

export const LogQueueReview = ({ organizationId, userId }: { organizationId: string; userId: string }) => {
  const [groups, setGroups] = useState<QueuedOp[][]>([]);
  const [observed, setObserved] = useState<QueuedOp[] | null>(null);
  const [session, setSession] = useState<AthleteSessionDetail | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"apply" | "discard" | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const refresh = async () => {
    try {
      setGroups(await loadGroups(organizationId));
      setReady(true);
      setMessage((current) => (current === m.syncReview.unreadable ? "" : current));
    } catch {
      setReady(true);
      setMessage(m.syncReview.unreadable);
    }
  };
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void loadGroups(organizationId)
      .then((batches) => {
        if (active) {
          setGroups(batches);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setMessage(m.syncReview.unreadable);
        }
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [organizationId]);
  const compare = async (batch: QueuedOp[]) => {
    const ticket = ++request.current;
    setBusy(true);
    setObserved(batch);
    setSession(null);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/orgs/${organizationId}/sessions/${batch[0]!.target}/me`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("READ_FAILED");
      const current = athleteSessionDetail.parse(await response.json());
      if (mounted.current && ticket === request.current) setSession(current);
    } catch {
      if (mounted.current && ticket === request.current) setMessage(m.syncReview.unreadable);
    } finally {
      if (mounted.current && ticket === request.current) setBusy(false);
    }
  };
  const review =
    session && observed
      ? reviewSessionLogs(
          session,
          observed.map((op) => op.body),
        )
      : null;
  const resolve = async (apply: boolean) => {
    if (!observed || busy || (apply && (!review || review.reason))) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      await replaceReviewedLogs(observed, apply ? { id, body: { ...review!.input, clientId: id } } : null);
      // Le reçu ne modifie jamais le brouillon. L'éditeur ne l'utilise que si
      // toutes ses valeurs sont encore exactement celles de l'envoi relu.
      try {
        const key = `tartan.performed.v1.${userId}.${organizationId}.${observed[0]!.target}`;
        const draft = performedSetsDraft.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
        const previous = performedDraftResolution.safeParse(
          JSON.parse(localStorage.getItem(`${key}.resolution`) ?? "null"),
        );
        const receipt = draft.success
          ? resolvedDraftReceipt(
              draft.data,
              observed.map((op) => op.id),
              apply ? id : null,
              previous.success ? previous.data : null,
            )
          : null;
        if (receipt) localStorage.setItem(`${key}.resolution`, JSON.stringify(receipt));
      } catch {
        /* Un brouillon illisible est conservé ; la file résolue reste durable. */
      }
      setObserved(null);
      setSession(null);
      setMessage(apply ? m.syncReview.resolved : m.syncReview.discarded);
      await refresh();
      if (apply) {
        await flushOps();
        if ((await pendingOps()).some((op) => op.id === id && op.blocked)) setMessage(m.offline.needsReview);
        await refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.startsWith("REVIEW_")
          ? m.syncReview.changed
          : m.offline.deviceStorageError,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>
        {m.offline.retry}
      </Button>
      {!ready || busy ? <p role="status">{m.common.loading}</p> : null}
      {ready && !groups.length && message !== m.syncReview.unreadable ? <p>{m.syncReview.empty}</p> : null}
      <ul className="flex flex-col gap-3">
        {groups.map((batch) => (
          <li key={batch[0]!.path} className="flex flex-wrap items-center gap-3">
            <span>{m.syncReview.batch(batch.length)}</span>
            <Button variant="secondary" disabled={busy} onClick={() => void compare(batch)}>
              {m.syncReview.compare}
            </Button>
          </li>
        ))}
      </ul>
      {session && review ? (
        <>
          <h2 className="t-h2">{session.title}</h2>
          <div className="grid gap-4 tablet:grid-cols-2">
            <Values
              session={session}
              title={m.syncReview.server}
              input={{ ...reviewSessionLogs(session, []).input, detailedSets: session.log?.detailedSets }}
            />
            <Values session={session} title={m.syncReview.local} input={review.input} />
          </div>
          {review.reason ? <p role="alert">{m.syncReview.reason[review.reason]}</p> : null}
          <Button disabled={busy || Boolean(review.reason)} onClick={() => setConfirm("apply")}>
            {m.syncReview.apply}
          </Button>
        </>
      ) : null}
      {observed ? (
        <Button variant="secondary" disabled={busy} onClick={() => setConfirm("discard")}>
          {session ? m.syncReview.discard : m.syncReview.discardUnavailable}
        </Button>
      ) : null}
      <p className="t-caption">{m.syncReview.drafts}</p>
      {message ? <p role="status">{message}</p> : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm === "apply" ? m.syncReview.apply : m.syncReview.discard}
        description={confirm === "apply" ? m.syncReview.confirmApply : m.syncReview.confirmDiscard}
        confirmLabel={confirm === "apply" ? m.syncReview.apply : m.syncReview.discard}
        tone={confirm === "apply" ? "neutral" : "danger"}
        onConfirm={() => void resolve(confirm === "apply")}
      />
    </div>
  );
};
