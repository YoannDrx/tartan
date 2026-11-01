"use client";

import type { ExerciseMediaSnapshot, ExerciseSummary, Prescription } from "@tartan/contracts";
import { formatPrescription, parseYouTubeUrl, validateClipRange } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { CirclePlay, Pencil, Plus, Trash2, Video } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pillClass } from "@/components/filter-pill";
import { Chip, EmptyState, PageHeader } from "@/components/states";
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
      <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
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
      <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
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
          <p className="t-caption font-normal text-muted">{m.errors.videoDisabled}</p>
        )}
      </fieldset>
      {error ? (
        <p role="alert" className="text-brand-strong">
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
            <div className="w-full desktop:w-72">
              <Field label="Rechercher un exercice">
                {(a) => <Input {...a} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5 desktop:self-end">
              <button
                type="button"
                className={pillClass(category === null)}
                aria-pressed={category === null}
                onClick={() => setCategory(null)}
              >
                Tout
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
          <ul className="divide-y divide-border rounded-block border border-border bg-surface">
            {list.map((e) => {
              const media = e.media as ExerciseMediaSnapshot | null;
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-thumb bg-surface-sunk"
                  >
                    {media?.kind === "youtube" ? <CirclePlay className="size-5" /> : <Video className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.name}</p>
                    <p className="t-caption font-normal text-muted">
                      {formatPrescription(e.defaultPrescription) || (e.cues[0] ?? "")}
                    </p>
                    {media?.kind === "youtube" && media.title ? (
                      <p className="t-caption font-normal text-muted">{media.title}</p>
                    ) : null}
                  </div>
                  <Chip>{m.exerciseCategory[e.category as Category]}</Chip>
                  <IconButton label={`${m.common.edit} ${e.name}`} onClick={() => setDialog({ exercise: e })}>
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
                </li>
              );
            })}
            {list.length === 0 ? (
              <li className="p-4 text-muted">Aucun exercice ne correspond. Change le filtre ou crée-le.</li>
            ) : null}
          </ul>
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
