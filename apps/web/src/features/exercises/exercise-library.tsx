"use client";

import type { ExerciseMediaSnapshot, ExerciseSummary, Prescription } from "@tartan/contracts";
import { formatPrescription, parseYouTubeUrl, validateClipRange } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pillClass } from "@/components/filter-pill";
import { ActivityPicto } from "@/components/pictos";
import { Sheet } from "@/components/sheet";
import { EmptyState, PageHeader } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { deleteExerciseAction, exerciseUploadAction, saveExerciseAction } from "./exercise.action";

type Category = keyof typeof m.exerciseCategory;

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
  const [name, setName] = useState(exercise?.name ?? "");
  const [category, setCategory] = useState<Category>((exercise?.category as Category) ?? "plyo");
  const [cues, setCues] = useState((exercise?.cues ?? []).join("\n"));
  const [tags, setTags] = useState((exercise?.tags ?? []).join(", "));
  const [p, setP] = useState<Prescription>(exercise?.defaultPrescription ?? {});
  const [url, setUrl] = useState(youtube ? `https://youtu.be/${youtube.youtubeId}` : "");
  const [title, setTitle] = useState(youtube?.title ?? "");
  const [startS, setStartS] = useState(youtube?.startS?.toString() ?? "");
  const [endS, setEndS] = useState(youtube?.endS?.toString() ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useAction(exerciseUploadAction);
  const save = useAction(saveExerciseAction, {
    onSuccess: async ({ data }) => {
      if (file && data) {
        const res = await upload.executeAsync({ exerciseId: data.id });
        if (res?.data) {
          const { createUpload } = await import("@mux/upchunk");
          createUpload({ endpoint: res.data.uploadUrl, file, chunkSize: 5120 });
          toast.ok(m.video.uploading);
        } else toast.error(res?.serverError ?? m.errors.videoDisabled);
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
        if (url && !parseYouTubeUrl(url)) return setError(m.exercises.youtubeInvalid);
        if (!validateClipRange(start, end)) return setError(m.exercises.clipInvalid);
        save.execute({
          id: exercise?.id,
          name,
          category,
          cues: cues
            .split("\n")
            .map((c) => c.trim())
            .filter(Boolean),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          defaultPrescription: p,
          media: url ? { kind: "youtube", url, customTitle: title || null, startS: start, endS: end } : null,
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
      <Field label={m.exercises.cues} hint={`${m.exercises.cuesHint} Une par ligne.`}>
        {(a) => <Textarea {...a} value={cues} onChange={(e) => setCues(e.target.value)} />}
      </Field>
      <Field label={m.exercises.tags} hint="Séparées par des virgules.">
        {(a) => <Input {...a} value={tags} onChange={(e) => setTags(e.target.value)} />}
      </Field>
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
        <Field label={m.exercises.youtubeUrl}>
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
            <Field label={m.exercises.youtubeStart}>
              {(a) => <Input {...a} type="number" min={0} value={startS} onChange={(e) => setStartS(e.target.value)} />}
            </Field>
            <Field label={m.exercises.youtubeEnd}>
              {(a) => <Input {...a} type="number" min={0} value={endS} onChange={(e) => setEndS(e.target.value)} />}
            </Field>
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
      <Button type="submit" disabled={save.isPending}>
        {m.common.save}
      </Button>
    </form>
  );
};

export const ExerciseLibrary = ({
  exercises,
  openNew,
  videoEnabled,
}: {
  exercises: ExerciseSummary[];
  openNew: boolean;
  videoEnabled: boolean;
}) => {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ exercise: ExerciseSummary | null } | null>(
    openNew ? { exercise: null } : null,
  );
  const [category, setCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const remove = useAction(deleteExerciseAction, { onSuccess: () => router.refresh() });
  const list = exercises.filter(
    (e) => (!category || e.category === category) && e.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.exercises.title}
        actions={
          <Button size="sm" onClick={() => setDialog({ exercise: null })}>
            <Plus aria-hidden className="size-5" />
            {m.exercises.new}
          </Button>
        }
      />
      {exercises.length === 0 ? (
        <EmptyState
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
            <EmptyState>{m.exercises.noMatch}</EmptyState>
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
                        const media = e.media as ExerciseMediaSnapshot | null;
                        return (
                          <li
                            key={e.id}
                            className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 desktop:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                          >
                            {media ? (
                              <span
                                aria-hidden
                                title={m.exercises.hasVideo}
                                className="flex size-11 items-center justify-center rounded-thumb bg-brand text-white"
                              >
                                <Play className="size-4" />
                              </span>
                            ) : (
                              <span
                                aria-hidden
                                className="flex size-11 items-center justify-center rounded-thumb bg-card-raised text-fg-muted"
                              >
                                <ActivityPicto kind={e.category} className="size-5" />
                              </span>
                            )}
                            <div className="min-w-0 leading-tight">
                              <p className="break-words font-semibold">{e.name}</p>
                              {media?.kind === "youtube" && media.title ? (
                                <p className="t-caption font-normal text-soft">{media.title}</p>
                              ) : null}
                              <p className="t-caption font-normal text-soft desktop:hidden">
                                {formatPrescription(e.defaultPrescription) || (e.cues[0] ?? "")}
                              </p>
                            </div>
                            <p className="t-num text-[17px] max-desktop:hidden">
                              {formatPrescription(e.defaultPrescription) || (
                                <span className="font-body text-[13px] font-normal text-soft">{e.cues[0] ?? ""}</span>
                              )}
                            </p>
                            <div className="flex">
                              <IconButton
                                label={`${m.common.edit} ${e.name}`}
                                onClick={() => setDialog({ exercise: e })}
                              >
                                <Pencil aria-hidden className="size-4" />
                              </IconButton>
                              <IconButton
                                label={`${m.common.delete} ${e.name}`}
                                onClick={() =>
                                  window.confirm(`Supprimer « ${e.name} » ? ${m.exercises.deleteNotice}`) &&
                                  remove.execute({ id: e.id })
                                }
                              >
                                <Trash2 aria-hidden className="size-4" />
                              </IconButton>
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
