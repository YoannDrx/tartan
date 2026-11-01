import { useMutation, useQueryClient } from "@tanstack/react-query";
import { exerciseCategory, type ExerciseSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { parseMedia } from "../../src/features/media";
import { saveExercise } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { buildExerciseInput, type ExerciseDraft, NUMBER_FIELDS, type NumberField } from "../../src/lib/exercise-form";
import { useActiveSpace, useExercises } from "../../src/lib/queries";
import { Button, Card, Chip, Field, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const NUMBER_LABELS: Record<NumberField, string> = {
  sets: m.builder.sets,
  reps: m.builder.reps,
  distance_m: m.builder.distance,
  duration_s: m.builder.durationS,
  rest_s: m.builder.rest,
  ground_contacts: m.builder.contacts,
};

const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

const draftFrom = (exercise: ExerciseSummary | null): ExerciseDraft => {
  const media = parseMedia(exercise?.media);
  const youtube = media?.kind === "youtube" ? media : null;
  const p = exercise?.defaultPrescription ?? {};
  return {
    id: exercise?.id,
    name: exercise?.name ?? "",
    category: exercise?.category ?? "plyo",
    cues: (exercise?.cues ?? []).join("\n"),
    tags: exercise?.tags ?? [],
    base: p,
    numbers: {
      sets: text(p.sets),
      reps: text(p.reps),
      distance_m: text(p.distance_m),
      duration_s: text(p.duration_s),
      rest_s: text(p.rest_s),
      ground_contacts: text(p.ground_contacts),
    },
    url: youtube ? `https://youtu.be/${youtube.youtubeId}` : "",
    title: youtube?.title ?? "",
    startS: text(youtube?.startS),
    endS: text(youtube?.endS),
  };
};

const ExerciseForm = ({ orgId, exercise }: { orgId: string; exercise: ExerciseSummary | null }) => {
  const client = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState<ExerciseDraft>(() => draftFrom(exercise));
  const [problem, setProblem] = useState<{ field: string; message: string } | null>(null);
  const set = (patch: Partial<ExerciseDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setProblem(null);
  };
  const errorOn = (field: string) => (problem?.field === field ? problem.message : null);

  const save = useMutation({
    mutationFn: async () => {
      const built = buildExerciseInput(draft);
      if (!built.ok) {
        setProblem(built);
        return false;
      }
      await saveExercise(orgId, built.input);
      return true;
    },
    onSuccess: async (saved) => {
      if (!saved) return;
      await client.invalidateQueries({ queryKey: ["exercises", orgId] });
      if (router.canGoBack()) router.back();
      else router.replace("/exercises");
    },
    onError: (error) => setProblem({ field: "form", message: errorMessage(error) }),
  });

  return (
    <StackScreen
      title={exercise ? m.mobile.exerciseForm.editTitle : m.exercises.new}
      footer={
        <>
          {problem?.field === "form" ? (
            <T variant="small" accessibilityLiveRegion="assertive">
              {problem.message}
            </T>
          ) : null}
          <Button
            testID="exercise-save"
            label={m.common.save}
            loading={save.isPending}
            onPress={() => {
              setProblem(null);
              save.mutate();
            }}
          />
        </>
      }
    >
      <Card>
        <Field
          testID="exercise-name"
          label={m.exercises.name}
          value={draft.name}
          onChangeText={(name) => set({ name })}
          maxLength={120}
          error={errorOn("name")}
        />
        <View style={{ gap: space.sm }}>
          <T variant="smallStrong">{m.exercises.category}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {exerciseCategory.options.map((category) => (
              <Chip
                key={category}
                tall
                label={m.exerciseCategory[category]}
                active={draft.category === category}
                onPress={() => set({ category })}
              />
            ))}
          </View>
        </View>
        <Field
          testID="exercise-cues"
          label={m.exercises.cues}
          hint={m.mobile.exerciseForm.cuesHint}
          value={draft.cues}
          onChangeText={(cues) => set({ cues })}
          multiline
          error={errorOn("cues")}
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.exercises.defaults}</SectionTitle>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {NUMBER_FIELDS.map((key) => (
              <Field
                key={key}
                testID={`exercise-${key}`}
                label={NUMBER_LABELS[key]}
                value={draft.numbers[key]}
                onChangeText={(value) => set({ numbers: { ...draft.numbers, [key]: value } })}
                keyboardType="number-pad"
                containerStyle={{ flexGrow: 1, flexBasis: "40%" }}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.mobile.exerciseForm.video}</SectionTitle>
        <Card>
          <Field
            testID="exercise-youtube"
            label={m.exercises.youtubeUrl}
            hint={m.mobile.exerciseForm.youtubeKeep}
            value={draft.url}
            onChangeText={(url) => set({ url })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={errorOn("url")}
          />
          {draft.url.trim() ? (
            <>
              <Field
                label={m.exercises.youtubeTitle}
                value={draft.title}
                onChangeText={(title) => set({ title })}
                maxLength={120}
              />
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Field
                  label={m.exercises.youtubeStart}
                  value={draft.startS}
                  onChangeText={(startS) => set({ startS })}
                  keyboardType="number-pad"
                  containerStyle={{ flex: 1 }}
                />
                <Field
                  label={m.exercises.youtubeEnd}
                  value={draft.endS}
                  onChangeText={(endS) => set({ endS })}
                  keyboardType="number-pad"
                  containerStyle={{ flex: 1 }}
                  error={errorOn("clip")}
                />
              </View>
            </>
          ) : null}
        </Card>
      </View>
    </StackScreen>
  );
};

export default function ExerciseEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orgId } = useActiveSpace();
  const exercises = useExercises(orgId);
  if (id === "new") return <ExerciseForm orgId={orgId} exercise={null} />;
  if (exercises.isPending) {
    return (
      <StackScreen title={m.mobile.exerciseForm.editTitle}>
        <LoadingState />
      </StackScreen>
    );
  }
  const exercise = exercises.data?.find((e) => e.id === id);
  if (!exercise) {
    return (
      <StackScreen title={m.mobile.exerciseForm.editTitle}>
        <ErrorState message={m.common.notFound} onRetry={() => void exercises.refetch()} />
      </StackScreen>
    );
  }
  return <ExerciseForm key={exercise.id} orgId={orgId} exercise={exercise} />;
}
