import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  performedDraftResolution,
  performedSetsDraft,
  type AthleteSessionDetail,
  type PerformedSetDraftRow,
} from "@tartan/contracts";
import {
  performedDraftContent,
  performedSetsKey,
  isResolvedDraft,
  confirmedSets,
  draftFromSession,
  performedNumberFields,
  proposedSet,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { newClientId, submitValidation, useOpQueue } from "../lib/sync/op-queue";
import { reviewRequiredOps } from "../lib/sync/queue-core";
import { Button, Field, T } from "../ui/primitives";
import { SyncBanner } from "../ui/screen";
import { space } from "../ui/theme";
import { PerformedDraftReview } from "../ui/performed-draft-review";
import { Check } from "../ui/icons";
import { PreviousSets } from "./previous-sets";

const Choice = ({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <View style={{ gap: space.sm }}>
    <T variant="smallStrong">{label}</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map(([key, title]) => (
        <Button
          key={key}
          label={title}
          accessibilityLabel={`${label} : ${title}`}
          compact
          selected={value === key}
          icon={value === key ? Check : undefined}
          variant={value === key ? "primary" : "secondary"}
          disabled={disabled}
          onPress={() => onChange(key)}
        />
      ))}
    </View>
  </View>
);

export const PerformedSetsEditor = ({
  session: initialSession,
  orgId,
  userId,
  athleteId,
}: {
  session: AthleteSessionDetail;
  orgId: string;
  userId: string;
  athleteId?: string;
}) => {
  const [reviewedSession, setReviewedSession] = useState<AthleteSessionDetail | null>(null);
  const session = reviewedSession ?? initialSession;
  const [reviewing, setReviewing] = useState(false);
  const key = performedSetsKey(userId, orgId, session.id, athleteId);
  const [draft, setDraft] = useState(() => draftFromSession(session));
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    void Promise.all([AsyncStorage.getItem(key), AsyncStorage.getItem(`${key}.resolution`)])
      .then(([value, resolution]) => {
        if (!active) return;
        if (value) {
          const parsed = performedSetsDraft.safeParse(JSON.parse(value));
          if (!parsed.success) {
            setStorageError(true);
            return;
          }
          const receipt = performedDraftResolution.safeParse(JSON.parse(resolution ?? "null"));
          const acknowledged =
            (parsed.data.submittedClientId &&
              parsed.data.submittedClientId === session.log?.clientId &&
              parsed.data.submittedContent === performedDraftContent(parsed.data)) ||
            isResolvedDraft(parsed.data, receipt.success ? receipt.data : null, session.log?.clientId);
          setDraft(acknowledged ? draftFromSession(session) : parsed.data);
        }
        const pending = useOpQueue
          .getState()
          .items.filter(
            (op) =>
              op.kind === "log" && op.sessionId === session.id && op.orgId === orgId && op.athleteId === athleteId,
          );
        if (pending.length) {
          setLocked(true);
          setMessage(reviewRequiredOps(pending).length ? m.offline.needsReview : m.progression.queuedSets);
        }
        setReady(true);
      })
      .catch(() => {
        if (active) setStorageError(true);
      });
    return () => {
      active = false;
    };
    // Le brouillon se charge à l'ouverture, pas à chaque rafraîchissement réseau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready || locked) return;
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(key, JSON.stringify(draft)))
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }, [key, draft, ready, locked]);
  const stale =
    !locked && (draft.sessionVersion !== session.sessionVersion || draft.logVersion !== (session.log?.version ?? 0));
  const disabled = !ready || locked || saving || reviewing || (Boolean(athleteId) && session.canRecordSets !== true);
  const checked = confirmedSets(draft);
  const patch = (index: number, change: Partial<PerformedSetDraftRow>) =>
    setDraft((old) => ({ ...old, rows: old.rows.map((row, i) => (i === index ? { ...row, ...change } : row)) }));
  const save = async () => {
    setShowIssues(true);
    if (checked.issues.length) {
      setMessage(m.progression.correctSets);
      return;
    }
    setSaving(true);
    setMessage("");
    const clientId = newClientId();
    setDraft((old) => ({ ...old, submittedClientId: clientId, submittedContent: performedDraftContent(old) }));
    try {
      const result = await submitValidation(
        orgId,
        session.id,
        {
          writeScope: "sets",
          status: draft.status,
          variantDone: draft.variant,
          expectedVersion: draft.logVersion,
          expectedSessionVersion: draft.sessionVersion,
          detailedSets: checked.sets,
        },
        clientId,
        athleteId,
        session.athlete?.name,
      );
      if (result.state === "error") {
        setMessage(result.message);
        return;
      }
      const state = useOpQueue.getState();
      if (state.ownerId !== userId) {
        setMessage(m.offline.session);
        return;
      }
      const pending = state.items.find((op) => op.id === clientId);
      if (state.storageError) {
        setMessage(m.offline.deviceStorageError);
        return;
      }
      if (reviewRequiredOps(state.items).some((op) => op.id === clientId)) {
        setMessage(m.offline.needsReview);
        return;
      }
      setLocked(true);
      setMessage(pending ? m.progression.queuedSets : m.progression.savedSets);
      if (!pending) {
        await writes.current;
        await AsyncStorage.removeItem(key);
      }
    } catch {
      setMessage(m.common.genericError);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <T>{m.progression.setsHint}</T>
      <T variant="caption">{m.progression.loadHint}</T>
      <SyncBanner />
      {stale ? <T accessibilityRole="alert">{m.progression.draftStale}</T> : null}
      {storageError ? <T accessibilityRole="alert">{m.offline.deviceStorageError}</T> : null}
      {stale && ready && !reviewing ? (
        <Button
          variant="secondary"
          disabled={saving}
          label={m.progression.reviewDraft}
          onPress={() => setReviewing(true)}
        />
      ) : null}
      {reviewing ? (
        <PerformedDraftReview
          draft={draft}
          orgId={orgId}
          sessionId={session.id}
          athleteId={athleteId}
          onCancel={() => setReviewing(false)}
          onResolve={async (next, current) => {
            await writes.current;
            const stored = performedSetsDraft.safeParse(JSON.parse((await AsyncStorage.getItem(key)) ?? "null"));
            const queue = useOpQueue.getState();
            if (
              queue.ownerId !== userId ||
              !stored.success ||
              performedDraftContent(stored.data) !== performedDraftContent(draft) ||
              queue.items.some(
                (op) =>
                  op.kind === "log" && op.orgId === orgId && op.sessionId === session.id && op.athleteId === athleteId,
              )
            )
              throw new Error("DRAFT_CHANGED");
            await AsyncStorage.setItem(key, JSON.stringify(next));
            setDraft(next);
            setReviewedSession(current);
            setShowIssues(false);
            setStorageError(false);
            setMessage(m.progression.draftReady);
            setReviewing(false);
          }}
        />
      ) : null}
      {session.blocks
        .flatMap((block) => block.items)
        .map((item) => (
          <View key={item.ref} style={{ gap: space.lg }}>
            <T variant="title2">{item.name}</T>
            <T variant="caption">{item.summary}</T>
            <PreviousSets
              item={item}
              rows={draft.rows}
              previous={session.previousExerciseSets}
              athleteId={session.historyAthleteId}
            />
            {draft.rows.map((row, index) =>
              row.itemRef !== item.ref ? null : (
                <View key={`${row.itemRef}-${row.setIndex}`} style={{ gap: space.md, paddingVertical: space.md }}>
                  <T variant="smallStrong">{m.progression.setNumber(row.setIndex + 1)}</T>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: row.done, disabled }}
                    disabled={disabled}
                    onPress={() => patch(index, { done: !row.done })}
                    style={{ minHeight: 48, justifyContent: "center" }}
                  >
                    <T>
                      {m.progression.confirmSet} : {row.done ? m.common.yes : m.common.no}
                    </T>
                  </Pressable>
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    {performedNumberFields.slice(0, 2).map((field) => (
                      <Field
                        key={field}
                        containerStyle={{ flex: 1 }}
                        label={m.progression.fields[field]}
                        accessibilityLabel={`${m.progression.fields[field]} · ${item.name} · ${row.setIndex + 1}`}
                        value={row[field]}
                        keyboardType="decimal-pad"
                        editable={!disabled}
                        onChangeText={(value) => patch(index, { [field]: value })}
                      />
                    ))}
                  </View>
                  <Choice
                    disabled={disabled}
                    label={m.progression.loadKind}
                    value={row.loadKind}
                    options={[
                      ["external", m.progression.external],
                      ["bodyweight", m.progression.bodyweight],
                      ["assisted", m.progression.assisted],
                    ]}
                    onChange={(value) =>
                      patch(index, {
                        loadKind: value as PerformedSetDraftRow["loadKind"],
                        ...(value === "bodyweight" ? { loadKg: "" } : {}),
                      })
                    }
                  />
                  <Button
                    compact
                    variant="secondary"
                    label={m.progression.advancedSet}
                    onPress={() => setExpanded((old) => ({ ...old, [index]: !old[index] }))}
                  />
                  {expanded[index] ||
                  showIssues ||
                  item.prescription.distance_m !== undefined ||
                  item.prescription.duration_s !== undefined ||
                  item.prescription.ground_contacts !== undefined ? (
                    <>
                      {performedNumberFields.slice(2).map((field) => (
                        <Field
                          key={field}
                          label={m.progression.fields[field]}
                          accessibilityLabel={`${m.progression.fields[field]} · ${item.name} · ${row.setIndex + 1}`}
                          value={row[field]}
                          keyboardType="decimal-pad"
                          editable={!disabled}
                          onChangeText={(value) => patch(index, { [field]: value })}
                        />
                      ))}
                      <Choice
                        disabled={disabled}
                        label={m.progression.setKind}
                        value={row.setKind}
                        options={[
                          ["work", m.progression.work],
                          ["warmup", m.progression.warmup],
                        ]}
                        onChange={(value) => patch(index, { setKind: value as PerformedSetDraftRow["setKind"] })}
                      />
                      <Choice
                        disabled={disabled}
                        label={m.progression.repetitionScope}
                        value={row.repetitionScope}
                        options={[
                          ["total", m.progression.totalReps],
                          ["per_side", m.progression.perSide],
                        ]}
                        onChange={(value) =>
                          patch(index, {
                            repetitionScope: value as PerformedSetDraftRow["repetitionScope"],
                            sideCount: value === "total" ? 1 : 2,
                          })
                        }
                      />
                      {row.repetitionScope === "per_side" ? (
                        <Choice
                          disabled={disabled}
                          label={m.progression.sideCount}
                          value={String(row.sideCount)}
                          options={[
                            ["1", m.progression.oneSide],
                            ["2", m.progression.twoSides],
                          ]}
                          onChange={(value) => patch(index, { sideCount: Number(value) as 1 | 2 })}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {showIssues
                    ? checked.issues
                        .filter((issue) => issue.itemRef === row.itemRef && issue.setIndex === row.setIndex)
                        .map((issue, i) => (
                          <T key={i} tone="danger" accessibilityRole="alert">
                            {m.progression.issue[issue.code]}
                          </T>
                        ))
                    : null}
                </View>
              ),
            )}
            <Button
              label={m.progression.addSet}
              variant="secondary"
              disabled={
                disabled ||
                draft.rows.length >= 500 ||
                draft.rows.filter((row) => row.itemRef === item.ref).length > 100
              }
              onPress={() =>
                setDraft((old) => ({
                  ...old,
                  rows: [
                    ...old.rows,
                    proposedSet(
                      item,
                      Math.max(-1, ...old.rows.filter((row) => row.itemRef === item.ref).map((row) => row.setIndex)) +
                        1,
                    ),
                  ],
                }))
              }
            />
          </View>
        ))}
      <Choice
        disabled={disabled}
        label={m.progression.sessionStatus}
        value={draft.status}
        options={[
          ["partial", m.progression.partial],
          ["done", m.progression.done],
        ]}
        onChange={(value) => setDraft((old) => ({ ...old, status: value as "done" | "partial" }))}
      />
      <Button
        label={athleteId ? m.progression.saveCoachSets : m.progression.saveSets}
        loading={saving}
        disabled={disabled || stale}
        onPress={() => {
          if (!checked.sets.length && session.log?.detailedSets?.length)
            Alert.alert(m.progression.setsTitle, m.progression.clearSetsConfirm, [
              { text: m.common.cancel, style: "cancel" },
              { text: m.common.save, onPress: () => void save() },
            ]);
          else void save();
        }}
      />
      {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
    </>
  );
};
