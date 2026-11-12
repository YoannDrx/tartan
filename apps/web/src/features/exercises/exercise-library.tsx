"use client";

import {
  exerciseMovement,
  exerciseEquipment,
  type ExerciseClassification,
  type ExerciseMediaSnapshot,
  type ExerciseSummary,
  type Prescription,
} from "@tartan/contracts";
import {
  formatPrescription,
  normalizeExerciseTerm,
  instagramUrl,
  parseInstagramUrl,
  parseYouTubeUrl,
  validateClipRange,
} from "@tartan/domain";
import { m, exerciseClassificationLabel } from "@tartan/i18n";
import { Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { pillClass } from "@/components/filter-pill";
import { ActivityPicto } from "@/components/pictos";
import { Sheet } from "@/components/sheet";
import { EmptyState, PageHeader } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { deleteExerciseAction, exerciseUploadAction, saveExerciseAction } from "./exercise.action";
import { ExternalVideo } from "./exercise-video";

type Category = keyof typeof m.exerciseCategory;
type Source = "shared" | "mine";
type Media = ExerciseMediaSnapshot & { streamUrl?: string };

const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const ExerciseForm = ({
  exercise,
  onDone,
  videoEnabled,
}: {
  exercise: ExerciseSummary | null;
  onDone: () => void;
  videoEnabled: boolean;
}) => {
  const media = exercise?.media as ExerciseMediaSnapshot | null | undefined;
  const youtube = media?.kind === "youtube" ? media : null;
  const [classification, setClassification] = useState<ExerciseClassification>(
    exercise?.classification ?? { movement: null, equipment: null },
  );
  const [name, setName] = useState(exercise?.name ?? "");
  const [aliases, setAliases] = useState((exercise?.aliases ?? []).join("\n"));
  const [category, setCategory] = useState<Category>((exercise?.category as Category) ?? "plyo");
  const [cues, setCues] = useState((exercise?.cues ?? []).join("\n"));
  const [tags, setTags] = useState((exercise?.tags ?? []).join(", "));
  const [p, setP] = useState<Prescription>(exercise?.defaultPrescription ?? {});
  const [strengthLoadKind, setStrengthLoadKind] = useState<NonNullable<ExerciseSummary["strengthLoadKind"]> | "">(
    exercise?.strengthLoadKind ?? "",
  );
  const [loadStepKg, setLoadStepKg] = useState(String(exercise?.loadStepKg ?? 1.25));
  const [url, setUrl] = useState(
    youtube
      ? `https://youtu.be/${youtube.youtubeId}`
      : media?.kind === "instagram"
        ? instagramUrl(media.instagramCode)
        : "",
  );
  const [title, setTitle] = useState((youtube ?? (media?.kind === "instagram" ? media : null))?.title ?? "");
  const [startS, setStartS] = useState(youtube?.startS?.toString() ?? "");
  const [endS, setEndS] = useState(youtube?.endS?.toString() ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useAction(exerciseUploadAction);
  const save = useAction(saveExerciseAction, {
    onSuccess: async ({ data }) => {
      if (file && data) {
        const res = await upload.executeAsync({ exerciseId: data.id });
        if (!res?.data) {
          toast.error(res?.serverError ?? m.errors.videoDisabled);
          return onDone();
        }
        const { createUpload } = await import("@mux/upchunk");
        const sending = createUpload({ endpoint: res.data.uploadUrl, file, chunkSize: 5120 });
        setProgress(0);
        sending.on("progress", (ev) => setProgress(Math.round(ev.detail)));
        sending.on("error", () => {
          setProgress(null);
          setError("L'envoi a échoué. L'exercice est enregistré : réessaie d'ajouter la vidéo.");
        });
        sending.on("success", () => {
          setProgress(null);
          toast.ok(m.video.processing);
          onDone();
        });
        return;
      }
      onDone();
    },
    onError: ({ error: e }) => setError(e.serverError ?? m.errors.invalid),
  });
  const nameError = save.result.validationErrors as { name?: { _errors?: string[] } } | undefined;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const start = num(startS) ?? null;
        const end = num(endS) ?? null;
        const instagram = Boolean(parseInstagramUrl(url));
        if (url && !instagram && !parseYouTubeUrl(url)) return setError(m.exercises.linkInvalid);
        if (!validateClipRange(start, end)) return setError(m.exercises.clipInvalid);
        const aliasList = aliases
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
        if (aliasList.length > 20 || aliasList.some((v) => v.length > 120)) return setError(m.exercises.aliasesInvalid);
        save.execute({
          id: exercise?.id,
          name,
          aliases: aliasList,
          category,
          classification,
          cues: cues
            .split("\n")
            .map((c) => c.trim())
            .filter(Boolean),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          defaultPrescription: p,
          strengthLoadKind: strengthLoadKind || null,
          loadStepKg: Number(loadStepKg),
          media: !url
            ? null
            : instagram
              ? { kind: "instagram", url, customTitle: title || null }
              : { kind: "youtube", url, customTitle: title || null, startS: start, endS: end },
        });
      }}
    >
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label={m.exercises.name} error={nameError?.name?._errors?.[0]}>
          {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={m.exercises.category}>
          {(a) => (
            <Select {...a} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {(Object.keys(m.exerciseCategory) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {m.exerciseCategory[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={m.exercises.aliases} hint={m.exercises.aliasesHint}>
        {(a) => <Textarea {...a} value={aliases} onChange={(e) => setAliases(e.target.value)} />}
      </Field>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{m.exerciseClassification.title}</summary>
        <div className="flex flex-col gap-3">
          <p className="text-soft">{m.exerciseClassification.hint}</p>
          <Field label={m.exerciseClassification.movement}>
            {(props) => (
              <Select
                {...props}
                value={classification.movement ?? ""}
                onChange={(e) =>
                  setClassification({
                    ...classification,
                    movement: (e.target.value as ExerciseClassification["movement"]) || null,
                  })
                }
              >
                <option value="">{m.exerciseClassification.unknown}</option>
                {exerciseMovement.options.map((key) => (
                  <option key={key} value={key}>
                    {exerciseClassificationLabel("movements", key)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">{m.exerciseClassification.equipment}</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="equipment-mode"
                checked={classification.equipment === null}
                onChange={() => setClassification({ ...classification, equipment: null })}
              />
              {m.exerciseClassification.unknown}
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="equipment-mode"
                checked={classification.equipment?.length === 0}
                onChange={() => setClassification({ ...classification, equipment: [] })}
              />
              {m.exerciseClassification.none}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {exerciseEquipment.options.map((key) => (
                <label key={key} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={classification.equipment?.includes(key) ?? false}
                    onChange={(e) =>
                      setClassification({
                        ...classification,
                        equipment: e.target.checked
                          ? [...(classification.equipment ?? []), key]
                          : (classification.equipment ?? []).filter((k) => k !== key),
                      })
                    }
                  />
                  {exerciseClassificationLabel("equipment", key)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
      <Field label={m.exercises.cues} hint={`${m.exercises.cuesHint} Une par ligne.`}>
        {(a) => <Textarea {...a} value={cues} onChange={(e) => setCues(e.target.value)} />}
      </Field>
      <Field label={m.exercises.tags} hint="Séparées par des virgules.">
        {(a) => <Input {...a} value={tags} onChange={(e) => setTags(e.target.value)} />}
      </Field>
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label={m.strength.convention} hint={m.strength.conventionHint}>
          {(a) => (
            <Select
              {...a}
              value={strengthLoadKind}
              onChange={(e) => setStrengthLoadKind(e.target.value as typeof strengthLoadKind)}
            >
              <option value="">{m.strength.unknownConvention}</option>
              {Object.entries(m.strength.conventions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={m.strength.step} hint={m.strength.stepHint}>
          {(a) => (
            <Input
              {...a}
              type="number"
              inputMode="decimal"
              min={0.01}
              max={100}
              step="0.01"
              value={loadStepKg}
              onChange={(e) => setLoadStepKg(e.target.value)}
            />
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3 border-t border-card-line pt-4">
        <legend className="t-section pr-2">{m.exercises.defaults}</legend>
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
          {(
            [
              ["sets", m.builder.sets],
              ["reps", m.builder.reps],
              ["distance_m", m.builder.distance],
              ["duration_s", m.builder.durationS],
              ["rest_s", m.builder.rest],
              ["ground_contacts", m.builder.contacts],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={0}
                  value={p[key] ?? ""}
                  onChange={(e) => setP({ ...p, [key]: num(e.target.value) })}
                />
              )}
            </Field>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3 border-t border-card-line pt-4">
        <legend className="t-section pr-2">Vidéo</legend>
        <Field label={m.exercises.videoUrl}>
          {(a) => (
            <Input
              {...a}
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/…"
            />
          )}
        </Field>
        {url ? (
          <div className="grid gap-3 tablet:grid-cols-3">
            <Field label={m.exercises.youtubeTitle}>
              {(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} />}
            </Field>
            {parseInstagramUrl(url) ? null : (
              <>
                <Field label={m.exercises.youtubeStart}>
                  {(a) => (
                    <Input {...a} type="number" min={0} value={startS} onChange={(e) => setStartS(e.target.value)} />
                  )}
                </Field>
                <Field label={m.exercises.youtubeEnd}>
                  {(a) => <Input {...a} type="number" min={0} value={endS} onChange={(e) => setEndS(e.target.value)} />}
                </Field>
              </>
            )}
          </div>
        ) : null}
        {videoEnabled ? (
          <Field label={m.exercises.uploadVideo}>
            {(a) => (
              <Input
                {...a}
                type="file"
                accept="video/*"
                className="py-2"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
          </Field>
        ) : (
          <p className="t-caption font-normal text-soft">{m.errors.videoDisabled}</p>
        )}
      </fieldset>
      {error ? (
        <p role="alert" className="text-alert">
          {error}
        </p>
      ) : null}
      {progress !== null ? (
        <progress value={progress} max={100} className="w-full accent-brand" aria-label="Progression de l'envoi" />
      ) : null}
      <Button type="submit" disabled={save.isPending || progress !== null}>
        {m.common.save}
      </Button>
    </form>
  );
};

const sourceLink = (media: Media | null) => {
  if (media?.kind === "instagram") return { service: "Instagram", href: instagramUrl(media.instagramCode) };
  if (media?.kind === "youtube") return { service: "YouTube", href: `https://youtu.be/${media.youtubeId}` };
  return null;
};

export const ExerciseDetail = ({ exercise }: { exercise: ExerciseSummary }) => {
  const media = exercise.media as Media | null;
  const source = sourceLink(media);
  const prescription = formatPrescription(exercise.defaultPrescription);
  return (
    <div className="flex flex-col gap-4">
      {media?.kind === "youtube" || media?.kind === "instagram" ? (
        <ExternalVideo media={media} title={exercise.name} />
      ) : media?.kind === "upload" && media.streamUrl ? (
        <video
          src={media.streamUrl}
          controls
          playsInline
          className="aspect-video w-full rounded-card bg-ink"
          aria-label={exercise.name}
        />
      ) : null}
      {prescription ? <p className="t-num text-[20px]">{prescription}</p> : null}
      {exercise.cues.length > 0 ? (
        <section>
          <h3 className="t-section">{m.exercises.cues}</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {exercise.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {source ? (
        <p className="t-caption flex flex-wrap items-center justify-between gap-x-4 font-normal text-soft">
          {media && "author" in media && media.author ? <span>{m.exercises.videoBy(media.author)}</span> : null}
          <a href={source.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">
            {m.exercises.watchOn(source.service)}
          </a>
        </p>
      ) : null}
    </div>
  );
};

export const ExerciseLibrary = ({
  exercises,
  openNew,
  videoEnabled,
  progressionEnabled = false,
}: {
  exercises: ExerciseSummary[];
  progressionEnabled?: boolean;
  openNew: boolean;
  videoEnabled: boolean;
}) => {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ exercise: ExerciseSummary | null } | null>(
    openNew ? { exercise: null } : null,
  );
  const [detail, setDetail] = useState<ExerciseSummary | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [search, setSearch] = useState("");
  const remove = useAction(deleteExerciseAction, { onSuccess: () => router.refresh() });
  const list = exercises.filter(
    (e) =>
      (!category || e.category === category) &&
      (!source || e.shared === (source === "shared")) &&
      [e.name, ...(e.aliases ?? [])].some((term) =>
        normalizeExerciseTerm(term).includes(normalizeExerciseTerm(search)),
      ),
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.exercises.title}
        actions={
          <>
            {progressionEnabled ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/outils/charges">{m.calculator.title}</Link>
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setDialog({ exercise: null })}>
              <Plus aria-hidden className="size-5" />
              {m.exercises.new}
            </Button>
          </>
        }
      />
      {exercises.length === 0 ? (
        <EmptyState
          rubric="exercices"
          action={
            <Button size="sm" variant="secondary" onClick={() => setDialog({ exercise: null })}>
              {m.exercises.new}
            </Button>
          }
        >
          {m.exercises.empty}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-3 desktop:flex-row desktop:items-center">
            <div className="on-card relative w-full rounded-[10px] desktop:w-72 desktop:shrink-0">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-5 text-fg-muted" />
              <Field label={m.exercises.search} labelHidden>
                {(a) => (
                  <Input
                    {...a}
                    type="search"
                    className="border-card bg-card pl-10"
                    placeholder={m.exercises.search}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <div role="group" aria-label={m.exercises.source} className="flex flex-wrap gap-1.5">
              {(
                [
                  [null, m.exercises.sourceAll],
                  ["shared", m.exercises.sourceShared],
                  ["mine", m.exercises.sourceMine],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  className={pillClass(source === value)}
                  aria-pressed={source === value}
                  onClick={() => setSource(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label={m.exercises.category} className="-mt-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={pillClass(category === null)}
                aria-pressed={category === null}
                onClick={() => setCategory(null)}
              >
                {m.exercises.allCategories}
              </button>
              {(Object.keys(m.exerciseCategory) as Category[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={pillClass(category === c)}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {m.exerciseCategory[c]}
                </button>
              ))}
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState rubric="exercices">{m.exercises.noMatch}</EmptyState>
          ) : (
            <Sheet>
              {(Object.keys(m.exerciseCategory) as Category[]).map((c) => {
                const rows = list.filter((e) => e.category === c);
                if (rows.length === 0) return null;
                return (
                  <section key={c} aria-label={m.exerciseCategory[c]}>
                    <h2 className="flex items-center gap-2 border-b border-card-line bg-card-raised px-4 py-1.5 text-inherit [&:not(:first-child)]:border-t">
                      <span className="t-section text-inherit">{m.exerciseCategory[c]}</span>
                      <span className="t-num ml-auto text-[15px] text-soft">{rows.length}</span>
                    </h2>
                    <ul className="divide-y divide-card-line">
                      {rows.map((e) => {
                        const media = e.media as Media | null;
                        return (
                          <li
                            key={e.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          >
                            <button
                              type="button"
                              onClick={() => setDetail(e)}
                              className="-mx-1 flex min-h-11 min-w-0 items-center gap-3 rounded-thumb px-1 text-left hover:bg-raise"
                            >
                              {media ? (
                                <span
                                  aria-hidden
                                  title={m.exercises.hasVideo}
                                  className="flex size-11 shrink-0 items-center justify-center rounded-thumb bg-accent text-on-accent"
                                >
                                  <Play className="size-4" />
                                </span>
                              ) : (
                                <span
                                  aria-hidden
                                  className="flex size-11 shrink-0 items-center justify-center rounded-thumb bg-card-raised text-fg-muted"
                                >
                                  <ActivityPicto kind={e.category} className="size-5" />
                                </span>
                              )}
                              <span className="block min-w-0 leading-snug">
                                <span className="block break-words font-semibold">{e.name}</span>
                                {e.shared ? (
                                  <span className="t-caption block font-normal text-soft">
                                    {m.exercises.sourceShared}
                                  </span>
                                ) : media?.kind === "youtube" && media.title ? (
                                  <span className="t-caption block font-normal text-soft">{media.title}</span>
                                ) : null}
                                <span className="t-caption block font-normal text-soft desktop:hidden">
                                  {formatPrescription(e.defaultPrescription) || (e.cues[0] ?? "")}
                                </span>
                              </span>
                            </button>
                            <p className="t-num text-[17px] max-desktop:hidden">
                              {formatPrescription(e.defaultPrescription) || (
                                <span className="font-body text-[13px] font-normal text-soft">{e.cues[0] ?? ""}</span>
                              )}
                            </p>
                            <div className="flex desktop:w-[88px]">
                              {e.shared ? null : (
                                <>
                                  <IconButton
                                    label={`${m.common.edit} ${e.name}`}
                                    onClick={() => setDialog({ exercise: e })}
                                  >
                                    <Pencil aria-hidden className="size-4" />
                                  </IconButton>
                                  <ConfirmDialog
                                    title={`Supprimer « ${e.name} » ?`}
                                    description={m.exercises.deleteNotice}
                                    onConfirm={() => remove.execute({ id: e.id })}
                                    trigger={
                                      <IconButton label={`${m.common.delete} ${e.name}`}>
                                        <Trash2 aria-hidden className="size-4" />
                                      </IconButton>
                                    }
                                  />
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </Sheet>
          )}
        </>
      )}
      <Dialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.name ?? m.exercises.title}
        wide
      >
        {detail ? (
          <div className="flex flex-col gap-4">
            <ExerciseDetail exercise={detail} />
            <Button asChild size="sm" variant="secondary" className="self-start">
              <Link href={`/exercices/${detail.id}`}>{m.exercises.openSheet}</Link>
            </Button>
          </div>
        ) : null}
      </Dialog>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.exercise ? dialog.exercise.name : m.exercises.new}
        wide
      >
        {dialog ? (
          <ExerciseForm
            exercise={dialog.exercise}
            videoEnabled={videoEnabled}
            onDone={() => {
              setDialog(null);
              router.refresh();
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
};
