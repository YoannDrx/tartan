"use client";

import {
  legacyStrengthKey,
  legacyStrengthMappingInput,
  strengthMappingReportResponse,
  type ExerciseSummary,
  type StrengthMappingReport,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow, Field, Select, Textarea } from "@/components/ui/field";

const label = (key: string) =>
  legacyStrengthKey.safeParse(key).success ? m.strengthTest[key as keyof typeof m.strengthTest] : key;

const MappingRow = ({
  row,
  exercises,
  organizationId,
  onSaved,
}: {
  row: StrengthMappingReport["unmapped"][number];
  exercises: ExerciseSummary[];
  organizationId: string;
  onSaved: (report: StrengthMappingReport) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const exercise = exercises.find((item) => item.id === exerciseId);
  const eligible = legacyStrengthKey.safeParse(row.legacyKey).success;
  const reasonInvalid = reason.trim().length < 10 || reason.trim().length > 500;
  const input = legacyStrengthMappingInput.safeParse({
    legacyKey: row.legacyKey,
    exerciseId,
    reason,
    confirmed: checked,
  });
  const save = async () => {
    if (!input.success || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/orgs/${organizationId}/strength-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message ?? m.common.genericError);
      onSaved(strengthMappingReportResponse.parse(json));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : m.common.genericError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="on-card rounded-card bg-card p-4" aria-label={label(row.legacyKey)}>
      <h3 className="t-section break-words">{label(row.legacyKey)}</h3>
      <p className="t-caption mt-1">{m.strengthMapping.count(row.count)}</p>
      {!eligible ? (
        <p className="mt-3">{m.strengthMapping.unknown}</p>
      ) : !open ? (
        <Button className="mt-3" variant="secondary" disabled={!exercises.length} onClick={() => setOpen(true)}>
          {m.strengthMapping.choose}
        </Button>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setShowIssues(true);
            if (input.success) setConfirm(true);
          }}
        >
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <Field
              label={m.strengthMapping.exercise}
              error={showIssues && !exercise ? m.strengthMapping.invalid : undefined}
            >
              {(props) => (
                <Select
                  {...props}
                  value={exerciseId}
                  onChange={(event) => {
                    setExerciseId(event.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="">{m.strengthMapping.placeholder}</option>
                  {exercises.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ·{" "}
                      {item.strengthLoadKind
                        ? m.strength.conventions[item.strengthLoadKind]
                        : m.strength.unknownConvention}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {exercise ? (
              <div className="flex flex-col gap-2">
                <p>
                  {m.strength.convention} : {m.strength.conventions[exercise.strengthLoadKind!]}
                </p>
                <ul className="list-disc pl-5">
                  {exercise.cues.map((cue, index) => (
                    <li key={index}>{cue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Field
              label={m.strengthMapping.reason}
              hint={m.strengthMapping.reasonHint}
              error={showIssues && reasonInvalid ? m.strengthMapping.reasonError : undefined}
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Field>
            <CheckRow
              label={m.strengthMapping.check}
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            {showIssues && !checked ? <p role="alert">{m.strengthMapping.invalid}</p> : null}
            <Button type="submit">{busy ? m.common.loading : m.strengthMapping.confirm}</Button>
          </fieldset>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="neutral"
        title={m.strengthMapping.confirm}
        description={
          exercise
            ? m.strengthMapping.confirmDetail(
                label(row.legacyKey),
                exercise.name,
                m.strength.conventions[exercise.strengthLoadKind!],
                row.count,
              )
            : undefined
        }
        confirmLabel={m.strengthMapping.confirm}
        onConfirm={() => void save()}
      />
    </section>
  );
};

export const StrengthMappings = ({
  initialReport,
  exercises,
  organizationId,
}: {
  initialReport: StrengthMappingReport;
  exercises: ExerciseSummary[];
  organizationId: string;
}) => {
  const [report, setReport] = useState(initialReport);
  const [saved, setSaved] = useState(false);
  const compatible = exercises.filter(
    (exercise) => exercise.strengthLoadKind === "external_total" || exercise.strengthLoadKind === "added_weight",
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="on-card flex flex-col gap-3 rounded-card bg-card p-4">
        <p>{m.strengthMapping.lead}</p>
        <p>{m.strengthMapping.warning}</p>
        <p>{m.strengthMapping.referenceWarning}</p>
        <Link className="inline-flex min-h-11 w-fit items-center font-semibold" href="/athletes">
          {m.strengthMapping.athletes}
        </Link>
      </div>
      {saved ? <p role="status">{m.strengthMapping.saved}</p> : null}
      <h2 className="t-h2">{m.strengthMapping.pending}</h2>
      {!report.unmapped.length ? <p>{m.strengthMapping.empty}</p> : null}
      {!compatible.length && report.unmapped.length ? (
        <div>
          <p>{m.strength.noCompatibleExercise}</p>
          <Link className="inline-flex min-h-11 items-center font-semibold" href="/exercices">
            {m.strength.openLibrary}
          </Link>
        </div>
      ) : null}
      {report.unmapped.map((row) => (
        <MappingRow
          key={row.legacyKey}
          row={row}
          exercises={compatible}
          organizationId={organizationId}
          onSaved={(next) => {
            setReport(next);
            setSaved(true);
          }}
        />
      ))}
      <h2 className="t-h2">{m.strengthMapping.confirmed}</h2>
      {!report.mappings.length ? <p>{m.strengthMapping.noConfirmed}</p> : null}
      <ul className="flex flex-col gap-3">
        {report.mappings.map((mapping) => (
          <li className="on-card rounded-card bg-card p-4" key={mapping.legacyKey}>
            <p className="break-words font-semibold">
              {label(mapping.legacyKey)} → {mapping.exerciseName}
            </p>
            <p>
              {mapping.loadKind && mapping.loadKind in m.strength.conventions
                ? m.strength.conventions[mapping.loadKind as keyof typeof m.strength.conventions]
                : m.strength.unknownConvention}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words">{mapping.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
