import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exerciseFamily, type ExerciseSummary, type ExerciseFamily, type FilmingNote } from "@tartan/contracts";
import { canIn, isStaff, exerciseFamilyOf, formatPrescription } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { AccessibilityInfo, ScrollView, View } from "react-native";
import { FamilyBand, familySections } from "../../src/features/family-band";
import { ExerciseRow, ExerciseVideo, parseMedia } from "../../src/features/media";
import { MovementGuide } from "../../src/features/exercise-guide";
import { QuickExerciseCreate } from "../../src/features/exercise-finder";
import {
  FavoriteToggle,
  FilePanel,
  LibraryFilters,
  NewListForm,
  useExerciseLists,
} from "../../src/features/exercise-lists";
import { api } from "../../src/lib/api";
import { canCreateIn, exercisesInFilter, listOf, validFilter, type LibraryFilter } from "../../src/lib/exercise-lists";
import { useTrainingSpace, useExercises } from "../../src/lib/queries";
import { ListPlus, Pencil, Plus } from "../../src/ui/icons";
import { Button, Chip, Divider, Field, IconButton, ListSurface, T } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { Sheet } from "../../src/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const t = m.nativeExercises;
const familyOf = (exercise: ExerciseSummary) => exerciseFamilyOf(exercise.guide?.family, exercise.category);
const folded = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// La fiche d'un exercice : le geste d'abord, la fiche concise, puis la prescription. Les variantes ouvrent leur fiche.
const ExerciseSheetBody = ({
  orgId,
  exercise,
  onOpen,
}: {
  orgId: string;
  exercise: ExerciseSummary;
  onOpen: (id: string) => void;
}) => {
  // La fiche complète résout les variantes dans l'espace ; la bibliothèque déjà chargée suffit pour le reste.
  const sheet = useQuery({
    queryKey: ["exercise-sheet", orgId, exercise.id],
    queryFn: () => api.exerciseSheet(orgId, exercise.id),
    enabled: Boolean(orgId),
  });
  const media = parseMedia(exercise.media);
  return (
    <>
      <T variant="small" tone="muted">
        {exercise.shared ? t.sheet.source.shared : t.sheet.source.mine}
      </T>
      {exercise.guide ? (
        <MovementGuide
          key={exercise.guide.catalogKey}
          guide={exercise.guide}
          hideIllustration={media?.kind === "upload"}
          variants={sheet.data?.variants}
          onOpenVariant={(variant) => onOpen(variant.id)}
        />
      ) : null}
      {media ? <ExerciseVideo media={media} rate={1} /> : null}
      {exercise.cues.length > 0 ? (
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{m.exercises.cues}</T>
          {exercise.cues.map((cue) => (
            <T key={cue} variant="small">
              {cue}
            </T>
          ))}
        </View>
      ) : null}
      {formatPrescription(exercise.defaultPrescription) ? (
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{m.mobile.exercises.prescription}</T>
          <T variant="small" tone="muted">
            {formatPrescription(exercise.defaultPrescription)}
          </T>
        </View>
      ) : null}
    </>
  );
};

function FilmingEditor({ orgId, note }: { orgId: string; note: FilmingNote }) {
  const [draft, setDraft] = useState(note);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.saveFilming(orgId, draft),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["exercise-filming", orgId] });
    },
  });
  return (
    <View style={{ gap: space.sm }}>
      <T variant="smallStrong">{m.filming.title}</T>
      <Chip
        label={draft.filmed ? m.filming.filmed : m.filming.pending}
        active={draft.filmed}
        onPress={() => setDraft({ ...draft, filmed: !draft.filmed })}
      />
      <Field
        multiline
        label={m.filming.comment}
        value={draft.comment}
        maxLength={2000}
        onChangeText={(comment) => setDraft({ ...draft, comment })}
      />
      <Button label={m.common.save} loading={save.isPending} onPress={() => save.mutate()} />
      {save.isError && (
        <ErrorState
          error={save.error}
          onRetry={() => void cache.invalidateQueries({ queryKey: ["exercise-filming", orgId] })}
        />
      )}
    </View>
  );
}

