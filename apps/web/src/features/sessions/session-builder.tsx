"use client";

import type { ExerciseSummary, Prescription, SessionDraft, SessionType } from "@tartan/contracts";
import { formatPrescription } from "@tartan/domain";
import { m, strengthTestLabel } from "@tartan/i18n";
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FilterPill, pillClass } from "@/components/filter-pill";
import { ActivityPicto } from "@/components/pictos";
import { EmptyState } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { CheckRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deleteSessionAction, saveSessionAction, saveTemplateAction } from "./session.action";

type BlockState = {
  key: string;
  name: string;
  items: { key: string; exerciseId: string; prescription: Prescription }[];
};
type Version = "club" | "autonomous";
type Override = { athleteId: string; itemRef: string; prescription: Prescription };

const newKey = () => Math.random().toString(36).slice(2, 10);

// Clés déterministes au premier rendu : le serveur et le navigateur doivent produire le même HTML.
const defaultBlocks = (prefix = "init"): BlockState[] => [
  { key: `${prefix}-warmup`, name: m.builder.blocks.warmup, items: [] },
  { key: `${prefix}-main`, name: m.builder.blocks.main, items: [] },
  { key: `${prefix}-cooldown`, name: m.builder.blocks.cooldown, items: [] },
];

const split = (draft: SessionDraft | null) => {
  if (!draft) return { club: defaultBlocks(), autonomous: [] as BlockState[] };
  const toState = (variant: Version) =>
    draft.blocks
      .filter((b) => b.variant === variant || b.variant === "both")
      .map((b, bi) => ({
        key: `${variant}-${bi}`,
        name: b.name,
        items: b.items.map((i, ii) => ({
          key: `${variant}-${bi}-${ii}`,
          exerciseId: i.exerciseId,
          prescription: i.prescription,
        })),
      }));
  return { club: toState("club"), autonomous: toState("autonomous") };
};

