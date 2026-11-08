import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  performedSetsDraft,
  performedDraftResolution,
  type AthleteSessionDetail,
  type SessionLogInput,
} from "@tartan/contracts";
import { performedSetsKey, resolvedDraftReceipt, reviewSessionLogs } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../src/lib/api";
import { useActiveSpace } from "../src/lib/queries";
import { newClientId, replaceReviewedLogs, useOpQueue } from "../src/lib/sync/op-queue";
import { reviewRequiredOps, type QueuedOp } from "../src/lib/sync/queue-core";
import { Button, Card, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { space } from "../src/ui/theme";

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
    <Card>
      <View style={{ gap: space.sm }}>
        <T variant="title2" heading>
          {title}
        </T>
        <T>
          {m.progression.sessionStatus} : {m.status[input.status]}
        </T>
        <T>
          {m.validation.duration} : {input.durationMin ?? m.syncReview.missing}
        </T>
        {session.healthConsent ? (
          <>
            <T>
              {m.validation.rpe} : {input.rpe ?? m.syncReview.missing}
            </T>
            <T>
              {m.validation.pain} :{" "}
              {input.pain
                ? `${m.bodyArea[input.pain.bodyArea]}, ${m.bodySide[input.pain.side]}, ${input.pain.intensity}/10`
                : m.syncReview.missing}
            </T>
          </>
        ) : null}
        <T>
          {session.athlete ? m.progression.athleteComment : m.validation.comment} :{" "}
          {input.comment ?? m.syncReview.missing}
        </T>
        {sets.map((row) => (
          <View key={`${row.itemRef}:${row.setIndex}`} style={{ gap: space.xs, paddingTop: space.sm }}>
            <T variant="smallStrong">
              {session.blocks.flatMap((b) => b.items).find((i) => i.ref === row.itemRef)?.name ??
                m.syncReview.unknownExercise}{" "}
              — {m.progression.setNumber(row.setIndex + 1)}
            </T>
            <T variant="caption">{row.done ? m.progression.confirmSet : m.sessionMode.setTodo(row.setIndex + 1)}</T>
            <T>
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
            </T>
            {"loadKind" in row ? (
              <T variant="caption">
                {row.loadKind === "external"
                  ? m.progression.external
                  : row.loadKind === "assisted"
                    ? m.progression.assisted
                    : m.progression.bodyweight}
                {"setKind" in row ? `, ${row.setKind === "warmup" ? m.progression.warmup : m.progression.work}` : ""}
                {"repetitionScope" in row
                  ? `, ${row.repetitionScope === "per_side" ? `${m.progression.perSide} (${"sideCount" in row ? row.sideCount : "—"})` : m.progression.totalReps}`
                  : ""}
              </T>
            ) : null}
          </View>
        ))}
        {!sets.length ? <T variant="caption">{m.syncReview.noSets}</T> : null}
      </View>
    </Card>
  );
};