export default function Exercises() {
  const { orgId, space: active, me } = useTrainingSpace(true);
  const exercises = useExercises(orgId);
  const client = useQueryClient();
  const router = useRouter();
  const canEdit = active ? canIn(active.kind ?? "coach", active.role, "editExercises") : false;
  const filmingEnabled = active && isStaff(active.role) && active.kind !== "personal";
  const filming = useQuery({
    queryKey: ["exercise-filming", orgId],
    queryFn: () => api.filmingNotes(orgId),
    enabled: Boolean(orgId && filmingEnabled),
  });
  const notes = useMemo(() => new Map(filming.data?.map((note) => [note.exerciseId, note])), [filming.data]);
  const lists = useExerciseLists(orgId, canEdit);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [family, setFamily] = useState<ExerciseFamily | null>(null);
  const [chosen, setChosen] = useState<LibraryFilter>({ kind: "all" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"sheet" | "file" | null>(null);
  const [creating, setCreating] = useState(false);
  const [newList, setNewList] = useState(false);

  const filter = validFilter(chosen, lists.lists);
  const shownList = listOf(filter, lists.lists);
  const createList = canEdit ? canCreateIn(filter, lists.lists) : null;
  const open = openId ? (exercises.data?.find((e) => e.id === openId) ?? null) : null;

  const categories = useMemo(() => [...new Set((exercises.data ?? []).map((e) => e.category))], [exercises.data]);
  const families = useMemo(
    () => [...new Set((exercises.data ?? []).flatMap((e) => (e.guide ? [e.guide.family] : [])))],
    [exercises.data],
  );
  const list = useMemo(() => {
    const query = folded(search.trim());
    const filtered = exercisesInFilter(exercises.data ?? [], filter, lists.lists).filter(
      (e) =>
        (!category || e.category === category) &&
        (!family || familyOf(e) === family) &&
        (!query || [e.name, ...e.tags, ...(e.aliases ?? [])].some((term) => folded(term).includes(query))),
    );
    return filter.kind === "all" && !category && !family
      ? filtered.sort(
          (a, b) => exerciseFamily.options.indexOf(familyOf(a)) - exerciseFamily.options.indexOf(familyOf(b)),
        )
      : filtered;
  }, [exercises.data, search, category, family, filter, lists.lists]);

  // Toute la bibliothèque, ou une seule famille : la liste se range par famille, chacune sous son bandeau coloré.
  const sections = filter.kind === "all" && !category ? familySections(list, familyOf) : null;
  const counts = useMemo(() => {
    const total = new Map<ExerciseFamily, number>();
    for (const exercise of list) total.set(familyOf(exercise), (total.get(familyOf(exercise)) ?? 0) + 1);
    return total;
  }, [list]);

  const renderRow = (exercise: ExerciseSummary, index: number, position: number) => (
    <View key={exercise.id}>
      {position > 0 ? <Divider /> : null}
      <ExerciseRow
        family={familyOf(exercise)}
        ordinal={index + 1}
        testID={`exercise-row-${exercise.id}`}
        name={exercise.name}
        category={exercise.category}
        summary={[
          formatPrescription(exercise.defaultPrescription),
          filmingEnabled && filming.data && (notes.get(exercise.id)?.filmed ? m.filming.filmed : m.filming.pending),
        ]
          .filter(Boolean)
          .join(" · ")}
        hasVideo={
          Boolean(parseMedia(exercise.media)) ||
          Boolean(exercise.guide?.illustration.videos?.some((video) => video.streamUrl))
        }
        onPress={() => {
          setOpenId(exercise.id);
          setPanel("sheet");
        }}
        accessory={
          canEdit ? (
            <FavoriteToggle
              testID={`exercise-star-${exercise.id}`}
              name={exercise.name}
              active={lists.isFavorite(exercise.id)}
              onToggle={() => void lists.toggleFavorite(exercise)}
            />
          ) : undefined
        }
      />
    </View>
  );

  const emptyFilter =
    filter.kind === "favorites"
      ? t.lists.favoritesEmpty
      : filter.kind === "list"
        ? shownList?.mine
          ? t.lists.empty
          : t.lists.sharedEmpty
        : null;

  return (
    <TabScreen
      world="work"
      title={m.exercises.title}
      // Le contenu avant la liste forme un seul enfant : chaque bandeau de famille vient ensuite, suivi de ses fiches.
      stickyChildren={sections?.map((_, index) => 1 + 2 * index)}
      refreshing={exercises.isRefetching}
      onRefresh={() => {
        void exercises.refetch();
        if (canEdit) void lists.refresh();
        if (filmingEnabled) void filming.refetch();
      }}
    >
      <View style={{ gap: space.lg }}>
        {active?.role === "athlete" &&
          me.data?.spaces.some((s) => s.kind === "personal") &&
          me.data.spaces.some((s) => s.kind !== "personal" && s.role === "athlete") && (
            <Button
              variant="secondary"
              label={active.kind === "personal" ? m.brand.clubLibrary : m.brand.notebook}
              onPress={() => router.setParams({ carnet: active.kind === "personal" ? "0" : "1" })}
            />
          )}
        {canEdit && exercises.data ? (
          <Button
            testID="exercise-new"
            label={m.exercises.new}
            icon={Plus}
            onPress={() => router.push("/exercise/new")}
          />
        ) : null}
        {active?.progressionEnabled ? (
          <Button label={m.calculator.title} variant="secondary" onPress={() => router.push("/load-calculator")} />
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
            {canEdit ? (
              <View style={{ gap: space.sm }}>
                <LibraryFilters filter={filter} lists={lists.lists} onChange={setChosen} />
                <Button
                  testID="exercise-list-new"
                  compact
                  variant="ghost"
                  icon={Plus}
                  label={t.lists.new}
                  style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                  onPress={() => setNewList(true)}
                />
              </View>
            ) : null}
            {shownList && !shownList.mine && shownList.ownerName ? (
              <T variant="small" tone="muted" testID="exercise-list-readonly">
                {t.lists.readOnly(shownList.ownerName)}
              </T>
            ) : null}
            {createList ? (
              <Button
                testID="exercise-list-create-exercise"
                variant="secondary"
                icon={Plus}
                label={t.lists.createInList}
                onPress={() => setCreating(true)}
              />
            ) : null}
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
            {families.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <T variant="smallStrong">{m.exerciseGuide.family}</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                  <Chip label={m.exerciseGuide.allFamilies} active={!family} onPress={() => setFamily(null)} />
                  {families.map((value) => (
                    <Chip
                      key={value}
                      label={m.exerciseGuide.families[value]}
                      active={family === value}
                      onPress={() => setFamily(value)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <T variant="small" tone="muted" accessibilityLiveRegion="polite">
              {t.results(list.length)}
              {filmingEnabled &&
                filming.data &&
                ` · ${m.filming.progress(list.filter((exercise) => notes.get(exercise.id)?.filmed).length, list.length)}`}
            </T>
          </>
        ) : null}
        {exercises.isPending ? <LoadingState /> : null}
        {exercises.isError && !exercises.data ? (
          <ErrorState error={exercises.error} onRetry={() => void exercises.refetch()} />
        ) : null}
        {exercises.data?.length === 0 ? <EmptyState body={m.exercises.empty} /> : null}
        {exercises.data && exercises.data.length > 0 && list.length === 0 ? (
          <T tone="muted">{emptyFilter && !search.trim() ? emptyFilter : m.mobile.exercises.noResult}</T>
        ) : null}
      </View>
      {sections
        ? sections.flatMap((section) => [
            <FamilyBand
              key={`band-${section.family}`}
              family={section.family}
              count={counts.get(section.family) ?? 0}
            />,
            <ListSurface
              key={`rows-${section.family}`}
              style={{ marginTop: -space.lg, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            >
              {section.items.map(({ item, index }, position) => renderRow(item, index, position))}
            </ListSurface>,
          ])
        : list.length > 0 && (
            <ListSurface>{list.map((exercise, index) => renderRow(exercise, index, index))}</ListSurface>
          )}
      {open && panel ? (
        <Sheet
          visible
          title={panel === "file" ? t.lists.fileTitle(open.name) : open.name}
          onClose={() => (panel === "file" ? setPanel("sheet") : setPanel(null))}
          headerAction={
            canEdit && panel === "sheet" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <FavoriteToggle
                  testID="exercise-sheet-star"
                  name={open.name}
                  active={lists.isFavorite(open.id)}
                  onToggle={() => void lists.toggleFavorite(open)}
                />
                <IconButton
                  testID="exercise-sheet-file"
                  icon={ListPlus}
                  label={t.lists.file(open.name)}
                  onPress={() => setPanel("file")}
                />
                {!open.shared ? (
                  <Button
                    testID="exercise-edit"
                    compact
                    label={m.mobile.exerciseForm.edit}
                    icon={Pencil}
                    variant="secondary"
                    onPress={() => {
                      const id = open.id;
                      setPanel(null);
                      router.push(`/exercise/${id}`);
                    }}
                  />
                ) : null}
              </View>
            ) : undefined
          }
          footer={
            panel === "file" ? (
              <Button
                testID="exercise-file-done"
                variant="secondary"
                label={t.lists.backToSheet}
                onPress={() => setPanel("sheet")}
              />
            ) : undefined
          }
        >
          {panel === "file" ? (
            <FilePanel exercise={open} state={lists} />
          ) : (
            <>
              <ExerciseSheetBody orgId={orgId} exercise={open} onOpen={(id) => setOpenId(id)} />
              {filmingEnabled && filming.isError && (
                <ErrorState error={filming.error} onRetry={() => void filming.refetch()} />
              )}
              {filmingEnabled && filming.data && (
                <FilmingEditor
                  key={`${open.id}-${notes.get(open.id)?.revision ?? 0}`}
                  orgId={orgId}
                  note={notes.get(open.id) ?? { exerciseId: open.id, filmed: false, comment: "", revision: 0 }}
                />
              )}
            </>
          )}
        </Sheet>
      ) : null}
      {creating && createList && exercises.data ? (
        <Sheet visible title={m.aiPlanner.screen.quick.title} onClose={() => setCreating(false)}>
          <T variant="small" tone="muted">
            {createList.name}
          </T>
          <QuickExerciseCreate
            orgId={orgId}
            exercises={exercises.data}
            initialName={search.trim()}
            term={search.trim()}
            busy={false}
            testPrefix="exercise-list"
            submitLabel={t.quick.submitInLibrary}
            listId={createList.id}
            onDone={(exercise) => {
              setCreating(false);
              AccessibilityInfo.announceForAccessibility(t.quick.createdInList(exercise.name, createList.name));
              void client.invalidateQueries({ queryKey: ["exercises", orgId] });
              void lists.refresh();
            }}
          />
        </Sheet>
      ) : null}
      {newList ? (
        <Sheet visible title={t.lists.new} onClose={() => setNewList(false)}>
          <NewListForm
            primary
            state={lists}
            onCreated={(created) => {
              setNewList(false);
              setChosen({ kind: "list", listId: created.id });
            }}
          />
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
