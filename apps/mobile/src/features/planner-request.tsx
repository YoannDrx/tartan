import { clockTime, trainingEquipment } from "@tartan/contracts";
import { type PhasePlanningReadiness } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, type TextInput, View } from "react-native";
import type { api } from "../lib/api";
import {
  PLANNER_DURATIONS,
  PLANNER_LEVELS,
  PLANNER_TEXT_LIMIT,
  plannerAsksPhases,
  plannerPrecisions,
  type PlannerEquipment,
  type PlannerRequestValue,
} from "../lib/planner-flow";
import { DateField } from "../ui/date-field";
import { Mic, X } from "../ui/icons";
import { Button, Field, IconButton, SectionTitle, T } from "../ui/primitives";
import { radius, space, TOUCH, usePalette } from "../ui/theme";
import { NativePhasePlanning } from "./phase-planning";
import { usePlannerDictation } from "./planner-dictation";
import { Fold, Pill, PillRow } from "./planner-ui";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
const t = m.aiPlanner.screen;
const toggle = <V extends string>(values: V[], id: V) =>
  values.includes(id) ? values.filter((v) => v !== id) : [...values, id];

/**
 * La demande, en un écran : pour qui, quand, puis un seul champ, le micro dedans. Le coach y décrit sa séance, donne
 * un objectif ou mêle les deux ; le planificateur comprend seul. Heure, durée, niveau et matériel sont des
 * précisions repliées, jamais requises. L'action d'envoi est en bas de l'écran, à portée de pouce.
 */
