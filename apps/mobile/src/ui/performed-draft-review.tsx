import type { AthleteSessionDetail, PerformedSetsDraft } from "@tartan/contracts";
import { draftFromSession, performedNumberFields, rebasePerformedDraft } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../lib/api";
import { Button, Card, T } from "./primitives";
import { space } from "./theme";

const Summary = ({
  title,
  draft,
  session,
}: {
  title: string;
  draft: PerformedSetsDraft;
  session: AthleteSessionDetail;
}) => (
  <Card>
    <View style={{ gap: space.md }}>
      <T heading variant="title2">
        {title}
      </T>
      <T>{m.status[draft.status]}</T>
      {draft.rows.map((row) => (
        <View key={`${row.itemRef}:${row.setIndex}`} style={{ gap: space.xs }}>
          <T variant="smallStrong">
            {session.blocks.flatMap((block) => block.items).find((item) => item.ref === row.itemRef)?.name ??
              m.syncReview.unknownExercise}{" "}
            — {m.progression.setNumber(row.setIndex + 1)}
          </T>
          <T>{row.done ? m.progression.confirmSet : m.sessionMode.setTodo(row.setIndex + 1)}</T>
          {performedNumberFields.map((field) =>
            row[field] ? (
              <T key={field}>
                {m.progression.fields[field]} : {row[field]}
              </T>
            ) : null,
          )}
          <T variant="caption">
            {row.loadKind ? m.progression[row.loadKind] : m.progression.chooseConvention} ·{" "}
            {m.progression[row.setKind === "work" ? "work" : "warmup"]} ·{" "}
            {row.repetitionScope === "total" ? m.progression.totalReps : `${m.progression.perSide} (${row.sideCount})`}
          </T>
        </View>
      ))}
    </View>
  </Card>
);

export const PerformedDraftReview = ({
  draft,
  orgId,
  sessionId,
  onResolve,
  onCancel,
}: {
  draft: PerformedSetsDraft;
  orgId: string;
  sessionId: string;
  onResolve: (next: PerformedSetsDraft, current: AthleteSessionDetail) => Promise<void>;
  onCancel: () => void;
}) => {
  const [session, setSession] = useState<AthleteSessionDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .session(orgId, sessionId)
      .then((current) => {
        if (active) setSession(current);
      })
      .catch(() => {
        if (active) setError(m.syncReview.unreadable);
      });
    return () => {
      active = false;
    };
  }, [orgId, sessionId]);
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
  const confirm = (keep: boolean) =>
    Alert.alert(
      keep ? m.progression.keepDraft : m.progression.resetDraft,
      keep ? m.progression.keepDraftConfirm : m.progression.resetDraftConfirm,
      [
        { text: m.common.cancel, style: "cancel" },
        {
          text: keep ? m.progression.keepDraft : m.progression.resetDraft,
          style: keep ? "default" : "destructive",
          onPress: () => void resolve(keep),
        },
      ],
    );
  return (
    <View style={{ gap: space.md }}>
      <T heading variant="title2">
        {m.progression.reviewDraft}
      </T>
      <T>{m.progression.reviewDraftHint}</T>
      {!session && !error ? <T accessibilityRole="alert">{m.common.loading}</T> : null}
      {session && review ? (
        <>
          <Summary title={m.syncReview.server} draft={draftFromSession(session)} session={session} />
          <Summary title={m.progression.localDraft} draft={draft} session={session} />
          {review.reason ? <T accessibilityRole="alert">{m.syncReview.reason[review.reason]}</T> : null}
          <Button disabled={busy || !review.draft} label={m.progression.keepDraft} onPress={() => confirm(true)} />
          <Button
            variant="secondary"
            disabled={busy || !session.progressionEnabled || session.sessionVersion === undefined}
            label={m.progression.resetDraft}
            onPress={() => confirm(false)}
          />
        </>
      ) : null}
      <Button variant="secondary" disabled={busy} label={m.common.cancel} onPress={onCancel} />
      {error ? <T accessibilityRole="alert">{error}</T> : null}
    </View>
  );
};