const Review = ({ orgId, userId }: { orgId: string; userId: string }) => {
  const items = useOpQueue((s) => s.items);
  const groups = new Map<string, QueuedOp[]>();
  for (const op of reviewRequiredOps(items)) {
    if (op.kind === "log" && op.orgId === orgId) {
      const key = `${op.sessionId}:${op.athleteId ?? "self"}`;
      groups.set(key, [...(groups.get(key) ?? []), op]);
    }
  }
  for (const [id, batch] of groups) {
    if (!batch.some((op) => op.blocked)) groups.delete(id);
  }
  const [observed, setObserved] = useState<QueuedOp[] | null>(null);
  const [session, setSession] = useState<AthleteSessionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const compare = async (batch: QueuedOp[]) => {
    const first = batch[0];
    if (!first || first.kind !== "log") return;
    const ticket = ++request.current;
    setBusy(true);
    setObserved(batch);
    setSession(null);
    setMessage("");
    try {
      const current = await (first.athleteId
        ? api.athleteSessionForCoach(orgId, first.sessionId, first.athleteId)
        : api.session(orgId, first.sessionId));
      if (ticket === request.current) setSession(current);
    } catch {
      if (ticket === request.current) setMessage(m.syncReview.unreadable);
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  };
  const review =
    session && observed
      ? reviewSessionLogs(
          session,
          observed.flatMap((op) => (op.kind === "log" ? [op.input] : [])),
        )
      : null;
  const resolve = async (apply: boolean) => {
    const first = observed?.[0];
    if (!observed || !first || first.kind !== "log" || busy || (apply && (!review || review.reason))) return;
    setBusy(true);
    try {
      const replacementId = newClientId();
      await replaceReviewedLogs(
        userId,
        orgId,
        first.sessionId,
        observed,
        apply ? { ...review!.input, clientId: replacementId } : null,
        first.athleteId,
      );
      try {
        const key = performedSetsKey(userId, orgId, first.sessionId, first.athleteId);
        const [stored, previousStored] = await Promise.all([
          AsyncStorage.getItem(key),
          AsyncStorage.getItem(`${key}.resolution`),
        ]);
        const draft = performedSetsDraft.safeParse(JSON.parse(stored ?? "null"));
        const previous = performedDraftResolution.safeParse(JSON.parse(previousStored ?? "null"));
        const receipt = draft.success
          ? resolvedDraftReceipt(
              draft.data,
              observed.map((op) => op.id),
              apply ? replacementId : null,
              previous.success ? previous.data : null,
            )
          : null;
        if (receipt) await AsyncStorage.setItem(`${key}.resolution`, JSON.stringify(receipt));
      } catch {
        /* Le brouillon reste conservé si son reçu ne peut pas être écrit. */
      }
      setObserved(null);
      setSession(null);
      setMessage(apply ? m.syncReview.resolved : m.syncReview.discarded);
      if (apply) {
        await useOpQueue.getState().flush();
        if (useOpQueue.getState().items.some((op) => op.id === replacementId && op.blocked))
          setMessage(m.offline.needsReview);
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
  const confirm = (apply: boolean) =>
    Alert.alert(
      apply ? m.syncReview.apply : m.syncReview.discard,
      apply ? m.syncReview.confirmApply : m.syncReview.confirmDiscard,
      [
        { text: m.common.cancel, style: "cancel" },
        {
          text: apply ? m.syncReview.apply : m.syncReview.discard,
          style: apply ? "default" : "destructive",
          onPress: () => void resolve(apply),
        },
      ],
    );
  return (
    <StackScreen title={m.syncReview.title}>
      <T>{m.syncReview.lead}</T>
      {!groups.size ? <T>{m.syncReview.empty}</T> : null}
      {busy ? <T accessibilityRole="alert">{m.common.loading}</T> : null}
      {[...groups].map(([id, batch]) => (
        <View key={id} style={{ gap: space.sm }}>
          <T>
            {batch[0]?.kind === "log" && batch[0].athleteName ? `${batch[0].athleteName} · ` : ""}
            {m.syncReview.batch(batch.length)}
          </T>
          <Button
            disabled={busy}
            label={m.syncReview.compare}
            variant="secondary"
            onPress={() => void compare(batch)}
          />
        </View>
      ))}
      {session && review ? (
        <>
          <T variant="title2" heading>
            {session.athlete ? `${session.athlete.name} · ` : ""}
            {session.title}
          </T>
          <Values
            session={session}
            title={m.syncReview.server}
            input={{ ...reviewSessionLogs(session, []).input, detailedSets: session.log?.detailedSets }}
          />
          <Values session={session} title={m.syncReview.local} input={review.input} />
          {review.reason ? <T accessibilityRole="alert">{m.syncReview.reason[review.reason]}</T> : null}
          <Button disabled={busy || Boolean(review.reason)} label={m.syncReview.apply} onPress={() => confirm(true)} />
        </>
      ) : null}
      {observed ? (
        <Button
          disabled={busy}
          variant="secondary"
          label={session ? m.syncReview.discard : m.syncReview.discardUnavailable}
          onPress={() => confirm(false)}
        />
      ) : null}
      <T variant="caption">{m.syncReview.drafts}</T>
      {message ? <T accessibilityRole="alert">{message}</T> : null}
    </StackScreen>
  );
};

export default function SyncReview() {
  const { orgId, me } = useActiveSpace();
  return <Review key={`${me.data?.id}:${orgId}`} orgId={orgId} userId={me.data?.id ?? ""} />;
}