export function NativePlannerRequest({
  orgId,
  context,
  spaceEquipment,
  value,
  onChange,
  disabled,
  phase,
  onPhase,
  onDictationBusy,
}: {
  orgId: string;
  context: Context;
  spaceEquipment: PlannerEquipment[];
  value: PlannerRequestValue;
  onChange: (update: (value: PlannerRequestValue) => PlannerRequestValue) => void;
  disabled: boolean;
  /** La phase du jour telle que la dernière lecture l'a rendue. */
  phase: PhasePlanningReadiness | null;
  onPhase: (state: PhasePlanningReadiness) => void;
  onDictationBusy: (busy: boolean) => void;
}) {
  const p = usePalette();
  const field = useRef<TextInput>(null);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athletesOpen, setAthletesOpen] = useState(false);
  const set = (patch: Partial<PlannerRequestValue>) => onChange((old) => ({ ...old, ...patch }));
  // La dictée s'ajoute à ce qui est déjà écrit : le coach relit et corrige avant d'envoyer.
  const dictation = usePlannerDictation(
    orgId,
    useCallback(
      (text: string) =>
        onChange((old) => ({ ...old, text: old.text.trim() ? `${old.text.trimEnd()}\n${text}` : text })),
      [onChange],
    ),
  );
  useEffect(() => onDictationBusy(dictation.busy), [dictation.busy, onDictationBusy]);
  useEffect(() => () => onDictationBusy(false), [onDictationBusy]);
  const hasRecipients = context.groups.length + context.athletes.length > 0;
  const tooLong = value.text.length > PLANNER_TEXT_LIMIT;
  const timeInvalid = Boolean(value.startTime) && !clockTime.safeParse(value.startTime).success;
  const chosen = plannerPrecisions(value, spaceEquipment);
  const summary = [
    ...(chosen.startTime ? [chosen.startTime] : []),
    ...(chosen.durationMin ? [t.durationValue(chosen.durationMin)] : []),
    ...(chosen.level ? [m.aiPlanner.proposalLevels[chosen.level]] : []),
    ...(chosen.equipmentChanged ? [t.equipmentChanged] : []),
  ].join(" · ");
  const athletes = context.athletes.filter((a) =>
    `${a.firstName} ${a.lastName}`.toLocaleLowerCase("fr").includes(athleteSearch.trim().toLocaleLowerCase("fr")),
  );
  const frozen = disabled || dictation.busy;

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.who}</SectionTitle>
        <T variant="small" tone="muted">
          {t.whoHint}
        </T>
        {!hasRecipients ? <T accessibilityLiveRegion="polite">{t.noRecipients}</T> : null}
        {context.groups.length ? (
          <PillRow>
            {context.groups.map((group) => (
              <Pill
                key={group.id}
                testID={`planner-group-${group.id}`}
                label={group.name}
                pressed={value.groupIds.includes(group.id)}
                disabled={frozen}
                onPress={() => set({ groupIds: toggle(value.groupIds, group.id) })}
              />
            ))}
          </PillRow>
        ) : null}
        {context.athletes.length ? (
          <>
            <Button
              compact
              variant="secondary"
              label={t.athletes(value.athleteIds.length)}
              expanded={athletesOpen}
              disabled={frozen}
              onPress={() => setAthletesOpen(!athletesOpen)}
            />
            {athletesOpen ? (
              <View style={{ gap: space.sm }}>
                <Field label={t.searchAthlete} value={athleteSearch} onChangeText={setAthleteSearch} />
                <PillRow>
                  {athletes.slice(0, 50).map((athlete) => (
                    <Pill
                      key={athlete.id}
                      label={`${athlete.firstName} ${athlete.lastName}`}
                      pressed={value.athleteIds.includes(athlete.id)}
                      disabled={frozen}
                      onPress={() => set({ athleteIds: toggle(value.athleteIds, athlete.id) })}
                    />
                  ))}
                </PillRow>
                {athletes.length > 50 ? (
                  <T variant="small" tone="muted">
                    {t.moreAthletes}
                  </T>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.when}</SectionTitle>
        <DateField
          label={t.day}
          hint={t.dayHint}
          value={value.date}
          editable={!frozen}
          onChangeText={(date) => set({ date })}
        />
      </View>

      <View style={{ gap: space.sm }}>
        {/* Le champ et son micro ne font qu'un : le bouton est posé dans le champ, en haut à droite. */}
        <Field
          ref={field}
          testID="planner-instructions"
          label={t.field}
          hint={`${t.fieldHint} ${t.dictateHint}`}
          multiline
          scrollEnabled={false}
          value={value.text}
          editable={!disabled && !dictation.busy}
          error={tooLong ? t.textLimit(value.text.length, PLANNER_TEXT_LIMIT) : dictation.error || null}
          style={{ minHeight: 132 }}
          onChangeText={(text) => set({ text })}
          accessory={
            dictation.busy ? (
              dictation.canCancel ? (
                <IconButton icon={X} label={m.aiPlanner.cancelDictation} tone="filled" onPress={dictation.cancel} />
              ) : null
            ) : (
              <IconButton
                icon={Mic}
                testID="planner-dictate"
                label={t.dictate}
                tone="filled"
                disabled={disabled}
                onPress={dictation.start}
              />
            )
          }
        />
        {dictation.status ? (
          <T variant="small" accessibilityLiveRegion="polite">
            {dictation.status}
          </T>
        ) : null}
        {dictation.recording ? <Button label={m.aiPlanner.stopDictation} onPress={dictation.stop} /> : null}
        {dictation.canCheck ? (
          <Button
            compact
            variant="secondary"
            label={m.aiPlanner.checkTranscription}
            disabled={disabled}
            onPress={dictation.check}
          />
        ) : null}
        {dictation.denied ? (
          <Button compact variant="secondary" label={m.aiPlanner.microphoneSettings} onPress={dictation.openSettings} />
        ) : null}
        {/* Trois usages, visibles tant que le champ est vide : une séance décrite, un objectif, un mélange. */}
        {!value.text.trim() && !dictation.busy ? (
          <View style={{ gap: space.xs }}>
            <T variant="small" tone="muted">
              {t.examplesTitle}
            </T>
            {t.examples.map((example, index) => (
              <Pressable
                key={example.kind}
                testID={`planner-example-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${example.kind} : ${example.text}`}
                disabled={frozen}
                onPress={() => {
                  set({ text: example.text });
                  field.current?.focus();
                }}
                style={({ pressed }) => ({
                  minHeight: TOUCH,
                  paddingVertical: space.sm,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.thumb,
                  backgroundColor: pressed ? p.surface : undefined,
                  gap: 2,
                })}
              >
                <T variant="smallStrong">{example.kind}</T>
                <T variant="small" tone="muted">
                  {example.text}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Fold title={t.precise} detail={summary || null} testID="planner-precise">
        <T variant="small" tone="muted">
          {t.preciseHint}
        </T>
        <Field
          label={t.time}
          hint={t.timeHint}
          value={value.startTime}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          editable={!frozen}
          error={timeInvalid ? t.timeInvalid : null}
          onChangeText={(startTime) => set({ startTime: startTime.trim() })}
        />
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{t.duration}</T>
          <PillRow>
            {PLANNER_DURATIONS.map((min) => (
              <Pill
                key={min}
                label={t.durationValue(min)}
                accessibilityLabel={`${t.duration} ${t.durationValue(min)}`}
                pressed={value.durationMin === min}
                disabled={frozen}
                onPress={() => set({ durationMin: value.durationMin === min ? null : min })}
              />
            ))}
          </PillRow>
        </View>
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{t.level}</T>
          <PillRow>
            {PLANNER_LEVELS.map((level) => (
              <Pill
                key={level}
                label={m.aiPlanner.proposalLevels[level]}
                pressed={value.level === level}
                disabled={frozen}
                onPress={() => set({ level: value.level === level ? null : level })}
              />
            ))}
          </PillRow>
        </View>
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{t.equipment}</T>
          <T variant="caption" tone="muted">
            {t.equipmentHint}
          </T>
          <PillRow>
            {trainingEquipment.options.map((key) => (
              <Pill
                key={key}
                label={m.trainingProfile.equipment[key]}
                pressed={value.equipment.includes(key)}
                disabled={frozen}
                onPress={() => set({ equipment: toggle(value.equipment, key) })}
              />
            ))}
          </PillRow>
        </View>
      </Fold>

      {plannerAsksPhases(value, context.phasesEnabled) ? (
        <PhaseFold key={`${value.date}:${value.groupIds.join(",")}:${value.athleteIds.join(",")}`} phase={phase}>
          <NativePhasePlanning
            orgId={orgId}
            date={value.date}
            groupIds={value.groupIds}
            athleteIds={value.athleteIds}
            onReady={onPhase}
          />
        </PhaseFold>
      ) : null}
    </View>
  );
}

/**
 * La phase du jour choisi, repliée : elle se lit d'elle-même. Un choix manque (un athlète suit deux phases) : le
 * repli s'ouvre seul. Le temps de lire les phases n'est pas un choix à faire : il ne s'ouvre pas pour un chargement.
 */
function PhaseFold({ phase, children }: { phase: PhasePlanningReadiness | null; children: ReactNode }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  const waiting = settled && Boolean(phase && !phase.ready);
  return (
    <Fold title={t.phases} detail={waiting ? t.phasesWaiting : null} forceOpen={waiting} keepMounted>
      {children}
    </Fold>
  );
}
