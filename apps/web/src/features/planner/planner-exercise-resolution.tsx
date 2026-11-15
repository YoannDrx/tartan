"use client";

import { useRef, useState } from "react";
import { exerciseCategory, resolvePlannerExerciseInput, type ResolvePlannerExerciseInput } from "@tartan/contracts";
import { normalizeExerciseTerm, rankPlannerCandidates } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import type { PlannerContext } from "./planner-selection";

const t = m.aiPlanner;
export function PlannerExerciseResolution({
  questionId,
  requestedName,
  version,
  exercises,
  disabled,
  allowCreate = true,
  resolved,
  onResolve,
}: {
  questionId: string;
  requestedName: string | null | undefined;
  version: number;
  exercises: PlannerContext["exercises"];
  disabled: boolean;
  allowCreate?: boolean;
  resolved?: string;
  onResolve: (input: ResolvePlannerExerciseInput) => Promise<void>;
}) {
  const [name, setName] = useState(requestedName ?? "");
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const [category, setCategory] = useState<(typeof exerciseCategory.options)[number]>("strength");
  const [cues, setCues] = useState("");
  const [loadKind, setLoadKind] = useState<"external_total" | "added_weight" | "assistance" | "bodyweight">(
    "bodyweight",
  );
  const [reviewed, setReviewed] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = useRef<ResolvePlannerExerciseInput | null>(null);
  // Recherche libre dans toute la bibliothèque ; sans recherche, les fiches proches du nom demandé.
  const term = normalizeExerciseTerm(search);
  const candidates = term
    ? exercises
        .filter((exercise) =>
          [exercise.name, ...(exercise.aliases ?? [])].some((label) => normalizeExerciseTerm(label).includes(term)),
        )
        .slice(0, 8)
    : rankPlannerCandidates(exercises, name, 5);
  const submit = async (choice: ResolvePlannerExerciseInput["choice"]) => {
    if (!pending.current) {
      const parsed = resolvePlannerExerciseInput.safeParse({
        operationId: crypto.randomUUID(),
        expectedVersion: version,
        questionId,
        requestedName: name,
        choice,
      });
      if (!parsed.success) return;
      pending.current = parsed.data;
      setSent(true);
    }
    await onResolve(pending.current);
  };
  if (resolved)
    return (
      <p role="status" className="text-soft">
        {t.exerciseResolved(resolved)}
      </p>
    );
  return (
    <div className="flex min-w-0 flex-col gap-3 border-l-2 border-card-line pl-3">
      <p className="text-soft">{t.resolveExerciseHelp}</p>
      <Field label={t.requestedMovement}>
        {(a) => (
          <Input
            {...a}
            value={name}
            maxLength={120}
            disabled={disabled || sent || Boolean(requestedName)}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      {!create ? (
        <>
          <Field label={t.searchLibrary}>
            {(a) => (
              <Input
                {...a}
                type="search"
                value={search}
                disabled={disabled || sent}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </Field>
          <p className="font-semibold">{t.possibleExercises}</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((exercise) => (
              <Button
                type="button"
                variant="secondary"
                key={exercise.id}
                disabled={disabled || sent || !name.trim()}
                onClick={() => void submit({ kind: "existing", exerciseId: exercise.id })}
              >
                {exercise.name}
              </Button>
            ))}
          </div>
          {allowCreate ? (
            <Button type="button" variant="secondary" disabled={disabled || sent} onClick={() => setCreate(true)}>
              {t.createPrivateExercise}
            </Button>
          ) : null}
          <p className="text-soft">{t.rephraseExercise}</p>
        </>
      ) : (
        <>
          <p className="font-semibold">{t.privateExerciseReview}</p>
          <Field label={m.exercises.category}>
            {(a) => (
              <Select
                {...a}
                value={category}
                disabled={disabled || sent}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                {exerciseCategory.options.map((value) => (
                  <option value={value} key={value}>
                    {m.exerciseCategory[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.movementCues}>
            {(a) => (
              <Textarea {...a} value={cues} disabled={disabled || sent} onChange={(e) => setCues(e.target.value)} />
            )}
          </Field>
          <Field label={t.movementLoadConvention}>
            {(a) => (
              <Select
                {...a}
                value={loadKind}
                disabled={disabled || sent}
                onChange={(e) => setLoadKind(e.target.value as typeof loadKind)}
              >
                {(["external_total", "added_weight", "assistance", "bodyweight"] as const).map((value) => (
                  <option key={value} value={value}>
                    {t.movementLoadKinds[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <CheckRow
            label={t.privateExerciseReviewed}
            checked={reviewed}
            disabled={disabled || sent}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          <Button
            type="button"
            disabled={
              disabled ||
              sent ||
              !reviewed ||
              !name.trim() ||
              cues.split("\n").filter(Boolean).length > 5 ||
              cues.split("\n").some((line) => line.length > 120)
            }
            onClick={() =>
              void submit({
                kind: "create",
                reviewed: true,
                exercise: {
                  name,
                  category,
                  cues: cues
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  tags: [],
                  defaultPrescription: {},
                  aliases: [],
                  strengthLoadKind: loadKind,
                },
              })
            }
          >
            {t.savePrivateExercise}
          </Button>
          <Button type="button" variant="secondary" disabled={disabled || sent} onClick={() => setCreate(false)}>
            {m.common.cancel}
          </Button>
        </>
      )}
      {sent ? (
        <>
          <p>{t.immutableRequest}</p>
          <Button type="button" disabled={disabled} onClick={() => pending.current && void onResolve(pending.current)}>
            {t.retryExerciseResolution}
          </Button>
        </>
      ) : null}
    </div>
  );
}
