import { Check } from "lucide-react-native";
import {
  exerciseCategory,
  resolvePlannerExerciseInput,
  type ExerciseSummary,
  type ResolvePlannerExerciseInput,
} from "@tartan/contracts";
import { normalizeExerciseTerm, rankPlannerCandidates } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import { View } from "react-native";
import { Button, Field, T } from "../ui/primitives";
import { space } from "../ui/theme";

const t = m.aiPlanner;
export function NativePlannerExerciseResolution({
  questionId,
  requestedName,
  version,
  exercises,
  disabled,
  allowCreate,
  resolved,
  onResolve,
}: {
  questionId: string;
  requestedName?: string | null;
  version: number;
  exercises: ExerciseSummary[];
  disabled: boolean;
  allowCreate: boolean;
  resolved?: string;
  onResolve: (input: ResolvePlannerExerciseInput) => Promise<void>;
}) {
  const [name, setName] = useState(requestedName ?? "");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<(typeof exerciseCategory.options)[number]>("strength");
  const [cues, setCues] = useState("");
  const [loadKind, setLoadKind] = useState<"external_total" | "added_weight" | "assistance" | "bodyweight">(
    "bodyweight",
  );
  const [reviewed, setReviewed] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = useRef<ResolvePlannerExerciseInput | null>(null);
  const frozen = disabled || sent;
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
        operationId: randomUUID(),
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
  if (resolved) return <T accessibilityLiveRegion="polite">{t.exerciseResolved(resolved)}</T>;
  return (
    <View style={{ gap: space.sm }}>
      <T>{t.resolveExerciseHelp}</T>
      <Field
        label={t.requestedMovement}
        value={name}
        maxLength={120}
        editable={!frozen && !requestedName}
        onChangeText={setName}
      />
      {!creating ? (
        <>
          <Field
            label={t.searchLibrary}
            testID="planner-exercise-search"
            value={search}
            editable={!frozen}
            onChangeText={setSearch}
          />
          <T variant="smallStrong">{t.possibleExercises}</T>
          {candidates.map((exercise) => (
            <Button
              key={exercise.id}
              variant="secondary"
              label={exercise.name}
              disabled={frozen || !name.trim()}
              onPress={() => void submit({ kind: "existing", exerciseId: exercise.id })}
            />
          ))}
          {allowCreate ? (
            <Button
              testID="planner-create-exercise"
              variant="secondary"
              label={t.createPrivateExercise}
              disabled={frozen}
              onPress={() => setCreating(true)}
            />
          ) : null}
          <T>{t.rephraseExercise}</T>
        </>
      ) : (
        <>
          <T>{t.privateExerciseReview}</T>
          <T variant="smallStrong">{m.exercises.category}</T>
          {exerciseCategory.options.map((value) => (
            <Button
              key={value}
              variant="secondary"
              label={m.exerciseCategory[value]}
              selected={category === value}
              icon={category === value ? Check : undefined}
              disabled={frozen}
              onPress={() => {
                setCategory(value);
                setReviewed(false);
              }}
            />
          ))}
          <Field
            label={t.movementCues}
            testID="planner-exercise-cues"
            multiline
            value={cues}
            editable={!frozen}
            onChangeText={(value) => {
              setCues(value);
              setReviewed(false);
            }}
          />
          <T variant="smallStrong">{t.movementLoadConvention}</T>
          {(["external_total", "added_weight", "assistance", "bodyweight"] as const).map((value) => (
            <Button
              key={value}
              variant="secondary"
              label={t.movementLoadKinds[value]}
              selected={loadKind === value}
              icon={loadKind === value ? Check : undefined}
              disabled={frozen}
              onPress={() => {
                setLoadKind(value);
                setReviewed(false);
              }}
            />
          ))}
          <Button
            variant="secondary"
            label={t.privateExerciseReviewed}
            testID="planner-exercise-reviewed"
            selected={reviewed}
            icon={reviewed ? Check : undefined}
            disabled={frozen}
            onPress={() => setReviewed(!reviewed)}
          />
          <Button
            label={t.savePrivateExercise}
            testID="planner-exercise-save"
            disabled={
              frozen ||
              !reviewed ||
              !name.trim() ||
              cues.split("\n").filter(Boolean).length > 5 ||
              cues.split("\n").some((line) => line.length > 120)
            }
            onPress={() =>
              void submit({
                kind: "create",
                reviewed: true,
                exercise: {
                  name,
                  category,
                  cues: cues
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                  tags: [],
                  aliases: [],
                  defaultPrescription: {},
                  strengthLoadKind: loadKind,
                },
              })
            }
          />
          <Button variant="secondary" label={m.common.cancel} disabled={frozen} onPress={() => setCreating(false)} />
        </>
      )}
      {sent ? (
        <>
          <T>{t.immutableRequest}</T>
          <Button
            label={t.retryExerciseResolution}
            disabled={disabled}
            onPress={() => pending.current && void onResolve(pending.current)}
          />
        </>
      ) : null}
    </View>
  );
}
