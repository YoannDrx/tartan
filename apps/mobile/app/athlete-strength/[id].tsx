import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChooseStrengthReference, ExerciseSummary, StrengthTestInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../../src/lib/api";
import { localIsoDate } from "../../src/lib/dates";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace, useCoachAthleteFile, useExercises } from "../../src/lib/queries";
import { buildStrengthTest, buildWorkingReference } from "../../src/lib/strength-form";
import { Button, Card, Field, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

type Write =
  { kind: "test"; body: Omit<StrengthTestInput, "athleteId"> } | { kind: "reference"; body: ChooseStrengthReference };

const StrengthPanel = ({
  orgId,
  athleteId,
  exercise,
  onChangeExercise,
}: {
  orgId: string;
  athleteId: string;
  exercise: ExerciseSummary;
  onChangeExercise: () => void;
}) => {
  const client = useQueryClient();
  const reference = useQuery({
    queryKey: ["exercise-strength", orgId, athleteId, exercise.id],
    queryFn: () => api.exerciseStrength(orgId, athleteId, exercise.id),
  });
  const [value, setValue] = useState("");
  const [working, setWorking] = useState("");
  const [date, setDate] = useState(localIsoDate());
  const [kind, setKind] = useState<"one_rm" | "three_rm" | "estimated">("one_rm");
  const [selectAsReference, setSelectAsReference] = useState(false);
  const [message, setMessage] = useState("");
  const write = useMutation<unknown, unknown, Write>({
    mutationFn: (action: Write) =>
      action.kind === "test"
        ? api.addStrengthTest(orgId, athleteId, action.body)
        : api.selectStrengthReference(orgId, athleteId, exercise.id, action.body),
    onSuccess: async (_, action) => {
      setMessage(
        action.kind === "test" && !action.body.selectAsReference ? m.strength.saved : m.strength.referenceSaved,
      );
      if (action.kind === "test") setValue("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["exercise-strength", orgId, athleteId, exercise.id] }),
        client.invalidateQueries({ queryKey: ["coach-athlete", orgId, athleteId] }),
      ]);
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const choose = (body: ChooseStrengthReference) =>
    Alert.alert(
      m.strength.workingReference,
      body.source === "test" ? m.strength.selectConfirm : m.strength.workingConfirm,
      [
        { text: m.common.cancel, style: "cancel" },
        {
          text: m.common.save,
          onPress: () => {
            setMessage("");
            write.mutate({ kind: "reference", body });
          },
        },
      ],
    );
  const hint = exercise.strengthLoadKind === "added_weight" ? m.strength.addedHint : m.strength.totalHint;
  return (
    <View style={{ gap: space.lg }}>
      <Button
        label={m.strength.changeExercise}
        variant="secondary"
        disabled={write.isPending}
        onPress={() => {
          if (!value && !working) {
            onChangeExercise();
            return;
          }
          Alert.alert(m.strength.changeExercise, m.strength.changeExerciseConfirm, [
            { text: m.common.cancel, style: "cancel" },
            { text: m.strength.changeExercise, style: "destructive", onPress: onChangeExercise },
          ]);
        }}
      />
      <SectionTitle>{exercise.name}</SectionTitle>
      <T>{hint}</T>
      {reference.isPending ? (
        <LoadingState />
      ) : reference.isError ? (
        <ErrorState error={reference.error} onRetry={() => void reference.refetch()} />
      ) : (
        <Card>
          <T heading variant="title2">
            {m.strength.currentReference}
          </T>
          {reference.data.reference ? (
            <>
              <T variant="figure">{reference.data.reference.valueKg} kg</T>
              <T>{m.strength.referenceKinds[reference.data.reference.kind]}</T>
            </>
          ) : (
            <T>{m.strength.noReference}</T>
          )}
        </Card>
      )}
      <Card>
        <View style={{ gap: space.md }}>
          <T heading variant="title2">
            {m.strength.addTest}
          </T>
          <Field
            label={m.progression.fields.loadKg}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            editable={!write.isPending}
          />
          <T variant="smallStrong">{m.strength.testKind}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {(["one_rm", "three_rm", "estimated"] as const).map((option) => (
              <Button
                key={option}
                label={m.testKind[option]}
                selected={kind === option}
                compact
                variant={kind === option ? "primary" : "secondary"}
                disabled={write.isPending}
                onPress={() => setKind(option)}
              />
            ))}
          </View>
          <Field
            label={m.builder.date}
            hint={m.strength.dateHint}
            value={date}
            onChangeText={setDate}
            editable={!write.isPending}
            autoCapitalize="none"
            maxLength={10}
          />
          <Button
            label={m.strength.selectReference}
            selected={selectAsReference}
            variant="secondary"
            disabled={write.isPending}
            onPress={() => setSelectAsReference((old) => !old)}
          />
          <Button
            label={m.strength.addTest}
            loading={write.isPending}
            disabled={!reference.data}
            onPress={() => {
              const parsed = buildStrengthTest(athleteId, exercise, { value, kind, date, selectAsReference });
              if (!parsed.success) {
                setMessage(m.errors.invalid);
                return;
              }
              setMessage("");
              write.mutate({ kind: "test", body: parsed.data });
            }}
          />
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <T heading variant="title2">
            {m.strength.workingReference}
          </T>
          <Field
            label={m.strength.valueKg}
            hint={hint}
            value={working}
            onChangeText={setWorking}
            keyboardType="decimal-pad"
            editable={!write.isPending}
          />
          <Button
            label={m.common.save}
            variant="secondary"
            disabled={write.isPending || !reference.data}
            onPress={() => {
              const parsed = buildWorkingReference(working);
              if (!parsed.success) {
                setMessage(m.errors.invalid);
                return;
              }
              choose(parsed.data);
            }}
          />
        </View>
      </Card>
      {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
      <SectionTitle>{m.athletes.tests}</SectionTitle>
      {reference.data?.tests.length === 0 ? <T>{m.athletes.noTests}</T> : null}
      {reference.data?.tests.map((test) => (
        <Card key={test.id}>
          <View style={{ gap: space.sm }}>
            <T variant="figure">{test.value} kg</T>
            <T>
              {m.testKind[test.kind as keyof typeof m.testKind] ?? test.kind} · {test.date.slice(0, 10)}
            </T>
            {reference.data.reference?.sourceTestId === test.id ? (
              <T>{m.strength.currentReference}</T>
            ) : (
              <Button
                label={m.strength.selectExisting}
                variant="secondary"
                disabled={write.isPending || test.loadKind !== exercise.strengthLoadKind}
                onPress={() => choose({ source: "test", testId: test.id })}
              />
            )}
          </View>
        </Card>
      ))}
    </View>
  );
};

const StrengthScreen = ({ orgId, athleteId }: { orgId: string; athleteId: string }) => {
  const exercises = useExercises(orgId);
  const file = useCoachAthleteFile(orgId, athleteId);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const compatible = (exercises.data ?? []).filter(
    (exercise) => exercise.strengthLoadKind === "external_total" || exercise.strengthLoadKind === "added_weight",
  );
  const current = compatible.find((exercise) => exercise.id === selected);
  const filtered = compatible.filter((exercise) =>
    exercise.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")),
  );
  return (
    <StackScreen
      world="work"
      title={m.strength.manage}
      subtitle={file.data ? `${file.data.firstName} ${file.data.lastName}` : undefined}
    >
      {file.isPending || exercises.isPending ? (
        <LoadingState />
      ) : file.isError || exercises.isError ? (
        <ErrorState
          error={file.error ?? exercises.error}
          onRetry={() => {
            void file.refetch();
            void exercises.refetch();
          }}
        />
      ) : (
        <>
          {current ? (
            <StrengthPanel
              key={current.id}
              orgId={orgId}
              athleteId={athleteId}
              exercise={current}
              onChangeExercise={() => {
                setSelected(null);
                setSearch("");
              }}
            />
          ) : !compatible.length ? (
            <>
              <T>{m.strength.noCompatibleExercise}</T>
              <Button label={m.strength.openLibrary} onPress={() => router.push("/exercises")} />
            </>
          ) : (
            <>
              <Field label={m.strength.exerciseSearch} value={search} onChangeText={setSearch} />
              {!filtered.length ? <T>{m.strength.noMatch}</T> : null}
              {filtered.map((exercise) => (
                <Button
                  key={exercise.id}
                  label={exercise.name}
                  selected={selected === exercise.id}
                  variant="secondary"
                  onPress={() => setSelected(exercise.id)}
                />
              ))}
            </>
          )}
        </>
      )}
    </StackScreen>
  );
};

export default function AthleteStrength() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orgId, me, space: active } = useActiveSpace();
  if (me.isPending)
    return (
      <StackScreen title={m.strength.manage}>
        <LoadingState />
      </StackScreen>
    );
  if (!active?.progressionEnabled || (active.role !== "owner" && active.role !== "coach"))
    return (
      <StackScreen title={m.strength.manage}>
        <T>{active?.progressionEnabled ? m.common.forbidden : m.progression.disabled}</T>
      </StackScreen>
    );
  return <StrengthScreen key={`${me.data?.id}:${orgId}:${id}`} orgId={orgId} athleteId={id} />;
}
