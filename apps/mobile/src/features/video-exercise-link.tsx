import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeExerciseTerm } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useExercises } from "../lib/queries";
import { Button, Field, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";

// Rattache la vidéo au mouvement travaillé, comme l'analyse web : réservé à l'encadrement.
export const VideoExerciseLink = ({
  orgId,
  videoId,
  current,
  currentName,
}: {
  orgId: string;
  videoId: string;
  current: string | null;
  currentName: string | null;
}) => {
  const client = useQueryClient();
  const exercises = useExercises(orgId);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const link = useMutation({
    mutationFn: (exerciseId: string | null) => api.linkVideoExercise(orgId, videoId, exerciseId),
    onSuccess: () => {
      setOpen(false);
      setSearch("");
      void client.invalidateQueries({ queryKey: ["videos", orgId] });
    },
  });
  const term = normalizeExerciseTerm(search);
  const list = (exercises.data ?? []).filter((exercise) =>
    [exercise.name, ...(exercise.aliases ?? [])].some((name) => normalizeExerciseTerm(name).includes(term)),
  );
  return (
    <View style={{ gap: space.xs }}>
      <Button
        testID="video-exercise-link"
        variant="secondary"
        label={`${m.video.exerciseLink} : ${currentName ?? m.video.exerciseNone}`}
        loading={link.isPending}
        onPress={() => setOpen(true)}
      />
      {link.isError && !open ? (
        <T variant="caption" tone="danger">
          {errorMessage(link.error)}
        </T>
      ) : null}
      {open ? (
        <Sheet dark visible title={m.video.exerciseLink} onClose={() => setOpen(false)}>
          <Field label={m.exercises.search} value={search} onChangeText={setSearch} />
          {link.isError ? (
            <T variant="caption" tone="danger">
              {errorMessage(link.error)}
            </T>
          ) : null}
          {exercises.isPending ? <LoadingState /> : null}
          {exercises.isError && !exercises.data ? (
            <ErrorState error={exercises.error} onRetry={() => void exercises.refetch()} />
          ) : null}
          {exercises.data ? (
            <>
              <Button
                variant={current === null ? "primary" : "secondary"}
                label={m.video.exerciseNone}
                disabled={link.isPending}
                onPress={() => link.mutate(null)}
              />
              {list.map((exercise) => (
                <Button
                  key={exercise.id}
                  variant={exercise.id === current ? "primary" : "secondary"}
                  label={exercise.name}
                  disabled={link.isPending}
                  onPress={() => link.mutate(exercise.id)}
                />
              ))}
            </>
          ) : null}
        </Sheet>
      ) : null}
    </View>
  );
};
