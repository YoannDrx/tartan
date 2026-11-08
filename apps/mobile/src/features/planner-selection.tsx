import { DateField } from "../ui/date-field";
import { plannerPeriod, plannerSelection, type PlannerSelection } from "@tartan/contracts";
import { addDays, phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useCallback, useState } from "react";
import { View } from "react-native";
import type { api } from "../lib/api";
import { Button, Divider, Field, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";
import { NativePhasePlanning } from "./phase-planning";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
const t = m.aiPlanner;
const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]);

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
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const accept = useCallback(
    (state: PhasePlanningReadiness) => {
      setReady(state.ready);
      onReady(date, state);
    },
    [date, onReady],
  );
  return (
    <View style={{ gap: space.sm }}>
      <Button
        variant="secondary"
        label={`${date} · ${ready ? t.phaseReady : t.phaseReview}`}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      />
      <View
        style={{ display: expanded ? "flex" : "none" }}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      >
        <NativePhasePlanning
          orgId={orgId}
          date={date}
          groupIds={selection.groupIds}
          athleteIds={selection.athleteIds}
          initialChoices={
            selection.phaseChoicesByDate?.find((day) => day.date === date)?.choices ?? selection.phaseChoices
          }
          onReady={accept}
        />
      </View>
    </View>
  );
}

export function NativePlannerSelection({
  orgId,
  context,
  initial,
  onContinue,
}: {
  orgId: string;
  context: Context;
  initial: PlannerSelection;
  onContinue: (selection: PlannerSelection) => void;
}) {
  const [selection, setSelection] = useState(initial);
  const [phases, setPhases] = useState<Record<string, PhasePlanningReadiness>>({});
  const [athleteSearch, setAthleteSearch] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(context.exercises.length > 500);
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
      dates.every((date) => {
        const value = phases[date];
        return value?.ready && value.key === phasePlanningKey(date, selection.groupIds, selection.athleteIds);
      }));
  const athletes = context.athletes.filter((a) =>
    `${a.firstName} ${a.lastName}`.toLocaleLowerCase("fr").includes(athleteSearch.trim().toLocaleLowerCase("fr")),
  );
  const exercises = context.exercises.filter((e) =>
    e.name.toLocaleLowerCase("fr").includes(exerciseSearch.trim().toLocaleLowerCase("fr")),
  );
  const proceed = () => {
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
    if (!selection.exerciseIds.length && context.exercises.length > 500) {
      setError(t.libraryLimit);
      return;
    }
    onContinue(parsed.data);
  };
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{t.period}</SectionTitle>
      <T>{t.periodHint}</T>
      <DateField
        label={m.trainingPhases.start}
        value={selection.period.from}
        onChangeText={(from) => update({ period: { ...selection.period, from } })}
      />
      <DateField
        label={m.trainingPhases.end}
        value={selection.period.to}
        onChangeText={(to) => update({ period: { ...selection.period, to } })}
      />
      {!dates.length ? (
        <T tone="danger" accessibilityLiveRegion="polite">
          {t.periodInvalid}
        </T>
      ) : null}
      <SectionTitle>{m.builder.audience}</SectionTitle>
      <T variant="smallStrong">{m.trainingPhases.group}</T>
      {context.groups.map((g) => (
        <Button
          key={g.id}
          variant="secondary"
          label={`${g.name} (${g.athleteCount})`}
          selected={selection.groupIds.includes(g.id)}
          onPress={() => update({ groupIds: toggle(selection.groupIds, g.id) })}
        />
      ))}
      <Field label={m.trainingPhases.searchTarget} value={athleteSearch} onChangeText={setAthleteSearch} />
      <T variant="smallStrong">{m.trainingPhases.athlete}</T>
      {athletes.slice(0, 50).map((a) => (
        <Button
          key={a.id}
          variant="secondary"
          label={`${a.firstName} ${a.lastName}`}
          selected={selection.athleteIds.includes(a.id)}
          onPress={() => update({ athleteIds: toggle(selection.athleteIds, a.id) })}
        />
      ))}
      {athletes.length > 50 ? <T tone="muted">{t.refineSearch}</T> : null}
      <Divider />
      <T>{t.allLibrary(context.exercises.length)}</T>
      <Button
        variant="secondary"
        label={t.librarySubset}
        expanded={libraryOpen}
        onPress={() => setLibraryOpen(!libraryOpen)}
      />
      {libraryOpen ? (
        <View style={{ gap: space.sm }}>
          <T>{t.librarySubsetHint}</T>
          <Field label={m.common.search} value={exerciseSearch} onChangeText={setExerciseSearch} />
          <T>{t.selectedExercises(selection.exerciseIds.length)}</T>
          {exercises.slice(0, 50).map((e) => (
            <Button
              key={e.id}
              variant="secondary"
              label={e.name}
              selected={selection.exerciseIds.includes(e.id)}
              disabled={!selection.exerciseIds.includes(e.id) && selection.exerciseIds.length >= 500}
              onPress={() => setSelection((old) => ({ ...old, exerciseIds: toggle(old.exerciseIds, e.id) }))}
            />
          ))}
          {exercises.length > 50 ? <T tone="muted">{t.refineSearch}</T> : null}
        </View>
      ) : null}
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
      {error ? (
        <T tone="danger" accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      <Button label={t.chooseContext} disabled={!ready} onPress={proceed} />
    </View>
  );
}