const numberOrUndefined = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const PrescriptionEditor = ({
  value,
  onChange,
  testKeys,
}: {
  value: Prescription;
  onChange: (p: Prescription) => void;
  testKeys: string[];
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
      {numberField("rest_s", m.builder.rest)}
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
              else onChange({ ...value, load: { type: "pct_1rm", value: 80, test: testKeys[0] ?? "back_squat" } });
            }}
          >
            <option value="none">Aucune</option>
            <option value="kg">{m.builder.loadKg}</option>
            <option value="pct_1rm">{m.builder.loadPct}</option>
          </Select>
        )}
      </Field>
      {value.load ? (
        <Field label={value.load.type === "kg" ? "Charge (kg)" : "% du max"}>
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
                  {strengthTestLabel(k)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
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
  initial,
  exercises,
  groups,
  athletes,
  templates,
  testKeys,
  defaultDate,
}: {
  initial: {
    id: string;
    date: string;
    startTime: string | null;
    location: string | null;
    publishedAt: string | null;
    publishAt: string | null;
    draft: SessionDraft;
    assignments: { targetType: "group" | "athlete"; targetId: string }[];
    overrides: Override[];
  } | null;
  exercises: ExerciseSummary[];
  groups: { id: string; name: string; athleteCount: number }[];
  athletes: { id: string; firstName: string; lastName: string }[];
  templates: (SessionDraft & { id: string })[];
  testKeys: string[];
  defaultDate: string;
}) => {
  const router = useRouter();
  const start = useMemo(() => split(initial?.draft ?? null), [initial]);
  const [title, setTitle] = useState(initial?.draft.title ?? "");
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
      (groups.length === 1 && groups[0] ? [groups[0].id] : []),
  );
  const [selectedAthletes, setSelectedAthletes] = useState(
    initial?.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId) ?? [],
  );
  const [overrides, setOverrides] = useState<Override[]>(initial?.overrides ?? []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ blockKey: string; itemKey: string } | null>(null);
  const [overrideFor, setOverrideFor] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const blocks = version === "club" ? club : autonomous;
  const setBlocks = version === "club" ? setClub : setAutonomous;
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const library = exercises.filter(
    (e) => (!category || e.category === category) && e.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const addExercise = (exerciseId: string, blockKey?: string) => {
    const exercise = byId.get(exerciseId);
    if (!exercise) return;
    const targetKey = blockKey ?? blocks[Math.min(1, blocks.length - 1)]?.key;
    setBlocks(
      blocks.map((b) =>
        b.key === targetKey
          ? { ...b, items: [...b.items, { key: newKey(), exerciseId, prescription: exercise.defaultPrescription }] }
          : b,
      ),
    );
  };
  const moveItem = (blockKey: string, index: number, delta: number) => {
    setBlocks(
      blocks.map((b) => {
        if (b.key !== blockKey) return b;
        const items = [...b.items];
        const [item] = items.splice(index, 1);
        if (item) items.splice(index + delta, 0, item);
        return { ...b, items };
      }),
    );
  };
  const removeItem = (blockKey: string, itemKey: string) =>
    setBlocks(blocks.map((b) => (b.key === blockKey ? { ...b, items: b.items.filter((i) => i.key !== itemKey) } : b)));
  const updateItem = (blockKey: string, itemKey: string, prescription: Prescription) =>
    setBlocks(
      blocks.map((b) =>
        b.key === blockKey ? { ...b, items: b.items.map((i) => (i.key === itemKey ? { ...i, prescription } : i)) } : b,
      ),
    );

  const generateAutonomous = () => {
    setAutonomous(club.map((b) => ({ ...b, key: newKey(), items: b.items.map((i) => ({ ...i, key: newKey() })) })));
    setVersion("autonomous");
    toast.ok("Version autonomie générée : ajuste-la (exercices sans matériel, consignes plus détaillées).");
  };

  const buildDraft = (): SessionDraft => {
    const toBlocks = (list: BlockState[], variant: Version) =>
      list
        .filter((b) => b.items.length > 0)
        .map((b) => ({
          name: b.name,
          variant,
          items: b.items.map((i) => ({ exerciseId: i.exerciseId, prescription: i.prescription })),
        }));
    return {
      title: title.trim(),
      type,
      durationMin: durationMin ? Number(durationMin) : null,
      coachNote: coachNote.trim() || null,
      blocks: [...toBlocks(club, "club"), ...toBlocks(autonomous, "autonomous")],
    };
  };

  const save = useAction(saveSessionAction, {
    onSuccess: ({ data, input }) => {
      toast.ok(
        input.publishAt
          ? m.builder.scheduled
          : input.publish
            ? initial?.publishedAt
              ? m.builder.updated
              : m.builder.published
            : "Brouillon enregistré.",
      );
      if (input.publish && data) router.push(`/seances/${data.id}/suivi`);
      else if (data && !initial) router.replace(`/seances/${data.id}`);
      router.refresh();
    },
    onError: ({ error }) => setFormError(error.serverError ?? m.errors.invalid),
  });
  const template = useAction(saveTemplateAction, {
    onSuccess: () => toast.ok("Modèle enregistré."),
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const remove = useAction(deleteSessionAction, {
    onSuccess: () => {
      router.push("/calendrier");
      router.refresh();
    },
  });

  const submit = (publish: boolean, scheduleAt: string | null = null) => {
    setFormError(null);
    const draft = buildDraft();
    if (!draft.title) return setFormError("Donne un titre à la séance.");
    if (draft.blocks.length === 0) return setFormError("Ajoute au moins un exercice.");
    const assignments = [
      ...selectedGroups.map((targetId) => ({ targetType: "group" as const, targetId })),
      ...selectedAthletes.map((targetId) => ({ targetType: "athlete" as const, targetId })),
    ];
    if ((publish || scheduleAt) && assignments.length === 0) return setFormError(m.builder.noAudience);
    if (scheduleAt && new Date(scheduleAt) <= new Date()) return setFormError(m.builder.schedulePast);
    save.execute({
      id: initial?.id,
      date,
      startTime: startTime || null,
      location: location.trim() || null,
      draft,
      assignments,
      overrides,
      publishAt: scheduleAt ? new Date(scheduleAt).toISOString() : null,
      publish,
    });
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const parts = split(t);
    setTitle(t.title);
    setType(t.type);
    setDurationMin(t.durationMin?.toString() ?? "");
    setCoachNote(t.coachNote ?? "");
    setClub(parts.club);
    setAutonomous(parts.autonomous);
  };

  // Références calculées comme à la publication : b{bloc}-i{exercice} dans l'ordre du brouillon.
  const clubRefs = club
    .filter((b) => b.items.length > 0)
    .flatMap((b, bi) => b.items.map((item, ii) => ({ ref: `b${bi}-i${ii}`, item })));

  const editingItem = editing
    ? blocks.find((b) => b.key === editing.blockKey)?.items.find((i) => i.key === editing.itemKey)
    : null;

  return (
    <div className="grid gap-4 desktop:grid-cols-[300px_minmax(0,1fr)] desktop:gap-x-6">
      <section
        aria-label={m.builder.details}
        className="desktop:col-start-2 min-w-0 flex flex-col gap-4 rounded-card on-card bg-card p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label={m.builder.titleLabel} className="min-w-64 flex-1">
            {(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          {templates.length > 0 ? (
            <Field label={m.builder.useTemplate}>
              {(a) => (
                <Select {...a} defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="" disabled>
                    Choisir
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 desktop:grid-cols-5">
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
            {(a) => <Input {...a} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
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
        <Field label={m.builder.coachNote}>
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
      </section>

      <section aria-label={m.builder.body} className="desktop:col-start-2 min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Version de la séance" className="flex flex-wrap items-center gap-2">
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
              Partir de zéro
            </Button>
          ) : null}
        </div>

        {version === "autonomous" && autonomous.length === 0 ? (
          <EmptyState>Pas encore de version autonomie. Les absents recevraient la version club.</EmptyState>
        ) : null}

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
              Nom du bloc
            </label>
            <input
              id={`block-${block.key}`}
              value={block.name}
              onChange={(e) => setBlocks(blocks.map((b) => (b.key === block.key ? { ...b, name: e.target.value } : b)))}
              className="t-h2 min-h-11 w-full border-b border-card-line bg-card-raised px-4 hover:bg-raise"
            />
            {block.items.length === 0 ? <p className="px-4 py-3 text-soft">{m.builder.dropHere}</p> : null}
            <ul className="divide-y divide-card-line">
              {block.items.map((item, index) => {
                const exercise = byId.get(item.exerciseId);
                return (
                  <li key={item.key} className="flex flex-wrap items-center gap-x-1 gap-y-1 px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setEditing({ blockKey: block.key, itemKey: item.key })}
                      className="flex min-h-11 min-w-48 flex-1 items-center gap-3 rounded-button px-2 py-1 text-left leading-tight hover:bg-raise"
                    >
                      <ActivityPicto kind={exercise?.category ?? "strength"} className="size-5 text-soft" />
                      <span className="flex min-w-0 flex-col desktop:flex-1 desktop:flex-row desktop:items-center desktop:gap-4">
                        <span className="break-words font-semibold desktop:w-1/2">
                          {exercise?.name ?? "Exercice supprimé"}
                        </span>
                        {formatPrescription(item.prescription) ? (
                          <span className="t-num text-[17px] desktop:w-1/2">
                            {formatPrescription(item.prescription)}
                          </span>
                        ) : (
                          <span className="t-caption font-normal text-alert desktop:w-1/2">
                            {m.builder.setPrescription}
                          </span>
                        )}
                      </span>
                    </button>
                    <IconButton label="Monter" disabled={index === 0} onClick={() => moveItem(block.key, index, -1)}>
                      <ArrowUp aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Descendre"
                      disabled={index === block.items.length - 1}
                      onClick={() => moveItem(block.key, index, 1)}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Retirer ${exercise?.name ?? ""}`}
                      onClick={() => removeItem(block.key, item.key)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {blocks.length > 0 ? (
          <Button
            size="sm"
            variant="quiet"
            className="self-start"
            onClick={() => setBlocks([...blocks, { key: newKey(), name: "Nouveau bloc", items: [] }])}
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
            Tout
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
        <ul className="-mx-1 flex flex-col divide-y divide-card-line">
          {library.map((e) => (
            <li
              key={e.id}
              draggable
              onDragStart={(ev) => ev.dataTransfer.setData("text/exercise-id", e.id)}
              className="flex cursor-grab items-center gap-2 px-1 py-1 active:cursor-grabbing"
            >
              <GripVertical aria-hidden className="size-4 shrink-0 text-st-upcoming" />
              <ActivityPicto kind={e.category} className="size-5 text-soft" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="break-words font-semibold">{e.name}</span>
                <span className="t-caption font-normal text-soft">
                  {m.exerciseCategory[e.category as keyof typeof m.exerciseCategory]}
                </span>
              </span>
              <IconButton label={`Ajouter ${e.name} à la séance`} onClick={() => addExercise(e.id)}>
                <Plus aria-hidden className="size-5" />
              </IconButton>
            </li>
          ))}
        </ul>
      </aside>

      <section className="desktop:col-start-2 min-w-0 flex flex-col gap-3 rounded-card on-card bg-card p-4">
        <h2 className="t-h2">{m.builder.audience}</h2>
        <div className="grid gap-4 tablet:grid-cols-2">
          <fieldset>
            <legend className="t-caption mb-1">{m.builder.entireGroup}</legend>
            {groups.map((g) => (
              <CheckRow
                key={g.id}
                label={g.name}
                detail={`${g.athleteCount} athlète${g.athleteCount > 1 ? "s" : ""}`}
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

      {clubRefs.length > 0 && athletes.length > 0 ? (
        <details className="desktop:col-start-2 min-w-0 rounded-card on-card bg-card px-4 py-2">
          <summary className="t-h2 flex min-h-11 items-center gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden className="size-5 transition-transform [[open]>summary>&]:rotate-90" />
            {m.builder.adjustments}
          </summary>
          <div className="mb-2 mt-1 flex flex-col gap-3">
            <Field label="Athlète">
              {(a) => (
                <Select {...a} value={overrideFor} onChange={(e) => setOverrideFor(e.target.value)}>
                  <option value="">Choisir</option>
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
                  const current = overrides.find((o) => o.athleteId === overrideFor && o.itemRef === ref);
                  const sets = current?.prescription.sets ?? "";
                  const reps = current?.prescription.reps ?? "";
                  const load = current?.prescription.load;
                  const update = (patch: Prescription) => {
                    const merged = { ...current?.prescription, ...patch };
                    const others = overrides.filter((o) => !(o.athleteId === overrideFor && o.itemRef === ref));
                    const empty = Object.values(merged).every((v) => v === undefined);
                    setOverrides(
                      empty ? others : [...others, { athleteId: overrideFor, itemRef: ref, prescription: merged }],
                    );
                  };
                  return (
                    <div key={ref} className="border-t border-card-line pt-3">
                      <p className="font-semibold">{byId.get(item.exerciseId)?.name}</p>
                      <p className="t-caption mb-2 font-normal text-soft">
                        Groupe : {formatPrescription(item.prescription)}
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
                        <Field label="Charge (kg)">
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
      <div className="on-card desktop:col-start-2 min-w-0 z-10 flex flex-wrap items-center gap-2 rounded-card bg-card p-3 desktop:sticky desktop:bottom-4">
        <Button disabled={save.isPending} onClick={() => submit(true)}>
          {initial?.publishedAt ? "Enregistrer et prévenir les athlètes" : m.builder.publish}
        </Button>
        {!initial?.publishedAt ? (
          <Button variant="secondary" disabled={save.isPending} onClick={() => submit(false)}>
            {m.builder.saveDraft}
          </Button>
        ) : null}
        {!initial?.publishedAt ? (
          scheduling ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label={m.builder.scheduleAt}>
                {(a) => (
                  <Input
                    {...a}
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                  />
                )}
              </Field>
              <Button
                variant="secondary"
                disabled={save.isPending || !publishAt}
                onClick={() => submit(false, publishAt)}
              >
                {m.builder.schedule}
              </Button>
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
            else setFormError("Une séance avec un titre et un exercice est nécessaire pour créer un modèle.");
          }}
        >
          {m.builder.saveTemplate}
        </Button>
        {initial ? (
          <Button
            variant="danger"
            className={cn("ml-auto")}
            disabled={remove.isPending}
            onClick={() => window.confirm("Supprimer cette séance ?") && remove.execute({ id: initial.id })}
          >
            {m.common.delete}
          </Button>
        ) : null}
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editingItem ? (byId.get(editingItem.exerciseId)?.name ?? "") : ""}
        description="Prescription"
        wide
      >
        {editing && editingItem ? (
          <div className="flex flex-col gap-4">
            <PrescriptionEditor
              value={editingItem.prescription}
              testKeys={testKeys}
              onChange={(p) => updateItem(editing.blockKey, editing.itemKey, p)}
            />
            <Button onClick={() => setEditing(null)}>{m.common.close}</Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};
