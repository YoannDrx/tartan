import { useMutation, useQueryClient } from "@tanstack/react-query";
import { exerciseCategory, exerciseMovement, exerciseEquipment, type ExerciseSummary } from "@tartan/contracts";
import { instagramUrl, parseYouTubeUrl } from "@tartan/domain";
import { m, exerciseClassificationLabel } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { parseMedia } from "../../src/features/media";
import { VideoRow } from "../../src/features/video-bits";
import { MovementGuide } from "../../src/features/exercise-guide";
import { saveExercise } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { buildExerciseInput, type ExerciseDraft, NUMBER_FIELDS, type NumberField } from "../../src/lib/exercise-form";
import { useActiveSpace, useExercises, useExerciseVideos } from "../../src/lib/queries";
import { Button, Card, Chip, Divider, Field, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
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
  const instagram = media?.kind === "instagram" ? media : null;
  const p = exercise?.defaultPrescription ?? {};
  return {
    id: exercise?.id,
    name: exercise?.name ?? "",
    aliases: (exercise?.aliases ?? []).join("\n"),
    category: exercise?.category ?? "plyo",
    classification: exercise?.classification ?? { movement: null, equipment: null },
    cues: (exercise?.cues ?? []).join("\n"),
    strengthLoadKind: exercise?.strengthLoadKind ?? null,
    loadStepKg: String(exercise?.loadStepKg ?? 1.25),
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
    url: youtube ? `https://youtu.be/${youtube.youtubeId}` : instagram ? instagramUrl(instagram.instagramCode) : "",
    title: youtube?.title ?? instagram?.title ?? "",
    startS: text(youtube?.startS),
    endS: text(youtube?.endS),
  };
};

// Mêmes règles que la liste des vidéos : le serveur ne renvoie que les athlètes visibles par ce membre.
const LinkedVideos = ({ orgId, exerciseId }: { orgId: string; exerciseId: string }) => {
  const router = useRouter();
  const videos = useExerciseVideos(orgId, exerciseId);
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{m.exercises.linkedVideos}</SectionTitle>
      {videos.isPending ? <LoadingState /> : null}
      {videos.isError && !videos.data ? (
        <ErrorState error={videos.error} onRetry={() => void videos.refetch()} />
      ) : null}
      {videos.data?.length === 0 ? (
        <T variant="small" tone="muted">
          {m.exercises.linkedVideosEmpty}
        </T>
      ) : null}
      {videos.data && videos.data.length > 0 ? (
        <ListSurface>
          {videos.data.map((video, i) => (
            <View key={video.id}>
              {i > 0 ? <Divider /> : null}
              <VideoRow video={video} showAthlete onPress={() => router.push(`/video/${video.id}`)} />
            </View>
          ))}
        </ListSurface>
      ) : null}
    </View>
  );
};

const ExerciseForm = ({ orgId, exercise }: { orgId: string; exercise: ExerciseSummary | null }) => {
  const client = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState<ExerciseDraft>(() => draftFrom(exercise));
  const [classifying, setClassifying] = useState(false);
  const classification = draft.classification ?? { movement: null, equipment: null };
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
      world="work"
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
          testID="exercise-aliases"
          label={m.exercises.aliases}
          hint={m.exercises.aliasesHint}
          value={draft.aliases ?? ""}
          onChangeText={(aliases) => set({ aliases })}
          multiline
          error={errorOn("aliases")}
        />
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

      <Card>
        <Button
          label={m.exerciseClassification.title}
          variant="secondary"
          expanded={classifying}
          onPress={() => setClassifying(!classifying)}
        />
        {classifying ? (
          <View style={{ gap: space.sm }}>
            <T tone="muted">{m.exerciseClassification.hint}</T>
            <T variant="smallStrong">{m.exerciseClassification.movement}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              <Chip
                tall
                label={m.exerciseClassification.unknown}
                active={classification.movement === null}
                onPress={() => set({ classification: { ...classification, movement: null } })}
              />
              {exerciseMovement.options.map((key) => (
                <Chip
                  tall
                  key={key}
                  label={exerciseClassificationLabel("movements", key)}
                  active={classification.movement === key}
                  onPress={() => set({ classification: { ...classification, movement: key } })}
                />
              ))}
            </View>
            <T variant="smallStrong">{m.exerciseClassification.equipment}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              <Chip
                tall
                label={m.exerciseClassification.unknown}
                active={classification.equipment === null}
                onPress={() => set({ classification: { ...classification, equipment: null } })}
              />
              <Chip
                tall
                label={m.exerciseClassification.none}
                active={classification.equipment?.length === 0}
                onPress={() => set({ classification: { ...classification, equipment: [] } })}
              />
              {exerciseEquipment.options.map((key) => (
                <Chip
                  tall
                  key={key}
                  label={exerciseClassificationLabel("equipment", key)}
                  active={classification.equipment?.includes(key) ?? false}
                  onPress={() =>
                    set({
                      classification: {
                        ...classification,
                        equipment: classification.equipment?.includes(key)
                          ? classification.equipment.filter((k) => k !== key)
                          : [...(classification.equipment ?? []), key],
                      },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </Card>
      <Card>
        <SectionTitle>{m.strength.convention}</SectionTitle>
        <T variant="caption">{m.strength.conventionHint}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip
            tall
            label={m.strength.unknownConvention}
            active={!draft.strengthLoadKind}
            onPress={() => set({ strengthLoadKind: null })}
          />
          {(Object.keys(m.strength.conventions) as (keyof typeof m.strength.conventions)[]).map((kind) => (
            <Chip
              key={kind}
              tall
              label={m.strength.conventions[kind]}
              active={draft.strengthLoadKind === kind}
              onPress={() => set({ strengthLoadKind: kind })}
            />
          ))}
        </View>
        <Field
          label={m.strength.step}
          hint={m.strength.stepHint}
          value={draft.loadStepKg}
          onChangeText={(loadStepKg) => set({ loadStepKg })}
          keyboardType="decimal-pad"
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
            label={m.exercises.videoUrl}
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
              {parseYouTubeUrl(draft.url) ? (
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
              ) : null}
            </>
          ) : null}
        </Card>
      </View>

      {exercise?.guide ? <MovementGuide guide={exercise.guide} /> : null}
      {exercise ? <LinkedVideos orgId={orgId} exerciseId={exercise.id} /> : null}
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
      <StackScreen world="work" title={m.mobile.exerciseForm.editTitle}>
        <LoadingState />
      </StackScreen>
    );
  }
  const exercise = exercises.data?.find((e) => e.id === id);
  if (!exercise) {
    return (
      <StackScreen world="work" title={m.mobile.exerciseForm.editTitle}>
        <ErrorState message={m.common.notFound} onRetry={() => void exercises.refetch()} />
      </StackScreen>
    );
  }
  return <ExerciseForm key={exercise.id} orgId={orgId} exercise={exercise} />;
}
