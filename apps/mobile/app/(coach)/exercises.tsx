import type { ExerciseSummary } from "@tartan/contracts";
import { can, formatPrescription } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { ExerciseRow, ExerciseVideo, parseMedia } from "../../src/features/media";
import { useActiveSpace, useExercises } from "../../src/lib/queries";
import { Pencil, Plus } from "../../src/ui/icons";
import { Button, Chip, Divider, Field, ListSurface, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { Sheet } from "../../src/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const folded = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Exercises() {
  const { orgId, space: active } = useActiveSpace();
  const exercises = useExercises(orgId);
  const router = useRouter();
  const canEdit = active ? can(active.role, "editExercises") : false;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<ExerciseSummary | null>(null);

  const categories = useMemo(() => [...new Set((exercises.data ?? []).map((e) => e.category))], [exercises.data]);
  const list = useMemo(() => {
    const query = folded(search.trim());
    return (exercises.data ?? []).filter(
      (e) =>
        (!category || e.category === category) &&
        (!query || folded(e.name).includes(query) || e.tags.some((t) => folded(t).includes(query))),
    );
  }, [exercises.data, search, category]);

  return (
    <TabScreen
      world="craie"
      title={m.exercises.title}
      refreshing={exercises.isRefetching}
      onRefresh={() => void exercises.refetch()}
    >
      {canEdit && exercises.data ? (
        <Button
          testID="exercise-new"
          label={m.exercises.new}
          icon={Plus}
          onPress={() => router.push("/exercise/new")}
        />
      ) : null}
      {exercises.data && exercises.data.length > 0 ? (
        <>
          <Field
            label={m.mobile.exercises.searchLabel}
            hideLabel
            placeholder={m.mobile.exercises.searchLabel}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {categories.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip label={m.mobile.exercises.all} active={!category} onPress={() => setCategory(null)} />
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={(m.exerciseCategory as Record<string, string>)[c] ?? c}
                  active={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}
      {exercises.isPending ? <LoadingState /> : null}
      {exercises.isError && !exercises.data ? (
        <ErrorState error={exercises.error} onRetry={() => void exercises.refetch()} />
      ) : null}
      {exercises.data?.length === 0 ? <EmptyState body={m.exercises.empty} /> : null}
      {exercises.data && exercises.data.length > 0 && list.length === 0 ? (
        <T tone="muted">{m.mobile.exercises.noResult}</T>
      ) : null}
      {list.length > 0 ? (
        <ListSurface>
          {list.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Divider /> : null}
              <ExerciseRow
                name={e.name}
                category={e.category}
                summary={formatPrescription(e.defaultPrescription)}
                hasVideo={Boolean(parseMedia(e.media))}
                onPress={() => setOpen(e)}
              />
            </View>
          ))}
        </ListSurface>
      ) : null}
      {open ? (
        <Sheet
          visible
          title={open.name}
          onClose={() => setOpen(null)}
          footer={
            canEdit && !open.shared ? (
              <Button
                testID="exercise-edit"
                label={m.mobile.exerciseForm.edit}
                icon={Pencil}
                variant="secondary"
                onPress={() => {
                  const id = open.id;
                  setOpen(null);
                  router.push(`/exercise/${id}`);
                }}
              />
            ) : undefined
          }
        >
          {parseMedia(open.media) ? <ExerciseVideo media={parseMedia(open.media)} rate={1} /> : null}
          {open.cues.length > 0 ? (
            <View style={{ gap: space.xs }}>
              <T variant="smallStrong">{m.exercises.cues}</T>
              {open.cues.map((cue) => (
                <T key={cue} variant="small">
                  {cue}
                </T>
              ))}
            </View>
          ) : null}
          {formatPrescription(open.defaultPrescription) ? (
            <View style={{ gap: space.xs }}>
              <T variant="smallStrong">{m.mobile.exercises.prescription}</T>
              <T variant="small" tone="muted">
                {formatPrescription(open.defaultPrescription)}
              </T>
            </View>
          ) : null}
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
