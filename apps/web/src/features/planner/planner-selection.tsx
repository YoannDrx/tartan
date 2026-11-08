"use client";

import { DateInput } from "@/components/ui/date-input";
import { plannerPeriod, plannerSelection, type PlannerSelection } from "@tartan/contracts";
import { addDays, phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { m, historyDate } from "@tartan/i18n";
import { useCallback, useState } from "react";
import type { getSessionBuilderContext } from "@/server/session-builder.service";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { PhasePlanningPanel } from "@/features/phases/phase-planning";

export type PlannerContext = Awaited<ReturnType<typeof getSessionBuilderContext>>;
const t = m.aiPlanner;
const toggle = (values: string[], id: string) =>
  values.includes(id) ? values.filter((v) => v !== id) : [...values, id];

function DayPhase({
  date,
  selection,
  orgId,
  onReady,
}: {
  date: string;
  selection: PlannerSelection;
  orgId: string;
  onReady: (date: string, state: PhasePlanningReadiness) => void;
}) {
  const [ready, setReady] = useState(false);
  const accept = useCallback(
    (state: PhasePlanningReadiness) => {
      setReady(state.ready);
      onReady(date, state);
    },
    [date, onReady],
  );
  return (
    <details className="rounded-card border border-card-line p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        {historyDate(date)} · {ready ? t.phaseReady : t.phaseReview}
      </summary>
      <PhasePlanningPanel
        organizationId={orgId}
        date={date}
        groupIds={selection.groupIds}
        athleteIds={selection.athleteIds}
        initialChoices={selection.phaseChoicesByDate?.find((d) => d.date === date)?.choices ?? selection.phaseChoices}
        onReady={accept}
      />
    </details>
  );
}

export function PlannerSelectionForm({
  orgId,
  context,
  initial,
  onContinue,
}: {
  orgId: string;
  context: PlannerContext;
  initial: PlannerSelection;
  onContinue: (selection: PlannerSelection) => void;
}) {
  const [selection, setSelection] = useState(initial);
  const [phases, setPhases] = useState<Record<string, PhasePlanningReadiness>>({});
  const [athleteSearch, setAthleteSearch] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [error, setError] = useState("");
  const dates: string[] = [];
  if (plannerPeriod.safeParse(selection.period).success)
    for (let date = selection.period.from; date <= selection.period.to; date = addDays(date, 1)) dates.push(date);
  const acceptPhase = useCallback((date: string, state: PhasePlanningReadiness) => {
    setPhases((old) => (JSON.stringify(old[date]) === JSON.stringify(state) ? old : { ...old, [date]: state }));
  }, []);
  const update = (patch: Partial<PlannerSelection>) => {
    setSelection((old) => ({ ...old, ...patch, phaseChoices: [], phaseChoicesByDate: [] }));
    setPhases({});
    setError("");
  };
  const audienceKey = `${selection.period.from}:${selection.period.to}:${selection.groupIds.join(",")}:${selection.athleteIds.join(",")}`;
  const hasAudience = selection.groupIds.length + selection.athleteIds.length > 0;
  const ready =
    dates.length > 0 &&
    hasAudience &&
    (!context.phasesEnabled ||
      dates.every(
        (date) =>
          phases[date]?.ready && phases[date]?.key === phasePlanningKey(date, selection.groupIds, selection.athleteIds),
      ));
  const athletes = context.athletes.filter((a) =>
    `${a.firstName} ${a.lastName}`.toLocaleLowerCase("fr").includes(athleteSearch.trim().toLocaleLowerCase("fr")),
  );
  const exercises = context.exercises.filter((e) =>
    e.name.toLocaleLowerCase("fr").includes(exerciseSearch.trim().toLocaleLowerCase("fr")),
  );
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = plannerSelection.safeParse({
          ...selection,
          phaseChoices: [],
          phaseChoicesByDate: context.phasesEnabled
            ? dates.map((date) => ({ date, choices: phases[date]?.review?.choices ?? [] }))
            : [],
        });
        if (!ready || !parsed.success) {
          setError(t.periodInvalid);
          return;
        }
        if (!context.exercises.length || (!selection.exerciseIds.length && context.exercises.length > 500)) {
          setError(t.libraryLimit);
          return;
        }
        onContinue(parsed.data);
      }}
    >
      <fieldset className="grid min-w-0 gap-3 tablet:grid-cols-2">
        <legend className="t-section mb-2">{t.period}</legend>
        <p className="text-soft tablet:col-span-2">{t.periodHint}</p>
        <Field label={m.trainingPhases.start}>
          {(a) => (
            <DateInput
              {...a}
              required
              value={selection.period.from}
              onChange={(e) => update({ period: { ...selection.period, from: e.target.value } })}
            />
          )}
        </Field>
        <Field label={m.trainingPhases.end}>
          {(a) => (
            <DateInput
              {...a}
              required
              value={selection.period.to}
              onChange={(e) => update({ period: { ...selection.period, to: e.target.value } })}
            />
          )}
        </Field>
      </fieldset>
      {!dates.length ? <p role="status">{t.periodInvalid}</p> : null}
      <fieldset className="min-w-0">
        <legend className="t-section">{m.trainingPhases.group}</legend>
        <div className="grid gap-x-4 tablet:grid-cols-2">
          {context.groups.map((g) => (
            <CheckRow
              key={g.id}
              label={`${g.name} (${g.athleteCount})`}
              checked={selection.groupIds.includes(g.id)}
              onChange={() => update({ groupIds: toggle(selection.groupIds, g.id) })}
            />
          ))}
        </div>
      </fieldset>
      <details className="rounded-card border border-card-line p-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">
          {m.trainingPhases.athlete} · {selection.athleteIds.length}
        </summary>
        <Field label={m.trainingPhases.searchTarget}>
          {(a) => (
            <Input {...a} type="search" value={athleteSearch} onChange={(e) => setAthleteSearch(e.target.value)} />
          )}
        </Field>
        <div className="grid gap-x-4 tablet:grid-cols-2">
          {athletes.slice(0, 50).map((a) => (
            <CheckRow
              key={a.id}
              label={`${a.firstName} ${a.lastName}`}
              checked={selection.athleteIds.includes(a.id)}
              onChange={() => update({ athleteIds: toggle(selection.athleteIds, a.id) })}
            />
          ))}
        </div>
        {athletes.length > 50 ? <p className="text-soft">{t.refineSearch}</p> : null}
      </details>
      <p>{t.allLibrary(context.exercises.length)}</p>
      <details
        open={context.exercises.length > 500 ? true : undefined}
        className="rounded-card border border-card-line p-3"
      >
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t.librarySubset}</summary>
        <p className="text-soft">{t.librarySubsetHint}</p>
        <Field label={m.common.search}>
          {(a) => (
            <Input {...a} type="search" value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} />
          )}
        </Field>
        <p role="status">{t.selectedExercises(selection.exerciseIds.length)}</p>
        <div className="grid gap-x-4 tablet:grid-cols-2">
          {exercises.slice(0, 50).map((e) => (
            <CheckRow
              key={e.id}
              label={e.name}
              checked={selection.exerciseIds.includes(e.id)}
              disabled={!selection.exerciseIds.includes(e.id) && selection.exerciseIds.length >= 500}
              onChange={() => setSelection((old) => ({ ...old, exerciseIds: toggle(old.exerciseIds, e.id) }))}
            />
          ))}
        </div>
        {exercises.length > 50 ? <p className="text-soft">{t.refineSearch}</p> : null}
      </details>
      {context.phasesEnabled && hasAudience
        ? dates.map((date) => (
            <DayPhase
              key={`${audienceKey}:${date}`}
              date={date}
              orgId={orgId}
              selection={selection}
              onReady={acceptPhase}
            />
          ))
        : null}
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" disabled={!ready}>
        {t.chooseContext}
      </Button>
    </form>
  );
}
