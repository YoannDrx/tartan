import { DateField } from "../../ui/date-field";
import { usePreventRemove } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import {
  sessionType,
  type Prescription,
  type SaveScheduledSessionInput,
  type SessionDraft,
  type SessionEditResponse,
} from "@tartan/contracts";
import {
  copyDraftWithNewRefs,
  formatPrescription,
  withSessionRefs,
  withSessionSequences,
  moveSequenceExercise,
  sessionExerciseReferences,
  validSessionStructure,
} from "@tartan/domain";
import { phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { NativePhasePlanning } from "../phase-planning";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, View } from "react-native";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { useIsOnline } from "../../lib/network";
import { Button, Card, Chip, Field, T } from "../../ui/primitives";
import { StackScreen } from "../../ui/screen";
import { Sheet } from "../../ui/sheet";
import { space } from "../../ui/theme";
import { builderErrors, localSchedule, parseSessionForm, prescriptionFields } from "./form";
import {
  BuilderStorageConflict,
  recoveredBuilderDraft,
  type BuilderDraft,
  type StoredBuilderDraft,
} from "./draft-storage";
import { builderDraftStore } from "./draft-store";
import { BuilderSaveFailure, persistBuilderSession } from "./save";
import { BuilderSummary } from "./summary";
import { PrescriptionEditor } from "./prescription-editor";
import { NativeSequenceEditor } from "./sequence-editor";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
type Item = SessionDraft["blocks"][number]["items"][number];
type Editing = NonNullable<BuilderDraft["prescription"]>;
export const initialForm = (
  initial: SessionEditResponse | null,
  date: string,
  groupId?: string,
): SaveScheduledSessionInput =>
  initial
    ? {
        id: initial.id,
        expectedVersion: initial.version,
        date: initial.date,
        startTime: initial.startTime,
        location: initial.location,
        publishAt: localSchedule(initial.publishAt),
        assignments: initial.assignments,
        overrides: initial.overrides,
        phaseReview: initial.phaseReview,
        draft: withSessionRefs(initial.draft),
      }
    : {
        date,
        startTime: null,
        location: null,
        publishAt: null,
        assignments: groupId ? [{ targetType: "group", targetId: groupId }] : [],
        overrides: [],
        draft: {
          title: "",
          type: "strength",
          durationMin: null,
          coachNote: null,
          blocks: [m.builder.blocks.warmup, m.builder.blocks.main, m.builder.blocks.cooldown].map((name) => ({
            ref: randomUUID(),
            name,
            variant: "club",
            items: [],
          })),
        },
      };

