"use client";

import { DateInput } from "@/components/ui/date-input";
import { createApiClient } from "@tartan/api-client";
import {
  saveTrainingPhaseInput,
  trainingPhaseKind,
  type SaveTrainingPhaseInput,
  type TrainingPhaseSummary,
  type TrainingPhaseContext,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhaseTimeline } from "./phase-timeline";

const api = createApiClient({ baseUrl: "" });
const t = m.trainingPhases;
function PhaseForm({
  initial,
  context,
  busy,
  error,
  onChange,
  onSave,
}: {
  initial: SaveTrainingPhaseInput;
  context: TrainingPhaseContext;
  busy: boolean;
  error: string;
  onChange: (value: SaveTrainingPhaseInput) => void;
  onSave: () => void;
}) {
  const [issues, setIssues] = useState<Record<string, string>>({});
  const summary = useRef<HTMLParagraphElement>(null);
  const field = <K extends keyof SaveTrainingPhaseInput>(key: K, value: SaveTrainingPhaseInput[K]) =>
    onChange({ ...initial, [key]: value });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = saveTrainingPhaseInput.safeParse(initial);
        if (!parsed.success) {
          setIssues(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
          requestAnimationFrame(() => summary.current?.focus());
          return;
        }
        setIssues({});
        onSave();
      }}
      className="flex flex-col gap-4"
    >
      {error || Object.keys(issues).length ? (
        <p ref={summary} tabIndex={-1} role="alert">
          {error || t.invalid}
        </p>
      ) : null}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <Field label={t.target} error={issues.target}>
          {(props) => (
            <Select
              {...props}
              value={`${initial.target.type}:${initial.target.id}`}
              onChange={(event) => {
                const [type, id] = event.target.value.split(":");
                field("target", { type: type === "athlete" ? "athlete" : "group", id: id ?? "" });
              }}
            >
              <option value="group:">{t.chooseTarget}</option>
              <optgroup label={t.group}>
                {context.groups.map((g) => (
                  <option key={g.id} value={`group:${g.id}`}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t.athlete}>
                {context.athletes.map((a) => (
                  <option key={a.id} value={`athlete:${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label={t.name} error={issues.name}>
          {(props) => (
            <Input
              {...props}
              value={initial.name}
              maxLength={100}
              onChange={(event) => field("name", event.target.value)}
            />
          )}
        </Field>
        <Field label={t.kind}>
          {(props) => (
            <Select
              {...props}
              value={initial.kind}
              onChange={(event) => field("kind", trainingPhaseKind.parse(event.target.value))}
            >
              {trainingPhaseKind.options.map((kind) => (
                <option key={kind} value={kind}>
                  {t.kinds[kind]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <Field label={t.start} error={issues.startDate}>
            {(props) => (
              <DateInput
                {...props}
                value={initial.startDate}
                onChange={(event) => field("startDate", event.target.value)}
              />
            )}
          </Field>
          <Field label={t.end} error={issues.endDate} hint={t.datesHint}>
            {(props) => (
              <DateInput
                {...props}
                value={initial.endDate}
                onChange={(event) => field("endDate", event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label={t.objective} error={issues.objective}>
          {(props) => (
            <Input
              {...props}
              value={initial.objective}
              maxLength={300}
              onChange={(event) => field("objective", event.target.value)}
            />
          )}
        </Field>
        <Field label={t.description} error={issues.description}>
          {(props) => (
            <Textarea
              {...props}
              value={initial.description}
              maxLength={4000}
              onChange={(event) => field("description", event.target.value)}
            />
          )}
        </Field>
        <Field label={t.privateNote} error={issues.privateNote} hint={t.privateHint}>
          {(props) => (
            <Textarea
              {...props}
              value={initial.privateNote}
              maxLength={4000}
              onChange={(event) => field("privateNote", event.target.value)}
            />
          )}
        </Field>
        <Button type="submit">{busy ? m.common.loading : m.common.save}</Button>
      </fieldset>
    </form>
  );
}

export function PhaseManager({
  organizationId,
  phases,
  context,
  from,
  to,
  today,
}: {
  organizationId: string;
  phases: TrainingPhaseSummary[];
  context: TrainingPhaseContext | null;
  from: string;
  to: string;
  today: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SaveTrainingPhaseInput | null>(null);
  const [initial, setInitial] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [discard, setDiscard] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    phase: TrainingPhaseSummary;
    action: "delete" | "visibility";
  } | null>(null);
  const open = (phase?: TrainingPhaseSummary) => {
    const next: SaveTrainingPhaseInput = phase
      ? {
          id: phase.id,
          expectedVersion: phase.version,
          target: phase.target,
          name: phase.name,
          kind: phase.kind,
          startDate: phase.startDate,
          endDate: phase.endDate,
          objective: phase.objective,
          description: phase.description,
          privateNote: phase.privateNote ?? "",
        }
      : {
          id: crypto.randomUUID(),
          expectedVersion: 0,
          target: { type: "group", id: "" },
          name: "",
          kind: "general",
          startDate: from,
          endDate: to,
          objective: "",
          description: "",
          privateNote: "",
        };
    setForm(next);
    setInitial(JSON.stringify(next));
    setShared(phase?.shared ?? false);
    setError("");
    setMessage("");
  };
  const perform = async (action: () => Promise<unknown>, success: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setForm(null);
      setMessage(success);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : m.common.genericError);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {context ? (
        <div>
          <Button disabled={busy} onClick={() => open()}>
            {t.add}
          </Button>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {error && !form ? <p role="alert">{error}</p> : null}
      <div className="on-card rounded-card bg-card p-4">
        <PhaseTimeline
          phases={phases}
          from={from}
          to={to}
          today={today}
          actions={
            context
              ? (phase) => (
                  <>
                    <Button variant="secondary" disabled={busy} onClick={() => open(phase)}>
                      {m.common.edit}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setConfirmation({ phase, action: "visibility" })}
                    >
                      {phase.shared ? t.unpublish : t.publish}
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() => setConfirmation({ phase, action: "delete" })}
                    >
                      {m.common.delete}
                    </Button>
                  </>
                )
              : undefined
          }
        />
      </div>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(value) => {
          if (value || busy) return;
          if (JSON.stringify(form) !== initial) setDiscard(true);
          else setForm(null);
        }}
        title={form?.expectedVersion ? t.edit : t.add}
        description={shared ? t.sharedEdit : t.defaultPrivate}
        wide
      >
        {form && context ? (
          <PhaseForm
            key={form.id}
            initial={form}
            context={context}
            busy={busy}
            error={error}
            onChange={setForm}
            onSave={() => void perform(() => api.saveTrainingPhase(organizationId, form), t.saved)}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title={m.common.close}
        description={t.discarded}
        confirmLabel={m.common.yes}
        onConfirm={() => setForm(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmation)}
        onOpenChange={(value) => {
          if (!value) setConfirmation(null);
        }}
        title={
          confirmation?.action === "delete" ? m.common.delete : confirmation?.phase.shared ? t.unpublish : t.publish
        }
        description={
          confirmation?.action === "delete"
            ? t.deleteConfirm
            : confirmation?.phase.shared
              ? t.unpublishConfirm
              : t.publishConfirm
        }
        tone={confirmation?.action === "delete" ? "danger" : "neutral"}
        confirmLabel={
          confirmation?.action === "delete" ? m.common.delete : confirmation?.phase.shared ? t.unpublish : t.publish
        }
        onConfirm={() => {
          if (!confirmation) return;
          const { phase, action } = confirmation;
          void perform(
            () =>
              action === "delete"
                ? api.deleteTrainingPhase(organizationId, phase.id, phase.version)
                : api.setTrainingPhaseVisibility(organizationId, phase.id, phase.version, !phase.shared),
            action === "delete" ? t.deleted : t.visibilitySaved,
          );
        }}
      />
    </div>
  );
}
