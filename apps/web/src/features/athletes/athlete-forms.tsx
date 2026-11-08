"use client";

import { DateInput } from "@/components/ui/date-input";
import { m } from "@tartan/i18n";
import type { ExerciseSummary, PerformanceEntry } from "@tartan/contracts";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { todayIso } from "@/lib/dates";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createInvitationAction } from "@/features/invitations/invitation.action";
import {
  addNoteAction,
  addPerformanceAction,
  updatePerformanceAction,
  addTestAction,
  saveAthleteAction,
  saveInjuryAction,
  selectReferenceAction,
} from "./athlete.action";

type AnyErrors = Record<string, { _errors?: string[] }> | undefined;
const onErr = ({ error }: { error: { serverError?: string } }) => toast.error(error.serverError ?? m.errors.invalid);
const today = () => new Date().toISOString().slice(0, 10);

type AthleteValues = {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  level: string | null;
  takeoffFoot: "left" | "right" | null;
  approachSteps: number | null;
  goals: string | null;
  particularities: string | null;
  groupIds: string[];
};

export const AthleteDialog = ({
  trigger,
  initial,
  groups,
  title,
}: {
  trigger: ReactNode;
  initial?: AthleteValues;
  groups: { id: string; name: string }[];
  title: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<AthleteValues>(
    initial ?? {
      firstName: "",
      lastName: "",
      birthDate: null,
      level: null,
      takeoffFoot: null,
      approachSteps: null,
      goals: null,
      particularities: null,
      groupIds: [],
    },
  );
  const [missingBirth, setMissingBirth] = useState(false);
  const { execute, isPending, result } = useAction(saveAthleteAction, {
    onSuccess: ({ data }) => {
      setOpen(false);
      if (data && !data.stillVisible) {
        router.replace("/athletes");
      } else if (!initial && data) {
        router.push(`/athletes/${data.id}`);
      }
      router.refresh();
    },
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <Dialog open={open} onOpenChange={setOpen} title={title} trigger={trigger} wide>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMissingBirth(!v.birthDate);
          if (v.birthDate) execute({ ...v, disciplines: [] });
        }}
      >
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label={m.onboarding.firstName} error={errors?.firstName?._errors?.[0]}>
            {(a) => <Input {...a} value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />}
          </Field>
          <Field label={m.onboarding.lastName} error={errors?.lastName?._errors?.[0]}>
            {(a) => <Input {...a} value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />}
          </Field>
          <Field label={m.invite.birthDate} error={missingBirth ? m.age.athleteRequired : undefined}>
            {(a) => (
              <DateInput
                {...a}
                value={v.birthDate ?? ""}
                onChange={(e) => setV({ ...v, birthDate: e.target.value || null })}
              />
            )}
          </Field>
          <Field label="Niveau">
            {(a) => (
              <Input {...a} value={v.level ?? ""} onChange={(e) => setV({ ...v, level: e.target.value || null })} />
            )}
          </Field>
          <Field label={m.athletes.takeoffFoot}>
            {(a) => (
              <Select
                {...a}
                value={v.takeoffFoot ?? ""}
                onChange={(e) => setV({ ...v, takeoffFoot: (e.target.value || null) as AthleteValues["takeoffFoot"] })}
              >
                <option value="">Non renseigné</option>
                <option value="left">{m.bodySide.left}</option>
                <option value="right">{m.bodySide.right}</option>
              </Select>
            )}
          </Field>
          <Field label={m.athletes.approachSteps}>
            {(a) => (
              <Input
                {...a}
                type="number"
                min={1}
                value={v.approachSteps ?? ""}
                onChange={(e) => setV({ ...v, approachSteps: e.target.value ? Number(e.target.value) : null })}
              />
            )}
          </Field>
        </div>
        <Field label={m.athletes.goals} hint="Visible de l'athlète.">
          {(a) => (
            <Textarea {...a} value={v.goals ?? ""} onChange={(e) => setV({ ...v, goals: e.target.value || null })} />
          )}
        </Field>
        <Field label={m.athletes.particularities} hint="Visible de l'athlète.">
          {(a) => (
            <Textarea
              {...a}
              value={v.particularities ?? ""}
              onChange={(e) => setV({ ...v, particularities: e.target.value || null })}
            />
          )}
        </Field>
        {groups.length ? (
          <fieldset>
            <legend className="t-caption mb-1">{m.settings.groups}</legend>
            {groups.map((g) => (
              <CheckRow
                key={g.id}
                label={g.name}
                checked={v.groupIds.includes(g.id)}
                onChange={(e) =>
                  setV({
                    ...v,
                    groupIds: e.target.checked ? [...v.groupIds, g.id] : v.groupIds.filter((x) => x !== g.id),
                  })
                }
              />
            ))}
          </fieldset>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

export const SelectTestReference = ({
  athleteId,
  exerciseId,
  testId,
}: {
  athleteId: string;
  exerciseId: string;
  testId: string;
}) => {
  const router = useRouter();
  const action = useAction(selectReferenceAction, {
    onSuccess: () => {
      toast.ok(m.strength.referenceSaved);
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <Button
      size="sm"
      variant="quiet"
      disabled={action.isPending}
      onClick={() => action.execute({ athleteId, exerciseId, choice: { source: "test", testId } })}
    >
      {m.strength.selectExisting}
    </Button>
  );
};

export const WorkingReferenceDialog = ({
  athleteId,
  exercises,
}: {
  athleteId: string;
  exercises: ExerciseSummary[];
}) => {
  const router = useRouter();
  const compatible = exercises.filter(
    (e) => e.strengthLoadKind === "external_total" || e.strengthLoadKind === "added_weight",
  );
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState(compatible[0]?.id ?? "");
  const [value, setValue] = useState("");
  const action = useAction(selectReferenceAction, {
    onSuccess: () => {
      setOpen(false);
      toast.ok(m.strength.referenceSaved);
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={m.strength.workingReference}
      trigger={
        <Button size="sm" variant="secondary" disabled={!compatible.length}>
          {m.strength.workingReference}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          action.execute({ athleteId, exerciseId, choice: { source: "working", valueKg: Number(value) } });
        }}
      >
        <Field label={m.exerciseHistory.exercise}>
          {(a) => (
            <Select {...a} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {compatible.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={m.strength.valueKg}
          hint={
            compatible.find((e) => e.id === exerciseId)?.strengthLoadKind === "added_weight"
              ? m.strength.addedHint
              : m.strength.totalHint
          }
        >
          {(a) => (
            <Input
              {...a}
              type="number"
              inputMode="decimal"
              required
              min={0.01}
              max={1000}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={action.isPending || !exerciseId}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

export const TestDialog = ({
  athleteId,
  exercises,
  progressionEnabled,
}: {
  athleteId: string;
  exercises: ExerciseSummary[];
  progressionEnabled: boolean;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const compatible = exercises.filter(
    (e) => e.strengthLoadKind === "external_total" || e.strengthLoadKind === "added_weight",
  );
  const [selectAsReference, setSelectAsReference] = useState(false);
  const [v, setV] = useState({
    exerciseKey: progressionEnabled ? (compatible[0]?.id ?? "") : "back_squat",
    value: "",
    kind: "one_rm" as "one_rm" | "three_rm" | "estimated",
    date: today(),
  });
  const { execute, isPending } = useAction(addTestAction, {
    onSuccess: () => {
      setOpen(false);
      toast.ok(selectAsReference ? m.strength.referenceSaved : m.strength.saved);
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Ajouter un test de force"
      trigger={
        <Button size="sm" variant="secondary">
          {m.common.add}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({
            athleteId,
            ...(progressionEnabled
              ? { exerciseId: v.exerciseKey, exerciseKey: `exercise:${v.exerciseKey}`, selectAsReference }
              : { exerciseKey: v.exerciseKey }),
            value: Number(v.value),
            kind: v.kind,
            date: v.date,
          });
        }}
      >
        {progressionEnabled && compatible.length === 0 ? (
          <p>
            {m.strength.noCompatibleExercise}{" "}
            <Link className="underline" href="/exercices">
              {m.strength.openLibrary}
            </Link>
          </p>
        ) : null}
        <Field
          label={m.exerciseHistory.exercise}
          hint={
            progressionEnabled
              ? compatible.find((e) => e.id === v.exerciseKey)?.strengthLoadKind === "added_weight"
                ? m.strength.addedHint
                : m.strength.totalHint
              : undefined
          }
        >
          {(a) => (
            <Select {...a} value={v.exerciseKey} onChange={(e) => setV({ ...v, exerciseKey: e.target.value })}>
              {!progressionEnabled
                ? Object.entries(m.strengthTest).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))
                : compatible.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Charge (kg)">
            {(a) => (
              <Input
                {...a}
                type="number"
                step="0.01"
                min={0.01}
                max={1000}
                required
                value={v.value}
                onChange={(e) => setV({ ...v, value: e.target.value })}
              />
            )}
          </Field>
          <Field label="Type">
            {(a) => (
              <Select {...a} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as typeof v.kind })}>
                <option value="one_rm">{m.testKind.one_rm}</option>
                <option value="three_rm">{m.testKind.three_rm}</option>
                <option value="estimated">{m.testKind.estimated}</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label={m.builder.date}>
          {(a) => <DateInput {...a} required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}
        </Field>
        {progressionEnabled ? (
          <CheckRow
            label={m.strength.selectReference}
            checked={selectAsReference}
            onChange={(e) => setSelectAsReference(e.target.checked)}
          />
        ) : null}
        <Button type="submit" disabled={isPending || !v.exerciseKey}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

export const PerformanceDialog = ({ athleteId, initial }: { athleteId: string; initial?: PerformanceEntry }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [v, setV] = useState({
    discipline: initial?.discipline ?? "",
    mark: initial ? String(initial.mark) : "",
    unit: (initial ? (["m", "cm", "s"].includes(initial.unit) ? initial.unit : "") : "m") as "m" | "cm" | "s" | "",
    date: initial?.date ?? todayIso(),
    location: initial?.location ?? "",
    comparisonContext: initial?.comparisonContext ?? "",
    wind: initial?.wind == null ? "" : String(initial.wind),
  });
  const options = {
    onSuccess: () => {
      setOpen(false);
      setClientId(crypto.randomUUID());
      router.refresh();
    },
    onError: ({ error }: { error: { serverError?: string } }) =>
      setFormError(error.serverError ?? m.performances.invalid),
  };
  const create = useAction(addPerformanceAction, options);
  const update = useAction(updatePerformanceAction, options);
  const busy = create.isPending || update.isPending;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={initial ? m.performances.edit : m.performances.add}
      trigger={
        initial ? (
          <IconButton label={`${m.performances.edit} : ${initial.discipline}, ${initial.mark} ${initial.unit}`}>
            <Pencil aria-hidden className="size-4" />
          </IconButton>
        ) : (
          <Button size="sm" variant="secondary">
            {m.common.add}
          </Button>
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFormError("");
          if (!v.unit) {
            setFormError(m.performances.unknown);
            return;
          }
          const body = {
            athleteId,
            discipline: v.discipline,
            mark: Number(v.mark.replace(",", ".")),
            unit: v.unit,
            measurementType: v.unit === "s" ? ("time" as const) : ("distance" as const),
            recordDirection: v.unit === "s" ? ("lower" as const) : ("higher" as const),
            date: v.date,
            location: v.location || null,
            comparisonContext: v.comparisonContext,
            wind: v.wind.trim() ? Number(v.wind.replace(",", ".")) : null,
            competitionId: initial?.competitionId ?? null,
          };
          if (initial && initial.version) update.execute({ ...body, id: initial.id, expectedVersion: initial.version });
          else create.execute({ ...body, clientId });
        }}
      >
        {formError ? (
          <p ref={errorRef} role="alert" tabIndex={-1}>
            {formError}
          </p>
        ) : null}
        <Field label={m.performances.discipline}>
          {(a) => (
            <Input
              {...a}
              required
              maxLength={40}
              value={v.discipline}
              onChange={(e) => setV({ ...v, discipline: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.performances.measurement}>
          {(a) => (
            <Select
              {...a}
              value={v.unit === "s" ? "time" : v.unit ? "distance" : ""}
              onChange={(e) => setV({ ...v, unit: e.target.value === "time" ? "s" : "m" })}
            >
              {!v.unit ? (
                <option value="" disabled>
                  {m.performances.unknown}
                </option>
              ) : null}
              <option value="distance">{m.performances.distance}</option>
              <option value="time">{m.performances.time}</option>
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.performances.mark}>
            {(a) => (
              <Input
                {...a}
                type="number"
                step="0.001"
                min="0.001"
                max="100000"
                required
                value={v.mark}
                onChange={(e) => setV({ ...v, mark: e.target.value })}
              />
            )}
          </Field>
          <Field label={m.performances.unit}>
            {(a) => (
              <Select {...a} value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value as typeof v.unit })}>
                {!v.unit ? (
                  <option value="" disabled>
                    {m.performances.unknown}
                  </option>
                ) : null}
                {v.unit === "s" ? (
                  <option value="s">s</option>
                ) : (
                  <>
                    <option value="m">m</option>
                    <option value="cm">cm</option>
                  </>
                )}
              </Select>
            )}
          </Field>
        </div>
        <Field label={m.performances.context}>
          {(a) => (
            <Input
              {...a}
              maxLength={80}
              value={v.comparisonContext}
              onChange={(e) => setV({ ...v, comparisonContext: e.target.value })}
            />
          )}
        </Field>
        <p className="t-caption text-soft">{m.performances.contextHint}</p>
        <Field label={m.performances.wind}>
          {(a) => (
            <Input
              {...a}
              type="number"
              min="-20"
              max="20"
              step="0.1"
              value={v.wind}
              onChange={(e) => setV({ ...v, wind: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.builder.date}>
          {(a) => <DateInput {...a} required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}
        </Field>
        <Field label={m.builder.location}>
          {(a) => (
            <Input
              {...a}
              maxLength={120}
              value={v.location}
              onChange={(e) => setV({ ...v, location: e.target.value })}
            />
          )}
        </Field>
        <Button type="submit" disabled={busy || !v.unit || Boolean(initial && !initial.version)}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

type InjuryValues = {
  id?: string;
  bodyArea: keyof typeof m.bodyArea;
  side: keyof typeof m.bodySide;
  description: string;
  startDate: string;
  endDate: string;
  status: keyof typeof m.injuryStatus;
  restrictions: string;
};

export const InjuryDialog = ({
  athleteId,
  initial,
  trigger,
}: {
  athleteId: string;
  initial?: InjuryValues;
  trigger: ReactNode;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<InjuryValues>(
    initial ?? {
      bodyArea: "knee",
      side: "left",
      description: "",
      startDate: today(),
      endDate: "",
      status: "active",
      restrictions: "",
    },
  );
  const { execute, isPending } = useAction(saveInjuryAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={initial ? "Modifier la blessure" : "Ouvrir une fiche blessure"}
      trigger={trigger}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({
            ...v,
            athleteId,
            description: v.description || null,
            endDate: v.endDate || null,
            restrictions: v.restrictions || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.validation.painArea}>
            {(a) => (
              <Select
                {...a}
                value={v.bodyArea}
                onChange={(e) => setV({ ...v, bodyArea: e.target.value as InjuryValues["bodyArea"] })}
              >
                {(Object.keys(m.bodyArea) as InjuryValues["bodyArea"][]).map((k) => (
                  <option key={k} value={k}>
                    {m.bodyArea[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={m.validation.painSide}>
            {(a) => (
              <Select
                {...a}
                value={v.side}
                onChange={(e) => setV({ ...v, side: e.target.value as InjuryValues["side"] })}
              >
                {(Object.keys(m.bodySide) as InjuryValues["side"][]).map((k) => (
                  <option key={k} value={k}>
                    {m.bodySide[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Début">
            {(a) => (
              <DateInput
                {...a}
                required
                value={v.startDate}
                onChange={(e) => setV({ ...v, startDate: e.target.value })}
              />
            )}
          </Field>
          <Field label="Fin">
            {(a) => <DateInput {...a} value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />}
          </Field>
        </div>
        <Field label="Statut">
          {(a) => (
            <Select
              {...a}
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as InjuryValues["status"] })}
            >
              {(Object.keys(m.injuryStatus) as InjuryValues["status"][]).map((k) => (
                <option key={k} value={k}>
                  {m.injuryStatus[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Restrictions">
          {(a) => (
            <Textarea {...a} value={v.restrictions} onChange={(e) => setV({ ...v, restrictions: e.target.value })} />
          )}
        </Field>
        <Field label="Description">
          {(a) => (
            <Textarea {...a} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          )}
        </Field>
        <Button type="submit" disabled={isPending}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

export const NoteForm = ({ athleteId }: { athleteId: string }) => {
  const router = useRouter();
  const [body, setBody] = useState("");
  const { execute, isPending } = useAction(addNoteAction, {
    onSuccess: () => {
      setBody("");
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) execute({ athleteId, body });
      }}
    >
      <Field label="Nouvelle note" hint={m.athletes.notesHint}>
        {(a) => <Textarea {...a} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={isPending || !body.trim()}>
        {m.common.add}
      </Button>
    </form>
  );
};

export const InviteAthleteDialog = ({ athleteId, groupIds }: { athleteId: string; groupIds: string[] }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const { execute, isPending, result } = useAction(createInvitationAction, {
    onSuccess: ({ data }) => setLink(data?.link ?? null),
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Inviter cet athlète"
      description="L'invitation rattache son compte à cette fiche."
      trigger={<Button size="sm">{m.athletes.invite}</Button>}
    >
      {link ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="font-semibold">
            Invitation envoyée. Valable 7 jours, à usage unique.
          </p>
          <Input readOnly value={link} aria-label="Lien d'invitation" onFocus={(e) => e.target.select()} />
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            execute({ kind: "personal_email", email, groupIds, athleteId });
          }}
        >
          <Field label={m.auth.emailLabel} error={errors?.email?._errors?.[0]}>
            {(a) => <Input {...a} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={isPending}>
            {m.common.send}
          </Button>
        </form>
      )}
    </Dialog>
  );
};
