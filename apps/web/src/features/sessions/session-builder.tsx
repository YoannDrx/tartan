"use client";

import { DateInput, DateTimeInput } from "@/components/ui/date-input";
import { markInstallOpportunity } from "@/features/shell/install-opportunity";

import { withSessionReturn } from "@/lib/session-navigation";

import {
  exerciseCategory,
  type ExerciseSummary,
  type Prescription,
  type SessionDraft,
  type SessionType,
} from "@tartan/contracts";
import {
  copyDraftWithNewRefs,
  expandSessionSnapshot,
  formatPrescription,
  normalizeExerciseTerm,
  validSessionStructure,
  withSessionRefs,
} from "@tartan/domain";
import { phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { PhasePlanningPanel } from "@/features/phases/phase-planning";
import { m, strengthTestLabel, formatDateLong } from "@tartan/i18n";
import { ChevronRight, GripVertical, Plus, Search, Undo2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FilterPill, pillClass } from "@/components/filter-pill";
import { ActivityPicto } from "@/components/pictos";
import { EmptyState } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useBuilderRecovery } from "./use-builder-recovery";
import { SequenceEditor } from "./sequence-editor";
import { attachItemKeys, overridesForSubmit, type KeyedOverride } from "./overrides";
import { deleteSessionAction, deleteTemplateAction, saveSessionAction, saveTemplateAction } from "./session.action";

type BlockState = {
  key: string;
  name: string;
  shared?: boolean;
  sequence?: SessionDraft["blocks"][number]["sequence"];
  items: { key: string; exerciseId: string; prescription: Prescription }[];
};
type Version = "club" | "autonomous";
type Override = KeyedOverride<Prescription>;

const newKey = () => crypto.randomUUID();

// Clés déterministes au premier rendu : le serveur et le navigateur doivent produire le même HTML.
const defaultBlocks = (prefix = "init"): BlockState[] => [
  { key: `${prefix}-warmup`, name: m.builder.blocks.warmup, items: [] },
  { key: `${prefix}-main`, name: m.builder.blocks.main, items: [] },
  { key: `${prefix}-cooldown`, name: m.builder.blocks.cooldown, items: [] },
];

const split = (draft: SessionDraft | null) => {
  if (!draft) return { club: defaultBlocks(), autonomous: [] as BlockState[] };
  const toState = (variant: Version) =>
    withSessionRefs(draft)
      .blocks.filter((b) => b.variant === variant || (variant === "club" && b.variant === "both"))
      .map((b) => ({
        key: b.ref!,
        name: b.name,
        shared: b.variant === "both",
        sequence: b.sequence ?? b.items.map((i) => ({ kind: "exercise" as const, itemRef: i.ref! })),
        items: b.items.map((i) => ({
          key: i.ref!,
          exerciseId: i.exerciseId,
          prescription: i.prescription,
        })),
      }));
  return { club: toState("club"), autonomous: toState("autonomous") };
};

const numberOrUndefined = (v: string): number | undefined => (v === "" ? undefined : Number(v));

