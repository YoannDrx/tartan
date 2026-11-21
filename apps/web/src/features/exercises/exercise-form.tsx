"use client";

import {
  exerciseEquipment,
  exerciseMovement,
  type ExerciseClassification,
  type ExerciseMediaSnapshot,
  type ExerciseSummary,
  type Prescription,
} from "@tartan/contracts";
import { instagramUrl, parseInstagramUrl, parseYouTubeUrl, validateClipRange } from "@tartan/domain";
import { m, exerciseClassificationLabel } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { exerciseUploadAction, saveExerciseAction } from "./exercise.action";

type Category = keyof typeof m.exerciseCategory;
const g = w.exercises.guideEdit;

const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));
const linesOf = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

// Le guide de la copie, tel que le coach le lit et l'écrit : la version concise s'il n'y a encore touché.
const guideFields = (exercise: ExerciseSummary | null) => {
  const guide = exercise && !exercise.shared ? exercise.guide : null;
  if (!guide) return null;
  const shown = guide.concise ?? {
    objective: guide.objective,
    setup: guide.setup.join(" "),
    steps: guide.steps,
    mistakes: guide.mistakes,
  };
  return {
    objective: shown.objective,
    setup: shown.setup,
    steps: shown.steps.join("\n"),
    mistakes: shown.mistakes.join("\n"),
  };
};

/** Créer ou modifier une fiche de l'espace ; `listId` la range aussitôt dans une liste du coach. */
export const ExerciseForm = ({
  exercise,
  onDone,
  videoEnabled,
  listId,
}: {
  exercise: ExerciseSummary | null;
  onDone: (id?: string) => void;
  videoEnabled: boolean;
  listId?: string;
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
  const [initialGuide] = useState(() => guideFields(exercise));
  const [guide, setGuide] = useState(initialGuide);
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
          return onDone(data.id);
        }
        const { createUpload } = await import("@mux/upchunk");
        const sending = createUpload({ endpoint: res.data.uploadUrl, file, chunkSize: 5120 });
        setProgress(0);
        sending.on("progress", (ev) => setProgress(Math.round(ev.detail)));
        sending.on("error", () => {
          setProgress(null);
          setError(m.exercises.uploadFailed);
        });
        sending.on("success", () => {
          setProgress(null);
          toast.ok(m.video.processing);
          onDone(data.id);
        });
        return;
      }
      onDone(data?.id);
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
        const aliasList = linesOf(aliases);
        if (aliasList.length > 20 || aliasList.some((v) => v.length > 120)) return setError(m.exercises.aliasesInvalid);
        // Le guide ne part que s'il a changé : une copie relue reste le texte de Tartan.
        const changed = guide && JSON.stringify(guide) !== JSON.stringify(initialGuide);
        const guideEdit = changed
          ? {
              objective: guide.objective.trim(),
              setup: guide.setup.trim(),
              steps: linesOf(guide.steps),
              mistakes: linesOf(guide.mistakes),
            }
          : undefined;
        if (
          guideEdit &&
          (!guideEdit.objective ||
            !guideEdit.setup ||
            guideEdit.steps.length < 2 ||
            guideEdit.steps.length > 6 ||
            guideEdit.mistakes.length < 1)
        )
          return setError(g.invalid);
        save.execute({
          id: exercise?.id,
          name,
          aliases: aliasList,
          category,
          classification,
          cues: linesOf(cues),
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
          ...(guideEdit ? { guideEdit } : {}),
          ...(listId ? { listId } : {}),
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
      <Field label={m.exercises.cues} hint={m.exercises.cuesLinesHint}>
        {(a) => <Textarea {...a} value={cues} onChange={(e) => setCues(e.target.value)} />}
      </Field>
      {guide ? (
        <fieldset className="flex flex-col gap-3 border-t border-card-line pt-4">
          <legend className="t-section pr-2">{g.title}</legend>
          <p className="t-caption font-normal text-soft">{g.hint}</p>
          <Field label={g.objective}>
            {(a) => (
              <Input
                {...a}
                value={guide.objective}
                onChange={(e) => setGuide({ ...guide, objective: e.target.value })}
              />
            )}
          </Field>
          <Field label={g.setup}>
            {(a) => (
              <Input {...a} value={guide.setup} onChange={(e) => setGuide({ ...guide, setup: e.target.value })} />
            )}
          </Field>
          <Field label={g.steps} hint={g.stepsHint}>
            {(a) => (
              <Textarea
                {...a}
                rows={4}
                value={guide.steps}
                onChange={(e) => setGuide({ ...guide, steps: e.target.value })}
              />
            )}
          </Field>
          <Field label={g.mistakes}>
            {(a) => (
              <Textarea
                {...a}
                value={guide.mistakes}
                onChange={(e) => setGuide({ ...guide, mistakes: e.target.value })}
              />
            )}
          </Field>
        </fieldset>
      ) : null}
      <Field label={m.exercises.tags} hint={m.exercises.tagsHint}>
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
        <legend className="t-section pr-2">{m.exercises.videoTitle}</legend>
        <Field label={m.exercises.videoUrl}>
          {(a) => (
            <Input
              {...a}
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={m.exercises.urlPlaceholder}
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
        <progress value={progress} max={100} className="w-full accent-brand" aria-label={m.exercises.uploadProgress} />
      ) : null}
      <Button type="submit" disabled={save.isPending || progress !== null}>
        {m.common.save}
      </Button>
    </form>
  );
};