export const NativeSessionBuilder = ({
  orgId,
  storageKey,
  stored,
  verified,
  initial,
  context,
  date,
  groupId,
  onReload,
}: {
  orgId: string;
  storageKey: string;
  stored: StoredBuilderDraft | null;
  verified: boolean;
  initial: SessionEditResponse | null;
  context: Context;
  date: string;
  groupId?: string;
  onReload: (id?: string) => void;
}) => {
  const [form, setForm] = useState(() => initialForm(initial, date, groupId));
  const phaseGroups = form.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const phaseAthletes = form.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  const planningKey = phasePlanningKey(form.date, phaseGroups, phaseAthletes);
  const [phaseReady, setPhaseReady] = useState<PhasePlanningReadiness>({ key: "", ready: false });
  const acceptPhaseReview = useCallback((state: PhasePlanningReadiness) => {
    setPhaseReady(state);
    if (!state.ready || !state.review) return;
    setForm((current) => {
      const key = phasePlanningKey(
        current.date,
        current.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
        current.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
      );
      if (key !== state.key || JSON.stringify(current.phaseReview) === JSON.stringify(state.review)) return current;
      return { ...current, phaseReview: state.review };
    });
  }, []);
  const [duration, setDuration] = useState(initial?.draft.durationMin?.toString() ?? "");
  const [baseline, setBaseline] = useState(() => JSON.stringify({ form, duration }));
  const [base, setBase] = useState(initial);
  const [ready, setReady] = useState(!stored);
  const [writer] = useState(() => builderDraftStore.writer(storageKey, stored?.revision ?? null));
  const [localState, setLocalState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [uncertain, setUncertain] = useState<BuilderDraft["pending"]>(null);
  const storageSequence = useRef(0);
  const closing = useRef(false);
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? null);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const [undo, setUndo] = useState<Pick<SaveScheduledSessionInput, "draft" | "overrides"> | null>(null);
  const [templates, setTemplates] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState(context.templates);
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const online = useIsOnline();
  const navigation = useNavigation();
  const router = useRouter();
  const client = useQueryClient();
  const dirty = JSON.stringify({ form, duration }) !== baseline || editing !== null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const snapshot = (nextForm = form, nextBase = base, marker = uncertain): BuilderDraft => ({
    schemaVersion: 1,
    form: nextForm,
    duration,
    base: nextBase,
    context,
    pending: marker,
    prescription: editing ?? undefined,
  });
  const storageFailure = (cause: unknown) => {
    setLocalState(cause instanceof BuilderStorageConflict ? "conflict" : "error");
    setError(cause instanceof BuilderStorageConflict ? m.nativeBuilder.localConflict : m.nativeBuilder.localError);
  };
  useEffect(() => {
    const sequence = ++storageSequence.current;
    if (!ready || !dirty || busy || closing.current || localState === "conflict") return;
    setLocalState("saving");
    // Regroupe une rafale de frappes ; quitter ou envoyer force la dernière copie.
    const timer = setTimeout(() => {
      void writer
        .write({
          schemaVersion: 1,
          form,
          duration,
          base,
          context,
          pending: uncertain,
          prescription: editing ?? undefined,
        })
        .then(() => {
          if (mounted.current && sequence === storageSequence.current) {
            setLocalState("saved");
            setError((previous) => (previous === m.nativeBuilder.localError ? "" : previous));
          }
        })
        .catch((cause: unknown) => {
          if (mounted.current && sequence === storageSequence.current) storageFailure(cause);
        });
    }, 250);
    return () => clearTimeout(timer);
    // L'état de sauvegarde n'est pas une nouvelle saisie et ne doit pas reboucler les écritures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dirty, busy, form, duration, base, context, uncertain, writer, editing]);
  useEffect(() => {
    const flush = () => {
      if (!ready || !dirty || pending.current || closing.current || localState === "conflict") return;
      void writer
        .write({
          schemaVersion: 1,
          form,
          duration,
          base,
          context,
          pending: uncertain,
          prescription: editing ?? undefined,
        })
        .catch((cause: unknown) => {
          if (mounted.current) storageFailure(cause);
        });
    };
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") flush();
    });
    const blur = navigation.addListener("blur", flush);
    return () => {
      app.remove();
      blur();
    };
  }, [ready, dirty, form, duration, base, context, uncertain, writer, editing, localState, navigation]);
  usePreventRemove(
    !deleted &&
      (busy || (ready && (dirty || uncertain !== null || localState === "error" || localState === "conflict"))),
    ({ data }) => {
      if (pending.current) {
        Alert.alert(m.builder.title, m.nativeBuilder.publicationPending);
        return;
      }
      const leave = async (keep: boolean) => {
        if (!mounted.current || pending.current) return;
        pending.current = true;
        closing.current = true;
        setBusy(true);
        try {
          if (keep) await writer.write(snapshot());
          else {
            try {
              await writer.remove();
            } catch (cause) {
              if (!(cause instanceof BuilderStorageConflict)) throw cause;
            }
          }
          if (mounted.current) navigation.dispatch(data.action);
        } catch (cause) {
          closing.current = false;
          if (mounted.current) storageFailure(cause);
        } finally {
          pending.current = false;
          if (mounted.current) setBusy(false);
        }
      };
      Alert.alert(m.nativeBuilder.unsaved, m.nativeBuilder.keepDraftConfirm, [
        { text: m.common.cancel, style: "cancel" },
        { text: m.nativeBuilder.keepDraft, onPress: () => void leave(true) },
        { text: m.nativeBuilder.leave, style: "destructive", onPress: () => void leave(false) },
      ]);
    },
  );
  const confirm = (body: string, action: () => void, destructive = false) =>
    Alert.alert(m.builder.title, body, [
      { text: m.common.cancel, style: "cancel" },
      {
        text: destructive ? m.common.delete : m.nativeBuilder.apply,
        style: destructive ? "destructive" : "default",
        onPress: () => {
          if (mounted.current && !pending.current) action();
        },
      },
    ]);
  const change = (patch: Partial<SaveScheduledSessionInput>) => {
    setMessage("");
    setForm((v) => ({
      ...v,
      ...patch,
      ...("date" in patch || "assignments" in patch ? { phaseReview: undefined } : {}),
    }));
  };
  const draft = (patch: Partial<SessionDraft>) => {
    setMessage("");
    setUndo(null);
    setForm((v) => ({ ...v, draft: { ...v.draft, ...patch } }));
  };
  const blocks = (next: SessionDraft["blocks"]) => {
    const nextDraft = withSessionSequences({ ...form.draft, blocks: next });
    let refs: Set<string>;
    try {
      refs = new Set(sessionExerciseReferences(nextDraft).keys());
    } catch {
      setError(m.builder.sequence.invalid);
      return;
    }
    setUndo({ draft: form.draft, overrides: form.overrides });
    if (editing && !refs.has(editing.itemRef)) setEditing(null);
    setForm((v) => ({
      ...v,
      draft: nextDraft,
      overrides: v.overrides.filter((o) => refs.has(o.itemRef)),
    }));
  };
  const move = <T,>(list: T[], index: number, offset: number): T[] => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    if (item !== undefined) next.splice(index + offset, 0, item);
    return next;
  };
  const toggleAudience = (targetType: "group" | "athlete", targetId: string) => {
    const selected = form.assignments.some((a) => a.targetType === targetType && a.targetId === targetId);
    change({
      assignments: selected
        ? form.assignments.filter((a) => !(a.targetType === targetType && a.targetId === targetId))
        : [...form.assignments, { targetType, targetId }],
    });
  };
  const exerciseFor = (item: Item) => context.exercises.find((e) => e.id === item.exerciseId);
  const allItems = form.draft.blocks.flatMap((b) => b.items);
  const editedItem = editing ? allItems.find((i) => i.ref === editing.itemRef) : undefined;
  const editedExercise = editedItem ? exerciseFor(editedItem) : undefined;
  const editedValue =
    editing && editedItem
      ? (form.overrides.find((o) => o.itemRef === editing.itemRef && o.athleteId === editing.athleteId)?.prescription ??
        editedItem.prescription)
      : undefined;
  const openPrescription = (target: { itemRef: string; athleteId?: string }) => {
    const item = allItems.find((i) => i.ref === target.itemRef);
    if (!item) return;
    const value = target.athleteId
      ? (form.overrides.find((o) => o.athleteId === target.athleteId && o.itemRef === target.itemRef)?.prescription ??
        item.prescription)
      : item.prescription;
    setEditing({ ...target, fields: prescriptionFields(value) });
  };
  const applyPrescription = (prescription: Prescription) => {
    if (!editing) return;
    if (editing.athleteId)
      change({
        overrides: [
          ...form.overrides.filter((o) => !(o.itemRef === editing.itemRef && o.athleteId === editing.athleteId)),
          { athleteId: editing.athleteId, itemRef: editing.itemRef, prescription },
        ],
      });
    else
      draft({
        blocks: form.draft.blocks.map((b) => ({
          ...b,
          items: b.items.map((i) => (i.ref === editing.itemRef ? { ...i, prescription } : i)),
        })),
      });
    setEditing(null);
  };
  const submit = async (publish: boolean) => {
    if (editing) {
      setError(m.nativeBuilder.applyPending);
      return;
    }
    if (!mounted.current || pending.current || stale || !ready || localState === "conflict") return;
    if (!online || !verified) {
      setError(m.nativeBuilder.serverUnverified);
      return;
    }
    const parsed = parseSessionForm(
      {
        ...form,
        publishAt: publish ? null : form.publishAt,
        phaseReview: phaseReady.key === planningKey && phaseReady.ready ? phaseReady.review : undefined,
      },
      duration,
    );
    if (parsed.success && !validSessionStructure(parsed.data.draft)) {
      setError(m.builder.sequence.invalid);
      return;
    }
    if (!parsed.success) {
      setError(builderErrors(parsed.error.issues));
      return;
    }
    if (publish && parsed.data.assignments.length === 0) {
      setError(m.builder.noAudience);
      return;
    }
    if (parsed.data.publishAt && Date.parse(parsed.data.publishAt) <= Date.now()) {
      setError(m.builder.schedulePast);
      return;
    }
    if (
      context.phasesEnabled &&
      (publish || parsed.data.publishAt || publishedAt) &&
      form.assignments.length &&
      (phaseReady.key !== planningKey || !phaseReady.ready)
    ) {
      setError(m.trainingPhases.reviewRequired);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setUncertain("save");
      const result = await persistBuilderSession({
        orgId,
        parsed: parsed.data,
        draft: snapshot(),
        publish,
        published: Boolean(publishedAt),
        transport: api,
        writer,
        active: () => mounted.current,
        onSaved: (next) => {
          setForm(next);
          setBaseline(JSON.stringify({ form: next, duration }));
        },
      });
      if (!mounted.current || !result) return;
      setBase(result.current);
      setPublishedAt(result.current.publishedAt);
      setForm(result.form);
      setBaseline(JSON.stringify({ form: result.form, duration }));
      setUncertain(null);
      setLocalState("idle");
      setPreview(false);
      if (result.cleanupFailed) {
        setError(m.nativeBuilder.storageAfterSave);
        setStale(true);
      } else
        setMessage(
          publish || result.current.publishedAt
            ? publishedAt
              ? m.builder.updated
              : m.builder.published
            : m.nativeBuilder.saved,
        );
      for (const key of [
        "coach-calendar",
        "tracking",
        "coach-session",
        "session",
        "session-edit",
        "exercise-history",
        "exercise-history-context",
      ])
        void client.invalidateQueries({ queryKey: [key, orgId] });
    } catch (failure) {
      if (!mounted.current) return;
      const cause = failure instanceof BuilderSaveFailure ? failure.original : failure;
      const saved = failure instanceof BuilderSaveFailure ? failure.saved : null;
      if (failure instanceof BuilderSaveFailure && !failure.networkStarted) {
        setUncertain(null);
        storageFailure(cause);
        return;
      }
      setError(saved && publish ? m.nativeBuilder.publishFailed : errorMessage(cause));
      if (cause instanceof ApiError && cause.status < 500) setUncertain(null);
      if (saved || !(cause instanceof ApiError) || cause.status === 409 || cause.status >= 500) {
        setStale(true);
        if (!form.id && !saved) setError(m.nativeBuilder.unknownCreation);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const saveTemplate = async () => {
    if (editing) {
      setError(m.nativeBuilder.applyPending);
      return;
    }
    if (!mounted.current || pending.current || !online || !verified || !ready) return;
    const result = parseSessionForm(form, duration);
    if (!result.success) {
      setError(builderErrors(result.error.issues));
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveSessionTemplate(orgId, result.data.draft);
      if (mounted.current) {
        setAvailableTemplates((values) => [{ ...result.data.draft, id: saved.id, canDelete: true }, ...values]);
        setMessage(m.nativeBuilder.templateSaved);
      }
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const review = () => {
    if (editing) {
      setError(m.nativeBuilder.applyPending);
      return;
    }
    const parsed = parseSessionForm(form, duration);
    if (!parsed.success) {
      setError(builderErrors(parsed.error.issues));
      return;
    }
    if (!form.assignments.length) {
      setError(m.builder.noAudience);
      return;
    }
    setPreview(true);
  };
  const removeTemplate = async (id: string) => {
    if (!mounted.current || pending.current || !online || !verified) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.deleteSessionTemplate(orgId, id);
      if (!mounted.current) return;
      setAvailableTemplates((values) => values.filter((t) => t.id !== id));
      setMessage(m.nativeBuilder.templateDeleted);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const removeSession = async () => {
    if (
      !mounted.current ||
      pending.current ||
      !online ||
      !verified ||
      stale ||
      !base ||
      !form.id ||
      localState === "conflict"
    )
      return;
    pending.current = true;
    closing.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    let removed = false;
    try {
      await api.deleteSession(orgId, form.id, { expectedVersion: base.version, expectedLogCount: base.logCount });
      removed = true;
      try {
        await writer.remove();
      } catch {
        if (mounted.current) setError(m.nativeBuilder.deletedLocalCleanup);
      }
      for (const key of [
        "coach-calendar",
        "tracking",
        "coach-session",
        "session",
        "athlete-calendar",
        "today",
        "exercise-history",
        "exercise-history-context",
      ])
        void client.invalidateQueries({ queryKey: [key, orgId] });
      if (mounted.current) setDeleted(true);
    } catch (cause) {
      closing.current = false;
      if (mounted.current) {
        setError(errorMessage(cause));
        // Relecture requise avant toute nouvelle opération, y compris après réponse perdue.
        setStale(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) {
        if (removed) setUncertain(null);
        setBusy(false);
      }
    }
  };
  const reloadCurrent = async () => {
    if (pending.current || !mounted.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (ready && dirty) await writer.write(snapshot());
      if (mounted.current) onReload();
    } catch (cause) {
      if (mounted.current) storageFailure(cause);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const recover = async (keep: boolean) => {
    if (!stored || pending.current || !mounted.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (keep) {
        if (stored.value.pending && !stored.value.form.id) return;
        const recovered = recoveredBuilderDraft(stored.value, initial, verified, context);
        await writer.write(recovered);
        if (!mounted.current) return;
        setForm(recovered.form);
        setDuration(recovered.duration);
        setEditing(recovered.prescription ?? null);
        setUncertain(recovered.pending);
        setLocalState("saved");
      } else {
        await writer.remove();
        if (!mounted.current) return;
        setLocalState("idle");
      }
      setReady(true);
    } catch (cause) {
      if (mounted.current) storageFailure(cause);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (deleted)
    return (
      <StackScreen world="work" title={m.nativeBuilder.deleted}>
        {error ? <T accessibilityRole="alert">{error}</T> : null}
        <Button label={m.nav.calendrier} onPress={() => router.replace("/(coach)/planning")} />
      </StackScreen>
    );
  if (!ready && stored)
    return (
      <StackScreen world="work" title={m.nativeBuilder.recoveredTitle}>
        {stored.value.pending ? <T accessibilityRole="alert">{m.nativeBuilder.pendingReply}</T> : null}
        {!verified ? <T accessibilityRole="alert">{m.nativeBuilder.serverUnverified}</T> : null}
        {verified && initial && stored.value.form.expectedVersion !== initial.version ? (
          <T>{m.nativeBuilder.restoreChanged}</T>
        ) : null}
        {error ? (
          <T tone="danger" accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        <T variant="title2" heading>
          {m.nativeBuilder.localVersion}
        </T>
        <BuilderSummary
          form={stored.value.form}
          duration={stored.value.duration}
          context={stored.value.context}
          pendingPrescription={stored.value.prescription}
        />
        {verified && initial ? (
          <>
            <T variant="title2" heading>
              {m.nativeBuilder.serverVersion}
            </T>
            <BuilderSummary
              form={initialForm(initial, initial.date)}
              duration={initial.draft.durationMin?.toString() ?? ""}
              context={context}
            />
          </>
        ) : null}
        {stored.value.pending && !stored.value.form.id ? (
          <>
            <T>{m.nativeBuilder.unknownCreation}</T>
            <Button variant="secondary" label={m.nav.calendrier} onPress={() => router.push("/(coach)/planning")} />
          </>
        ) : (
          <Button
            label={m.nativeBuilder.restore}
            disabled={busy}
            onPress={() => confirm(m.nativeBuilder.restoreConfirm, () => void recover(true))}
          />
        )}
        <Button
          variant="secondary"
          label={m.nativeBuilder.discardLocal}
          disabled={busy}
          onPress={() => confirm(m.nativeBuilder.discardLocalConfirm, () => void recover(false), true)}
        />
        <Button
          variant="secondary"
          label={m.nativeBuilder.reload}
          disabled={busy || !online}
          onPress={() => onReload()}
        />
      </StackScreen>
    );
  return (
    <StackScreen world="work" title={form.id ? m.common.edit + " · " + m.builder.title : m.coach.newSession}>
      {!online || !verified ? <T accessibilityRole="alert">{m.nativeBuilder.serverUnverified}</T> : null}
      {localState === "conflict" ? (
        <Button
          variant="secondary"
          label={m.nativeBuilder.reload}
          onPress={() => confirm(m.nativeBuilder.reloadConfirm, () => onReload())}
        />
      ) : null}
      {!verified ? (
        <Button
          variant="secondary"
          label={m.nativeBuilder.reload}
          disabled={!online || busy}
          onPress={() => void reloadCurrent()}
        />
      ) : null}
      {localState === "saving" || localState === "saved" ? (
        <T accessibilityLiveRegion="polite" variant="caption">
          {localState === "saving" ? m.nativeBuilder.localSaving : m.nativeBuilder.localSaved}
        </T>
      ) : null}
      <View pointerEvents={busy ? "none" : "auto"} style={{ gap: space.lg }} accessibilityElementsHidden={busy}>
        <Field
          testID="builder-title"
          label={m.builder.titleLabel}
          value={form.draft.title}
          maxLength={120}
          onChangeText={(title) => draft({ title })}
        />
        <DateField label={m.builder.date} value={form.date} onChangeText={(date) => change({ date })} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {sessionType.options.map((type) => (
            <Chip
              key={type}
              label={m.sessionType[type]}
              active={form.draft.type === type}
              onPress={() => draft({ type })}
            />
          ))}
        </View>
        <T variant="title2" heading>
          {m.builder.audience}
        </T>
        {context.groups.map((g) => (
          <Chip
            key={g.id}
            label={`${g.name} · ${g.athleteCount}`}
            active={form.assignments.some((a) => a.targetType === "group" && a.targetId === g.id)}
            onPress={() => toggleAudience("group", g.id)}
          />
        ))}
        <Field label={m.builder.pickAthletes} value={athleteSearch} onChangeText={setAthleteSearch} />
        {context.athletes
          .filter(
            (a) =>
              (athleteSearch &&
                `${a.firstName} ${a.lastName}`
                  .toLocaleLowerCase("fr")
                  .includes(athleteSearch.toLocaleLowerCase("fr"))) ||
              form.assignments.some((t) => t.targetType === "athlete" && t.targetId === a.id),
          )
          .map((a) => (
            <Chip
              key={a.id}
              label={`${a.firstName} ${a.lastName}`}
              active={form.assignments.some((t) => t.targetType === "athlete" && t.targetId === a.id)}
              onPress={() => toggleAudience("athlete", a.id)}
            />
          ))}
        <Button
          variant="secondary"
          label={m.builder.useTemplate}
          disabled={!availableTemplates.length}
          onPress={() => setTemplates(true)}
        />
        {context.phasesEnabled ? (
          <NativePhasePlanning
            key={planningKey}
            orgId={orgId}
            date={form.date}
            groupIds={phaseGroups}
            athleteIds={phaseAthletes}
            initialChoices={form.phaseReview?.choices}
            onReady={acceptPhaseReview}
          />
        ) : null}
        {undo ? (
          <Button
            variant="secondary"
            label={m.builder.sequence.undo}
            onPress={() => {
              setForm((current) => ({ ...current, ...undo }));
              setUndo(null);
            }}
          />
        ) : null}
        {form.draft.blocks.map((block, bi) => (
          <Card key={block.ref}>
            <View style={{ gap: space.md }}>
              <Field
                nativeID={`block-${block.ref}`}
                label={m.nativeBuilder.blockName}
                value={block.name}
                maxLength={80}
                onChangeText={(name) =>
                  draft({ blocks: form.draft.blocks.map((b) => (b.ref === block.ref ? { ...b, name } : b)) })
                }
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {(["club", "autonomous", "both"] as const).map((variant) => (
                  <Chip
                    key={variant}
                    label={
                      variant === "club"
                        ? m.builder.versionClub
                        : variant === "autonomous"
                          ? m.builder.versionAutonomous
                          : m.nativeBuilder.both
                    }
                    active={block.variant === variant}
                    onPress={() =>
                      draft({ blocks: form.draft.blocks.map((b) => (b.ref === block.ref ? { ...b, variant } : b)) })
                    }
                  />
                ))}
              </View>
              <NativeSequenceEditor
                block={block}
                exercises={context.exercises}
                onChange={(next) =>
                  blocks(form.draft.blocks.map((current) => (current.ref === block.ref ? next : current)))
                }
                onEdit={(itemRef) => openPrescription({ itemRef })}
                onAdjust={(itemRef) => {
                  setAthleteSearch("");
                  setAdjusting(itemRef);
                }}
                onMove={setMoving}
                canMove={form.draft.blocks.length > 1}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                <Button
                  compact
                  variant="secondary"
                  label={m.nativeBuilder.up}
                  disabled={bi === 0}
                  onPress={() => blocks(move(form.draft.blocks, bi, -1))}
                />
                <Button
                  compact
                  variant="secondary"
                  label={m.nativeBuilder.down}
                  disabled={bi === form.draft.blocks.length - 1}
                  onPress={() => blocks(move(form.draft.blocks, bi, 1))}
                />
                <Button
                  compact
                  variant="secondary"
                  label={m.common.delete}
                  disabled={form.draft.blocks.length === 1}
                  onPress={() =>
                    confirm(
                      m.nativeBuilder.removeBlock,
                      () => blocks(form.draft.blocks.filter((b) => b.ref !== block.ref)),
                      true,
                    )
                  }
                />
              </View>
            </View>
          </Card>
        ))}
        <Button
          variant="secondary"
          label={m.builder.addBlock}
          disabled={form.draft.blocks.length >= 12}
          onPress={() =>
            blocks([
              ...form.draft.blocks,
              { ref: randomUUID(), name: m.builder.blocks.main, variant: "club", items: [] },
            ])
          }
        />
        <Button
          variant="secondary"
          label={advanced ? m.nativeBuilder.hideAdvanced : m.nativeBuilder.advanced}
          onPress={() => setAdvanced(!advanced)}
        />
        {advanced ? (
          <View style={{ gap: space.md }}>
            <Button
              variant="secondary"
              label={m.builder.saveTemplate}
              disabled={!online}
              onPress={() => void saveTemplate()}
            />
            <Field
              label={m.builder.time}
              value={form.startTime ?? ""}
              placeholder={m.nativeBuilder.timeHint}
              onChangeText={(text) => change({ startTime: text || null })}
            />
            <Field
              label={m.builder.location}
              value={form.location ?? ""}
              maxLength={120}
              onChangeText={(text) => change({ location: text || null })}
            />
            <Field label={m.builder.duration} value={duration} keyboardType="number-pad" onChangeText={setDuration} />
            <Field
              label={m.builder.coachNote}
              value={form.draft.coachNote ?? ""}
              maxLength={280}
              multiline
              onChangeText={(text) => draft({ coachNote: text || null })}
            />
            {!publishedAt ? (
              <View style={{ gap: space.sm }}>
                <Chip
                  label={m.builder.schedule}
                  active={form.publishAt !== null}
                  onPress={() => change({ publishAt: form.publishAt === null ? `${form.date}T18:00` : null })}
                />
                {form.publishAt !== null ? (
                  <>
                    <T variant="caption">
                      {m.nativeBuilder.scheduleZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
                    </T>
                    <DateField
                      label={m.nativeBuilder.scheduleDate}
                      value={form.publishAt.split("T")[0] ?? ""}
                      onChangeText={(text) =>
                        change({ publishAt: `${text}T${form.publishAt?.split("T")[1] ?? "18:00"}` })
                      }
                    />
                    <Field
                      label={m.nativeBuilder.scheduleTime}
                      value={form.publishAt.split("T")[1] ?? ""}
                      placeholder={m.nativeBuilder.timeHint}
                      onChangeText={(text) =>
                        change({ publishAt: `${form.publishAt?.split("T")[0] ?? form.date}T${text}` })
                      }
                    />
                  </>
                ) : null}
              </View>
            ) : null}
            <Button
              variant="secondary"
              label={m.builder.generate}
              onPress={() =>
                confirm(m.nativeBuilder.generateConfirm, () => {
                  const club = form.draft.blocks.filter((b) => b.variant === "club");
                  const copies = copyDraftWithNewRefs({ ...form.draft, blocks: club }, randomUUID).blocks.map((b) => ({
                    ...b,
                    variant: "autonomous" as const,
                  }));
                  blocks([...form.draft.blocks.filter((b) => b.variant !== "autonomous"), ...copies]);
                })
              }
            />
          </View>
        ) : null}
        {error ? (
          <T tone="danger" accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
        {stale && !form.id ? (
          <Button variant="secondary" label={m.nav.calendrier} onPress={() => router.push("/(coach)/planning")} />
        ) : null}
        {stale && form.id ? (
          <Button variant="secondary" label={m.nativeBuilder.reload} onPress={() => void reloadCurrent()} />
        ) : null}

        <Button
          label={publishedAt ? m.common.save : m.builder.publish}
          disabled={busy || stale || !online || !verified || localState === "conflict"}
          testID="builder-review"
          onPress={review}
        />
        {!publishedAt ? (
          <Button
            variant="secondary"
            label={form.publishAt ? m.builder.publishLater : m.builder.saveDraft}
            disabled={busy || stale || !online || !verified || localState === "conflict"}
            onPress={() => void submit(false)}
          />
        ) : null}
        {form.id && !dirty ? (
          <Button
            variant="secondary"
            label={m.coach.trackingTitle}
            onPress={() => router.push({ pathname: "/coach-session/[id]", params: { id: form.id! } })}
          />
        ) : null}
        {base && form.id ? (
          <Button
            variant="danger"
            label={m.nativeBuilder.deleteSession}
            disabled={busy || stale || !online || !verified || localState === "conflict"}
            onPress={() =>
              confirm(
                `${m.nativeBuilder.deleteSessionConfirm}${base.logCount ? `\n\n${m.builder.deleteLosesLogs(base.logCount)}` : ""}`,
                () => void removeSession(),
                true,
              )
            }
          />
        ) : null}
      </View>
      {moving ? (
        <Sheet visible title={m.nativeBuilder.moveTo} onClose={() => setMoving(null)}>
          {form.draft.blocks.map((block) => (
            <Button
              key={block.ref}
              label={block.name}
              variant="secondary"
              disabled={block.items.some((i) => i.ref === moving) || block.items.length >= 60}
              onPress={() => {
                blocks(moveSequenceExercise(form.draft, moving, block.ref!).blocks);
                setMoving(null);
              }}
            />
          ))}
        </Sheet>
      ) : null}
      {templates ? (
        <Sheet
          visible
          title={m.builder.useTemplate}
          onClose={() => {
            if (!busy) setTemplates(false);
          }}
        >
          {error ? (
            <T tone="danger" accessibilityRole="alert">
              {error}
            </T>
          ) : null}
          {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
          {!availableTemplates.length ? <T>{m.nativeBuilder.templatesEmpty}</T> : null}
          {availableTemplates.map((t) => (
            <Card key={t.id}>
              <Button
                variant="secondary"
                label={t.title}
                disabled={busy}
                onPress={() =>
                  confirm(m.nativeBuilder.replaceTemplate, () => {
                    change({ draft: copyDraftWithNewRefs(t, randomUUID), overrides: [] });
                    setDuration(t.durationMin?.toString() ?? "");
                    setTemplates(false);
                  })
                }
              />
              {t.canDelete ? (
                <Button
                  compact
                  variant="danger"
                  label={`${m.builder.deleteTemplate} · ${t.title}`}
                  disabled={busy || !online || !verified}
                  onPress={() =>
                    confirm(m.nativeBuilder.deleteTemplateConfirm(t.title), () => void removeTemplate(t.id), true)
                  }
                />
              ) : null}
            </Card>
          ))}
        </Sheet>
      ) : null}
      {adjusting ? (
        <Sheet visible title={m.builder.adjustments} onClose={() => setAdjusting(null)}>
          <Field label={m.nativeBuilder.adjustmentsFor} value={athleteSearch} onChangeText={setAthleteSearch} />
          {context.athletes
            .filter((a) =>
              `${a.firstName} ${a.lastName}`.toLocaleLowerCase("fr").includes(athleteSearch.toLocaleLowerCase("fr")),
            )
            .map((a) => {
              const override = form.overrides.find((o) => o.itemRef === adjusting && o.athleteId === a.id);
              return (
                <View key={a.id} style={{ gap: space.xs }}>
                  <Button
                    variant="secondary"
                    label={`${a.firstName} ${a.lastName}`}
                    onPress={() => {
                      openPrescription({ itemRef: adjusting, athleteId: a.id });
                      setAdjusting(null);
                    }}
                  />
                  <T variant="caption">
                    {override ? formatPrescription(override.prescription) : m.nativeBuilder.noAdjustment}
                  </T>
                  {override ? (
                    <Button
                      compact
                      variant="secondary"
                      label={m.nativeBuilder.resetAdjustment}
                      onPress={() => change({ overrides: form.overrides.filter((o) => o !== override) })}
                    />
                  ) : null}
                </View>
              );
            })}
        </Sheet>
      ) : null}
      {editing && (!editedItem || !editedExercise) ? (
        <Button
          variant="secondary"
          label={m.nativeBuilder.pendingPrescription}
          onPress={() => confirm(m.nativeBuilder.discardPrescription, () => setEditing(null), true)}
        />
      ) : null}
      {editing && editedItem && editedExercise && editedValue ? (
        <PrescriptionEditor
          key={`${editing.itemRef}-${editing.athleteId ?? "all"}`}
          title={editing.athleteId ? m.builder.adjustments : m.builder.setPrescription}
          exercise={editedExercise}
          value={editedValue}
          fields={editing.fields}
          onFieldsChange={(fields) => setEditing((value) => (value ? { ...value, fields } : null))}
          testKeys={context.testKeys}
          intensityEnabled={context.progressionEnabled === true}
          onClose={() => setEditing(null)}
          onApply={applyPrescription}
        />
      ) : null}
      {preview ? (
        <Sheet
          visible
          title={m.nativeBuilder.previewTitle}
          onClose={() => {
            if (!busy) setPreview(false);
          }}
          footer={
            <Button
              label={publishedAt ? m.common.save : m.builder.publish}
              loading={busy}
              disabled={!online || !verified || stale || localState === "conflict"}
              testID="builder-confirm"
              onPress={() => void submit(true)}
            />
          }
        >
          <T>{publishedAt ? m.nativeBuilder.updateConfirm : m.nativeBuilder.publishConfirm}</T>
          {error ? (
            <T tone="danger" accessibilityRole="alert">
              {error}
            </T>
          ) : null}
          <BuilderSummary form={form} duration={duration} context={context} />
        </Sheet>
      ) : null}
    </StackScreen>
  );
};