export const PrescriptionEditor = ({
  value,
  onChange,
  testKeys,
  exercise,
  intensityEnabled,
}: {
  exercise?: { id: string; name: string };
  value: Prescription;
  onChange: (p: Prescription) => void;
  testKeys: string[];
  intensityEnabled: boolean;
}) => {
  const numberField = (
    key: "sets" | "reps" | "distance_m" | "duration_s" | "rest_s" | "ground_contacts",
    label: string,
  ) => (
    <Field label={label}>
      {(a) => (
        <Input
          {...a}
          type="number"
          min={0}
          inputMode="decimal"
          value={value[key] ?? ""}
          onChange={(e) => onChange({ ...value, [key]: numberOrUndefined(e.target.value) })}
        />
      )}
    </Field>
  );
  const loadType = value.load?.type ?? "none";
  return (
    <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3">
      {numberField("sets", m.builder.sets)}
      {numberField("reps", m.builder.reps)}
      {numberField("distance_m", m.builder.distance)}
      {numberField("duration_s", m.builder.durationS)}
      {numberField("rest_s", m.builder.sequence.betweenSets)}
      {numberField("ground_contacts", m.builder.contacts)}
      <Field label={m.builder.load}>
        {(a) => (
          <Select
            {...a}
            value={loadType}
            onChange={(e) => {
              const type = e.target.value;
              if (type === "none") {
                const { load: _removed, ...rest } = value;
                onChange(rest);
              } else if (type === "kg") onChange({ ...value, load: { type: "kg", value: 0 } });
              else
                onChange({
                  ...value,
                  load: {
                    type: "pct_1rm",
                    value: 80,
                    test: testKeys.find((key) => key === `exercise:${exercise?.id}`) ?? testKeys[0] ?? "back_squat",
                  },
                });
            }}
          >
            <option value="none">{m.builder.sequence.none}</option>
            <option value="kg">{m.builder.loadKg}</option>
            <option value="pct_1rm">{m.builder.loadPct}</option>
          </Select>
        )}
      </Field>
      {value.load ? (
        <Field label={value.load.type === "kg" ? m.builder.sequence.loadKg : m.builder.loadPct}>
          {(a) => (
            <Input
              {...a}
              type="number"
              min={0}
              step="0.25"
              value={value.load?.value ?? ""}
              onChange={(e) => {
                const load = value.load;
                if (load) onChange({ ...value, load: { ...load, value: Number(e.target.value) } });
              }}
            />
          )}
        </Field>
      ) : null}
      {value.load?.type === "pct_1rm" ? (
        <Field label={m.builder.test}>
          {(a) => (
            <Select
              {...a}
              value={value.load?.type === "pct_1rm" ? value.load.test : ""}
              onChange={(e) => {
                const load = value.load;
                if (load?.type === "pct_1rm") onChange({ ...value, load: { ...load, test: e.target.value } });
              }}
            >
              {testKeys.map((k) => (
                <option key={k} value={k}>
                  {k === `exercise:${exercise?.id}` ? exercise?.name : strengthTestLabel(k)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {/* Une cible déjà prescrite reste modifiable si la progression est éteinte ensuite. */}
      {intensityEnabled || value.intensityTarget ? (
        <Field label={m.nativeBuilder.intensity} hint={m.nativeBuilder.intensityHint}>
          {(a) => (
            <Select
              {...a}
              value={value.intensityTarget?.type ?? "none"}
              onChange={(e) => {
                const type = e.target.value;
                const { intensityTarget: _removed, ...rest } = value;
                onChange(
                  type === "rpe"
                    ? { ...rest, intensityTarget: { type, value: 7 } }
                    : type === "rir"
                      ? { ...rest, intensityTarget: { type, value: 2 } }
                      : rest,
                );
              }}
            >
              <option value="none">{m.nativeBuilder.noIntensity}</option>
              <option value="rpe">{m.builder.sequence.rpe}</option>
              <option value="rir">{m.builder.sequence.rir}</option>
            </Select>
          )}
        </Field>
      ) : null}
      {value.intensityTarget ? (
        <Field label={m.nativeBuilder.intensityValue}>
          {(a) => (
            <Input
              {...a}
              type="number"
              min={value.intensityTarget?.type === "rpe" ? 1 : 0}
              max={10}
              step={value.intensityTarget?.type === "rpe" ? 0.5 : 1}
              value={value.intensityTarget?.value ?? ""}
              onChange={(e) => {
                if (value.intensityTarget)
                  onChange({ ...value, intensityTarget: { ...value.intensityTarget, value: Number(e.target.value) } });
              }}
            />
          )}
        </Field>
      ) : null}
      <Field label={m.builder.tempo} hint={m.builder.tempoHint}>
        {(a) => (
          <Input
            {...a}
            maxLength={20}
            value={value.tempo ?? ""}
            onChange={(e) => onChange({ ...value, tempo: e.target.value || undefined })}
          />
        )}
      </Field>
      <Field label={m.builder.notes} className="col-span-2 tablet:col-span-3">
        {(a) => (
          <Input
            {...a}
            value={value.notes ?? ""}
            onChange={(e) => onChange({ ...value, notes: e.target.value || undefined })}
          />
        )}
      </Field>
    </div>
  );
};

export const SessionBuilder = ({
  userId,
  organizationId,
  phasesEnabled = false,
  progressionEnabled = false,
  initial,
  exercises,
  groups,
  athletes,
  templates,
  testKeys,
  defaultDate,
  defaultGroupId,
  returnTo,
}: {
  userId: string;
  organizationId: string;
  phasesEnabled?: boolean;
  progressionEnabled?: boolean;
  initial: {
    id: string;
    version: number;
    date: string;
    startTime: string | null;
    location: string | null;
    publishedAt: string | null;
    publishAt: string | null;
    draft: SessionDraft;
    assignments: { targetType: "group" | "athlete"; targetId: string }[];
    overrides: { athleteId: string; itemRef: string; prescription: Prescription }[];
    logCount: number;
    phaseReview?: import("@tartan/contracts").SessionPhaseReview;
  } | null;
  exercises: ExerciseSummary[];
  groups: { id: string; name: string; athleteCount: number }[];
  athletes: { id: string; firstName: string; lastName: string }[];
  templates: (SessionDraft & { id: string; canDelete?: boolean })[];
  testKeys: string[];
  defaultDate: string;
  defaultGroupId?: string;
  returnTo?: string;
}) => {
  const router = useRouter();
  const start = useMemo(() => split(initial?.draft ?? null), [initial]);
  const [title, setTitle] = useState(initial?.draft.title ?? "");
  // Un titre tapé avant l'hydratation n'existe que dans le champ : le rendu suivant l'effacerait.
  const titleField = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (titleField.current?.value) setTitle(titleField.current.value);
  }, []);
  const [type, setType] = useState<SessionType>(initial?.draft.type ?? "strength");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [scheduling, setScheduling] = useState(Boolean(initial?.publishAt));
  // Valeur d'un champ date et heure : l'heure locale de l'appareil, sans fuseau.
  const [publishAt, setPublishAt] = useState(() => {
    if (!initial?.publishAt) return "";
    const d = new Date(initial.publishAt);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [durationMin, setDurationMin] = useState(initial?.draft.durationMin?.toString() ?? "");
  const [coachNote, setCoachNote] = useState(initial?.draft.coachNote ?? "");
  const [club, setClub] = useState(start.club);
  const [autonomous, setAutonomous] = useState(start.autonomous);
  const [version, setVersion] = useState<Version>("club");
  const [selectedGroups, setSelectedGroups] = useState(
    initial?.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId) ??
      (defaultGroupId !== undefined
        ? groups.some((group) => group.id === defaultGroupId)
          ? [defaultGroupId]
          : []
        : groups.length === 1 && groups[0]
          ? [groups[0].id]
          : []),
  );
  const [selectedAthletes, setSelectedAthletes] = useState(
    initial?.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId) ?? [],
  );
  const planningKey = phasePlanningKey(date, selectedGroups, selectedAthletes);
  const [phaseReady, setPhaseReady] = useState<PhasePlanningReadiness>({ key: "", ready: false });
  const [overrides, setOverrides] = useState<Override[]>(() =>
    attachItemKeys(initial?.overrides ?? [], [...start.club, ...start.autonomous]),
  );
  const [chosenTemplate, setChosenTemplate] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ blockKey: string; itemKey: string } | null>(null);
  const [overrideFor, setOverrideFor] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [expectedVersion, setExpectedVersion] = useState(initial?.version);
  const [dirty, setDirty] = useState(!initial);
  const submitting = useRef(false);
  const [history, setHistory] = useState<
    {
      club: BlockState[];
      autonomous: BlockState[];
      title: string;
      type: SessionType;
      coachNote: string;
      durationMin: string;
      overrides: Override[];
    }[]
  >([]);
  const remember = () => {
    setHistory((h) => [...h.slice(-19), { club, autonomous, title, type, coachNote, durationMin, overrides }]);
    setDirty(true);
  };
  const changeBlocks = (next: BlockState[]) => {
    remember();
    setBlocks(next);
  };

  const blocks = version === "club" ? club : autonomous;
  const setBlocks = version === "club" ? setClub : setAutonomous;
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const library = exercises.filter(
    (e) =>
      (!category || e.category === category) &&
      [e.name, ...(e.aliases ?? [])].some((term) =>
        normalizeExerciseTerm(term).includes(normalizeExerciseTerm(search)),
      ),
  );

  const addExercise = (exerciseId: string, blockKey?: string) => {
    const exercise = byId.get(exerciseId);
    if (!exercise) return;
    const targetKey = blockKey ?? blocks[Math.min(1, blocks.length - 1)]?.key;
    const key = newKey();
    changeBlocks(
      blocks.map((b) =>
        b.key === targetKey
          ? {
              ...b,
              items: [...b.items, { key, exerciseId, prescription: exercise.defaultPrescription }],
              sequence: [
                ...(b.sequence ?? b.items.map((i) => ({ kind: "exercise" as const, itemRef: i.key }))),
                { kind: "exercise", itemRef: key },
              ],
            }
          : b,
      ),
    );
  };
  const updateItem = (blockKey: string, itemKey: string, prescription: Prescription) =>
    changeBlocks(
      blocks.map((b) =>
        b.key === blockKey ? { ...b, items: b.items.map((i) => (i.key === itemKey ? { ...i, prescription } : i)) } : b,
      ),
    );

  const generateAutonomous = () => {
    remember();
    const source = buildDraft();
    const copied = copyDraftWithNewRefs(
      {
        ...source,
        blocks: source.blocks.filter((b) => b.variant === "club").map((b) => ({ ...b, variant: "autonomous" })),
      },
      newKey,
    );
    setAutonomous(split(copied).autonomous);
    setVersion("autonomous");
    toast.ok(m.builder.sequence.autonomousGenerated);
  };

  const buildDraft = (includeEmpty = false): SessionDraft => {
    const toBlocks = (list: BlockState[], variant: Version) =>
      list
        .filter((b) => includeEmpty || b.items.length > 0 || b.sequence?.length)
        .map((b) => ({
          ref: b.key,
          name: b.name,
          sequence: b.sequence ?? b.items.map((i) => ({ kind: "exercise" as const, itemRef: i.key })),
          variant: b.shared ? ("both" as const) : variant,
          items: b.items.map((i) => ({ ref: i.key, exerciseId: i.exerciseId, prescription: i.prescription })),
        }));
    return {
      structureVersion: 2,
      title: title.trim(),
      type,
      durationMin: durationMin ? Number(durationMin) : null,
      coachNote: coachNote.trim() || null,
      blocks: [...toBlocks(club, "club"), ...toBlocks(autonomous, "autonomous")],
    };
  };

  const recovery = useBuilderRecovery(
    userId,
    organizationId,
    initial?.id,
    {
      draft: buildDraft(true),
      date,
      startTime,
      location,
      duration: durationMin,
      scheduling,
      publishAt,
      groups: selectedGroups,
      athletes: selectedAthletes,
      overrides: overrides.map(({ athleteId, itemKey, prescription }) => ({
        athleteId,
        itemRef: itemKey,
        prescription,
      })),
      expectedVersion,
    },
    dirty,
  );
  const restoreDraft = () => {
    const stored = recovery.candidate;
    if (!stored || (stored.pending && !initial)) return;
    const f = stored.form;
    const parts = split(f.draft);
    setTitle(f.draft.title);
    setType(f.draft.type);
    setDate(f.date);
    setStartTime(f.startTime);
    setLocation(f.location);
    setDurationMin(f.duration);
    setCoachNote(f.draft.coachNote ?? "");
    setScheduling(f.scheduling);
    setPublishAt(f.publishAt);
    setSelectedGroups(f.groups);
    setSelectedAthletes(f.athletes);
    setClub(parts.club);
    setAutonomous(parts.autonomous);
    setOverrides(attachItemKeys(f.overrides, [...parts.club, ...parts.autonomous]));
    // Le fondateur relit explicitement la copie si la version du serveur a changé.
    setExpectedVersion(initial?.version ?? f.expectedVersion);
    setDirty(true);
    recovery.accept();
  };

  const save = useAction(saveSessionAction, {
    onSuccess: async ({ data, input }) => {
      submitting.current = false;
      setDirty(false);
      await recovery.saved();
      if (data) setExpectedVersion(data.version);
      if (data && (input.publish || input.publishAt)) markInstallOpportunity();
      toast.ok(
        input.publishAt
          ? m.builder.scheduled
          : input.publish
            ? initial?.publishedAt
              ? m.builder.updated
              : m.builder.published
            : m.builder.sequence.draftSaved,
      );
      if (input.publish && data) router.push(withSessionReturn(`/seances/${data.id}/suivi`, returnTo));
      else if (data && !initial) router.replace(withSessionReturn(`/seances/${data.id}`, returnTo));
      router.refresh();
    },
    onError: ({ error }) => {
      submitting.current = false;
      setFormError(error.serverError ?? m.errors.invalid);
    },
  });
  const template = useAction(saveTemplateAction, {
    onSuccess: () => toast.ok(m.builder.sequence.templateSaved),
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const removeTemplate = useAction(deleteTemplateAction, {
    onSuccess: () => {
      setChosenTemplate("");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const remove = useAction(deleteSessionAction, {
    onSuccess: () => {
      router.push(returnTo ?? "/calendrier");
      router.refresh();
    },
    onError: ({ error }) => setFormError(error.serverError ?? m.errors.invalid),
  });

  const submit = async (publish: boolean, scheduleAt: string | null = null) => {
    if (submitting.current || recovery.candidate) return;
    setFormError(null);
    const draft = buildDraft();
    if (!draft.title) return setFormError(m.builder.sequence.titleRequired);
    if (draft.blocks.length === 0) return setFormError(m.builder.sequence.exerciseRequired);
    if (!validSessionStructure(draft)) return setFormError(m.builder.sequence.invalid);
    const assignments = [
      ...selectedGroups.map((targetId) => ({ targetType: "group" as const, targetId })),
      ...selectedAthletes.map((targetId) => ({ targetType: "athlete" as const, targetId })),
    ];
    if ((publish || scheduleAt) && assignments.length === 0) return setFormError(m.builder.noAudience);
    if (scheduleAt && new Date(scheduleAt) <= new Date()) return setFormError(m.builder.schedulePast);
    const keptSchedule = scheduleAt ?? (!publish && scheduling ? publishAt : "");
    if (
      phasesEnabled &&
      (publish || keptSchedule || initial?.publishedAt) &&
      assignments.length &&
      (phaseReady.key !== planningKey || !phaseReady.ready)
    )
      return setFormError(m.trainingPhases.reviewRequired);
    submitting.current = true;
    await recovery.beforeSubmit();
    save.execute({
      id: initial?.id,
      expectedVersion,
      phaseReview: phaseReady.key === planningKey && phaseReady.ready ? phaseReady.review : undefined,
      date,
      startTime: startTime || null,
      location: location.trim() || null,
      draft,
      assignments,
      overrides: overridesForSubmit(overrides, [...club, ...autonomous]),
      // Enregistrer un brouillon programmé ne doit pas annuler sa programmation en silence.
      publishAt: keptSchedule ? new Date(keptSchedule).toISOString() : null,
      publish,
    });
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    remember();
    const parts = split(copyDraftWithNewRefs(t, newKey));
    setOverrides([]);
    setTitle(t.title);
    setType(t.type);
    setDurationMin(t.durationMin?.toString() ?? "");
    setCoachNote(t.coachNote ?? "");
    setClub(parts.club);
    setAutonomous(parts.autonomous);
  };

  // Même identité à l'écran, à la publication et après un réordonnancement.
  const clubRefs = club
    .filter((b) => b.items.length > 0)
    .flatMap((b) => b.items.map((item) => ({ ref: item.key, item })));

  const editingItem = editing
    ? blocks.find((b) => b.key === editing.blockKey)?.items.find((i) => i.key === editing.itemKey)
    : null;

  return (
    <div
      onChangeCapture={() => setDirty(true)}
      className="grid gap-4 desktop:grid-cols-[300px_minmax(0,1fr)] desktop:gap-x-6"
    >
      {recovery.candidate ? (
        <section
          className="desktop:col-start-2 rounded-card on-card bg-card p-4"
          aria-label={m.nativeBuilder.recoveredTitle}
        >
          <h2 className="t-h2">{m.nativeBuilder.recoveredTitle}</h2>
          <p>
            {recovery.candidate.pending && !initial
              ? m.nativeBuilder.pendingReply
              : recovery.candidate.form.expectedVersion !== initial?.version
                ? m.nativeBuilder.restoreChanged
                : m.nativeBuilder.restoreConfirm}
          </p>
          <p className="my-2 font-semibold">{recovery.candidate.form.draft.title || m.builder.sequence.untitled}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={recovery.candidate.pending && !initial} onClick={restoreDraft}>
              {m.nativeBuilder.restore}
            </Button>
            <ConfirmDialog
              title={m.nativeBuilder.discardLocalConfirm}
              onConfirm={async () => {
                try {
                  await recovery.discard();
                } catch {
                  setFormError(m.nativeBuilder.localError);
                }
              }}
              trigger={<Button variant="secondary">{m.nativeBuilder.discardLocal}</Button>}
            />
          </div>
        </section>
      ) : null}
      <section
        aria-label={m.builder.details}
        className="desktop:col-start-2 min-w-0 flex flex-col gap-4 rounded-card on-card bg-card p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label={m.builder.titleLabel} className="min-w-64 flex-1">
            {(a) => <Input {...a} ref={titleField} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          {templates.length > 0 ? (
            <div className="flex flex-col gap-1">
              <Field label={m.builder.useTemplate}>
                {(a) => (
                  <Select
                    {...a}
                    defaultValue=""
                    onChange={(e) => {
                      setChosenTemplate(e.target.value);
                      applyTemplate(e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      {m.builder.sequence.choose}
                    </option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {chosenTemplate && templates.find((t) => t.id === chosenTemplate)?.canDelete ? (
                <ConfirmDialog
                  title={m.builder.deleteTemplate}
                  onConfirm={() => removeTemplate.execute({ id: chosenTemplate })}
                  trigger={
                    <Button size="sm" variant="quiet" disabled={removeTemplate.isPending}>
                      {m.builder.deleteTemplate}
                    </Button>
                  }
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.builder.type}>
            {(a) => (
              <Select {...a} value={type} onChange={(e) => setType(e.target.value as SessionType)}>
                {(Object.keys(m.sessionType) as SessionType[]).map((t) => (
                  <option key={t} value={t}>
                    {m.sessionType[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={m.builder.date}>
            {(a) => <DateInput {...a} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <details open={Boolean(initial?.startTime || initial?.location || initial?.draft.coachNote)}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{m.builder.sequence.advanced}</summary>
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.builder.time}>
              {(a) => <Input {...a} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
            </Field>
            <Field label={m.builder.location}>
              {(a) => <Input {...a} value={location} onChange={(e) => setLocation(e.target.value)} />}
            </Field>
            <Field label={m.builder.duration}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={1}
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label={m.builder.coachNote} className="mt-3">
            {(a) => (
              <Textarea
                {...a}
                className="min-h-11"
                maxLength={280}
                value={coachNote}
                onChange={(e) => setCoachNote(e.target.value)}
              />
            )}
          </Field>
        </details>
      </section>

      <section className="desktop:col-start-2 min-w-0 flex flex-col gap-3 rounded-card on-card bg-card p-4">
        <h2 className="t-h2">{m.builder.audience}</h2>
        <div className="grid gap-4 tablet:grid-cols-2">
          <fieldset>
            <legend className="t-caption mb-1">{m.builder.entireGroup}</legend>
            {groups.map((g) => (
              <CheckRow
                key={g.id}
                label={g.name}
                detail={m.builder.sequence.athleteCount(g.athleteCount)}
                checked={selectedGroups.includes(g.id)}
                onChange={(e) =>
                  setSelectedGroups(
                    e.target.checked ? [...selectedGroups, g.id] : selectedGroups.filter((x) => x !== g.id),
                  )
                }
              />
            ))}
          </fieldset>
          <fieldset>
            <legend className="t-caption mb-1">{m.builder.pickAthletes}</legend>
            <div className="max-h-56 overflow-y-auto">
              {athletes.map((a) => (
                <CheckRow
                  key={a.id}
                  label={`${a.firstName} ${a.lastName}`}
                  checked={selectedAthletes.includes(a.id)}
                  onChange={(e) =>
                    setSelectedAthletes(
                      e.target.checked ? [...selectedAthletes, a.id] : selectedAthletes.filter((x) => x !== a.id),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      {phasesEnabled ? (
        <div className="desktop:col-start-2 min-w-0">
          <PhasePlanningPanel
            initialChoices={
              initial &&
              planningKey ===
                phasePlanningKey(
                  initial.date,
                  initial.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
                  initial.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
                )
                ? initial.phaseReview?.choices
                : []
            }
            key={planningKey}
            organizationId={organizationId}
            date={date}
            groupIds={selectedGroups}
            athleteIds={selectedAthletes}
            onReady={setPhaseReady}
          />
        </div>
      ) : null}
      <section aria-label={m.builder.body} className="desktop:col-start-2 min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={m.builder.sequence.versionLabel}
            className="flex flex-wrap items-center gap-2"
          >
            {(["club", "autonomous"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={version === v}
                className={pillClass(version === v)}
                onClick={() => setVersion(v)}
              >
                {v === "club" ? m.builder.versionClub : m.builder.versionAutonomous}
              </button>
            ))}
          </div>
          {version === "autonomous" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={generateAutonomous}
              disabled={club.every((b) => b.items.length === 0)}
            >
              {m.builder.generate}
            </Button>
          ) : null}
          {version === "autonomous" && autonomous.length === 0 ? (
            <Button size="sm" variant="quiet" onClick={() => setAutonomous(defaultBlocks(newKey()))}>
              {m.builder.sequence.fromScratch}
            </Button>
          ) : null}
        </div>

        {version === "autonomous" && club.some((b) => b.shared) ? (
          <p className="text-soft">
            {m.builder.sharedBlocksHint}{" "}
            {club
              .filter((b) => b.shared)
              .map((b) => b.name)
              .join(", ")}
          </p>
        ) : null}
        {version === "autonomous" && autonomous.length === 0 && !club.some((b) => b.shared) ? (
          <EmptyState rubric="seances">{m.builder.sequence.noAutonomous}</EmptyState>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm">
            {save.isPending ? m.builder.sequence.saving : dirty ? m.builder.sequence.unsaved : m.builder.sequence.saved}
          </p>
          {dirty ? (
            <p role="status" className="w-full text-sm">
              {recovery.state === "saved"
                ? m.nativeBuilder.localSaved
                : recovery.state === "error"
                  ? m.nativeBuilder.localError
                  : recovery.state === "saving"
                    ? m.nativeBuilder.localSaving
                    : m.builder.sequence.unsaved}
            </p>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            disabled={!history.length}
            onClick={() => {
              const previous = history.at(-1);
              if (previous) {
                setClub(previous.club);
                setAutonomous(previous.autonomous);
                setTitle(previous.title);
                setType(previous.type);
                setCoachNote(previous.coachNote);
                setDurationMin(previous.durationMin);
                setOverrides(previous.overrides);
                setHistory(history.slice(0, -1));
                setDirty(true);
              }
            }}
          >
            <Undo2 aria-hidden className="size-4" />
            {m.builder.sequence.undo}
          </Button>
        </div>
        {blocks.map((block) => (
          <section
            key={block.key}
            aria-label={block.name}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/exercise-id");
              if (id) addExercise(id, block.key);
            }}
            className="overflow-hidden rounded-card on-card bg-card"
          >
            <label className="sr-only" htmlFor={`block-${block.key}`}>
              {m.builder.sequence.blockName}
            </label>
            <input
              id={`block-${block.key}`}
              value={block.name}
              onChange={(e) =>
                changeBlocks(blocks.map((b) => (b.key === block.key ? { ...b, name: e.target.value } : b)))
              }
              className="t-h2 min-h-11 w-full border-b border-card-line bg-card-raised px-4 hover:bg-raise"
            />
            {version === "club" ? (
              <div className="px-3">
                <CheckRow
                  label={m.builder.sequence.sharedPhase}
                  checked={Boolean(block.shared)}
                  onChange={(e) =>
                    changeBlocks(blocks.map((b) => (b.key === block.key ? { ...b, shared: e.target.checked } : b)))
                  }
                />
              </div>
            ) : null}
            <SequenceEditor
              block={{
                ref: block.key,
                name: block.name,
                variant: block.shared ? "both" : version,
                items: block.items.map((i) => ({ ref: i.key, exerciseId: i.exerciseId, prescription: i.prescription })),
                sequence: block.sequence,
              }}
              exercises={exercises}
              onEdit={(itemKey) => setEditing({ blockKey: block.key, itemKey })}
              onChange={(next) =>
                changeBlocks(
                  blocks.map((b) =>
                    b.key === block.key
                      ? {
                          ...b,
                          sequence: next.sequence,
                          items: next.items.map((i) => ({
                            key: i.ref!,
                            exerciseId: i.exerciseId,
                            prescription: i.prescription,
                          })),
                        }
                      : b,
                  ),
                )
              }
            />
          </section>
        ))}
        {blocks.length > 0 ? (
          <Button
            size="sm"
            variant="quiet"
            className="self-start"
            onClick={() => changeBlocks([...blocks, { key: newKey(), name: m.builder.sequence.newBlock, items: [] }])}
          >
            <Plus aria-hidden className="size-4" />
            {m.builder.addBlock}
          </Button>
        ) : null}
      </section>

      <aside
        aria-label={m.builder.library}
        className="flex min-w-0 flex-col gap-3 rounded-card on-card bg-card p-4 desktop:sticky desktop:top-20 desktop:col-start-1 desktop:row-span-6 desktop:row-start-1 desktop:max-h-[calc(100dvh-100px)] desktop:self-start desktop:overflow-y-auto"
      >
        <h2 className="t-h2">{m.builder.library}</h2>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-5 text-soft" />
          <Field label={m.exercises.search} labelHidden>
            {(a) => (
              <Input
                {...a}
                type="search"
                className="pl-10"
                placeholder={m.exercises.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={pillClass(category === null)}
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            {m.builder.sequence.all}
          </button>
          {(Object.keys(m.exerciseCategory) as (keyof typeof m.exerciseCategory)[]).map((c) => (
            <button
              key={c}
              type="button"
              className={cn(pillClass(category === c), "px-2.5")}
              aria-pressed={category === c}
              aria-label={m.exerciseCategory[c]}
              title={m.exerciseCategory[c]}
              onClick={() => setCategory(c)}
            >
              <ActivityPicto kind={c} className="size-[18px]" />
            </button>
          ))}
        </div>
        {exercises.length === 0 ? (
          <p className="text-soft">
            {m.exercises.empty}{" "}
            <FilterPill href="/exercices?nouveau=1" active={false} className="mt-2">
              {m.exercises.new}
            </FilterPill>
          </p>
        ) : null}
        <ul className="-mx-1 flex max-h-80 flex-col divide-y divide-card-line overflow-y-auto desktop:max-h-none">
          {library.map((e) => (
            <li
              key={e.id}
              draggable
              onDragStart={(ev) => ev.dataTransfer.setData("text/exercise-id", e.id)}
              className="flex cursor-grab items-center gap-2 px-1 py-1 active:cursor-grabbing"
            >
              <GripVertical aria-hidden className="size-4 shrink-0 text-st-upcoming" />
              <ActivityPicto kind={e.category} className="size-5 text-soft" />
              <span className="flex min-w-0 flex-1 flex-col leading-snug">
                <span className="break-words font-semibold">{e.name}</span>
                <span className="t-caption font-normal text-soft">
                  {m.exerciseCategory[e.category as keyof typeof m.exerciseCategory]}
                </span>
              </span>
              <IconButton label={m.builder.sequence.addToSession(e.name)} onClick={() => addExercise(e.id)}>
                <Plus aria-hidden className="size-5" />
              </IconButton>
            </li>
          ))}
        </ul>
      </aside>

      {clubRefs.length > 0 && athletes.length > 0 ? (
        <details className="desktop:col-start-2 min-w-0 rounded-card on-card bg-card px-4 py-2">
          <summary className="t-h2 flex min-h-11 items-center gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden className="size-5 transition-transform [[open]>summary>&]:rotate-90" />
            {m.builder.adjustments}
          </summary>
          <div className="mb-2 mt-1 flex flex-col gap-3">
            <Field label={m.builder.sequence.athlete}>
              {(a) => (
                <Select {...a} value={overrideFor} onChange={(e) => setOverrideFor(e.target.value)}>
                  <option value="">{m.builder.sequence.choose}</option>
                  {athletes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.firstName} {x.lastName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {overrideFor
              ? clubRefs.map(({ ref, item }) => {
                  const current = overrides.find((o) => o.athleteId === overrideFor && o.itemKey === item.key);
                  const sets = current?.prescription.sets ?? "";
                  const reps = current?.prescription.reps ?? "";
                  const load = current?.prescription.load;
                  const update = (patch: Prescription) => {
                    const merged = { ...current?.prescription, ...patch };
                    const others = overrides.filter((o) => !(o.athleteId === overrideFor && o.itemKey === item.key));
                    const empty = Object.values(merged).every((v) => v === undefined);
                    setOverrides(
                      empty ? others : [...others, { athleteId: overrideFor, itemKey: item.key, prescription: merged }],
                    );
                  };
                  return (
                    <div key={ref} className="border-t border-card-line pt-3">
                      <p className="font-semibold">{byId.get(item.exerciseId)?.name}</p>
                      <p className="t-caption mb-2 font-normal text-soft">
                        {m.builder.sequence.commonPrescription(formatPrescription(item.prescription))}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label={m.builder.sets}>
                          {(a) => (
                            <Input
                              {...a}
                              type="number"
                              min={0}
                              value={sets}
                              onChange={(e) => update({ sets: numberOrUndefined(e.target.value) })}
                            />
                          )}
                        </Field>
                        <Field label={m.builder.reps}>
                          {(a) => (
                            <Input
                              {...a}
                              type="number"
                              min={0}
                              value={reps}
                              onChange={(e) => update({ reps: numberOrUndefined(e.target.value) })}
                            />
                          )}
                        </Field>
                        <Field label={m.builder.sequence.loadKg}>
                          {(a) => (
                            <Input
                              {...a}
                              type="number"
                              min={0}
                              step="0.25"
                              value={load?.type === "kg" ? load.value : ""}
                              onChange={(e) =>
                                update({
                                  load:
                                    e.target.value === "" ? undefined : { type: "kg", value: Number(e.target.value) },
                                })
                              }
                            />
                          )}
                        </Field>
                      </div>
                    </div>
                  );
                })
              : null}
          </div>
        </details>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="on-card desktop:col-start-2 min-w-0 rounded-card bg-card p-3 font-semibold text-alert"
        >
          {formError}
        </p>
      ) : null}
      {/* Sur ordinateur, une seule barre d'actions collée en bas. Sur téléphone, le formulaire est long : l'action
          principale reste collée au-dessus de la barre de navigation, les autres attendent au bout du formulaire. */}
      <div className="on-card z-10 min-w-0 flex-wrap items-center gap-2 rounded-card bg-card p-3 max-desktop:contents desktop:sticky desktop:bottom-4 desktop:col-start-2 desktop:flex desktop:border desktop:border-control-line desktop:shadow-float">
        <div className="max-desktop:sticky max-desktop:bottom-[calc(84px+env(safe-area-inset-bottom))] max-desktop:z-10 max-desktop:rounded-card max-desktop:border max-desktop:border-control-line max-desktop:bg-card max-desktop:p-2 max-desktop:shadow-float desktop:contents">
          <Button
            className="max-desktop:w-full"
            disabled={save.isPending || Boolean(recovery.candidate)}
            onClick={() => submit(true)}
          >
            {initial?.publishedAt ? m.builder.sequence.updatePublished : m.builder.publish}
          </Button>
        </div>
        <div className="max-desktop:flex max-desktop:flex-wrap max-desktop:items-center max-desktop:gap-2 max-desktop:rounded-card max-desktop:bg-card max-desktop:p-3 desktop:contents">
          {!initial?.publishedAt ? (
            <Button
              variant="secondary"
              disabled={save.isPending || Boolean(recovery.candidate)}
              onClick={() => submit(false)}
            >
              {m.builder.saveDraft}
            </Button>
          ) : null}
          {!initial?.publishedAt ? (
            scheduling ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={m.builder.scheduleAt} hint={m.builder.scheduleHint}>
                  {(a) => <DateTimeInput {...a} value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />}
                </Field>
                <Button
                  variant="secondary"
                  disabled={save.isPending || !publishAt}
                  onClick={() => submit(false, publishAt)}
                >
                  {m.builder.schedule}
                </Button>
                {initial?.publishAt ? (
                  <Button
                    variant="quiet"
                    disabled={save.isPending || Boolean(recovery.candidate)}
                    onClick={() => {
                      setScheduling(false);
                      setPublishAt("");
                    }}
                  >
                    {m.builder.scheduleCancel}
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setScheduling(true)}>
                {m.builder.schedule}
              </Button>
            )
          ) : null}
          <Button
            variant="quiet"
            disabled={template.isPending}
            onClick={() => {
              const draft = buildDraft();
              if (draft.title && draft.blocks.length) template.execute(draft);
              else setFormError(m.builder.sequence.templateRequiresContent);
            }}
          >
            {m.builder.saveTemplate}
          </Button>
          <Button variant="secondary" onClick={() => setPreviewing(true)}>
            {m.builder.preview}
          </Button>
          {initial ? (
            <ConfirmDialog
              title={m.builder.sequence.deleteSession}
              description={initial.logCount > 0 ? m.builder.deleteLosesLogs(initial.logCount) : undefined}
              onConfirm={() =>
                remove.execute({
                  id: initial.id,
                  expectedVersion: expectedVersion ?? initial.version,
                  expectedLogCount: initial.logCount,
                })
              }
              trigger={
                <Button variant="danger" className={cn("ml-auto")} disabled={remove.isPending}>
                  {m.common.delete}
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
      {/* Ce que l'athlète verra, avant de publier : aucune surprise sur le terrain. */}
      <Dialog open={previewing} onOpenChange={setPreviewing} title={title.trim() || m.builder.preview} wide>
        <div className="flex flex-col gap-4">
          <p className="t-caption font-normal text-soft">
            {[
              formatDateLong(date),
              startTime,
              location.trim(),
              durationMin ? m.builder.sequence.minutes(durationMin) : "",
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {coachNote.trim() ? <p className="whitespace-pre-line">{coachNote.trim()}</p> : null}
          {club.every((block) => block.items.length === 0) ? (
            <p className="text-soft">{m.builder.previewEmpty}</p>
          ) : null}
          {(() => {
            const draft = buildDraft();
            if (!validSessionStructure(draft)) return <p role="status">{m.builder.sequence.invalid}</p>;
            const snapshot = expandSessionSnapshot(
              draft,
              {
                ...draft,
                blocks: draft.blocks.map((b) => ({
                  ...b,
                  ref: b.ref!,
                  items: b.items.map((i) => {
                    const e = byId.get(i.exerciseId);
                    return {
                      ...i,
                      ref: i.ref!,
                      name: e?.name ?? m.builder.sequence.deletedExercise,
                      category: exerciseCategory.parse(e?.category ?? "strength"),
                      cues: e?.cues ?? [],
                      media: null,
                    };
                  }),
                })),
              },
              m.builder.sequenceRecovery,
            );
            return snapshot.blocks
              .filter((b) => b.variant === "both" || b.variant === version)
              .map((block) => (
                <section key={block.ref} className="flex flex-col gap-2">
                  <h3 className="t-section">{block.name}</h3>
                  <ol className="divide-y divide-card-line">
                    {block.items.map((item) => (
                      <li key={item.ref} className="py-2">
                        {item.rounds?.length ? (
                          <p className="text-sm text-soft">
                            {item.rounds.map((r) => m.builder.sequence.round(r.name, r.round, r.rounds)).join(" · ")}
                          </p>
                        ) : null}
                        <p className="font-semibold">{item.name}</p>
                        <p className="t-num">{formatPrescription(item.prescription)}</p>
                        {item.cues.length ? <p className="text-sm text-soft">{item.cues.join(", ")}</p> : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ));
          })()}
        </div>
      </Dialog>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editingItem ? (byId.get(editingItem.exerciseId)?.name ?? "") : ""}
        description={m.builder.sequence.prescription}
        wide
      >
        {editing && editingItem ? (
          <div className="flex flex-col gap-4">
            <PrescriptionEditor
              value={editingItem.prescription}
              exercise={byId.get(editingItem.exerciseId)}
              intensityEnabled={progressionEnabled}
              testKeys={testKeys.filter(
                (key) => !key.startsWith("exercise:") || key === `exercise:${editingItem.exerciseId}`,
              )}
              onChange={(p) => updateItem(editing.blockKey, editing.itemKey, p)}
            />
            <Button onClick={() => setEditing(null)}>{m.common.close}</Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};
