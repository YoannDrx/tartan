import {
  exerciseCategory,
  exerciseLoadKind,
  type ExerciseCategory,
  type ExerciseSummary,
  type PlannerSlotSuggestion,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { exercisesInFilter, validFilter, type LibraryFilter } from "../lib/exercise-lists";
import {
  plannerNearExercises,
  plannerQuickDefaults,
  plannerQuickInput,
  plannerSearchLibrary,
  type PlannerLoadChoice,
} from "../lib/planner-flow";
import { ArrowLeft, ListPlus, Plus, Search } from "../ui/icons";
import { Button, Field, IconButton, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { space } from "../ui/theme";
import { FilePanel, LibraryFilters, type ExerciseListsState } from "./exercise-lists";
import { Pill, PillRow } from "./planner-ui";

// Chercher une fiche dans toute la bibliothèque, ou la créer sans quitter l'écran : partagé par le planificateur, le
// constructeur et la bibliothèque. Les textes sont ceux du planificateur, déjà génériques.
const t = m.aiPlanner.screen;
const LIMIT = 40;
type Picked = { id: string; name: string };
const loadChoices: PlannerLoadChoice[] = [...exerciseLoadKind.options, "none"];

/**
 * Créer une fiche par son nom : un champ, deux choix déjà faits, un bouton. La famille et la charge viennent de la
 * suggestion du serveur pour un emplacement, sinon de la fiche la plus proche de la bibliothèque ; elles se
 * corrigent d'un geste. Une fiche qui porte déjà ce nom n'est pas recréée : elle est proposée à la place.
 */
export function QuickExerciseCreate({
  orgId,
  exercises,
  initialName,
  term,
  suggestion,
  busy,
  onDone,
  onBack,
  testPrefix = "planner",
  submitLabel = t.quick.submit,
  listId,
}: {
  orgId: string;
  exercises: ExerciseSummary[];
  initialName: string;
  /** Ce que le coach a dit ou cherché : un autre nom de la fiche s'il change le nom. */
  term: string;
  suggestion?: Pick<PlannerSlotSuggestion, "name" | "category" | "loadKind"> | null;
  busy: boolean;
  onDone: (exercise: ExerciseSummary, created: boolean) => void;
  onBack?: () => void;
  testPrefix?: string;
  submitLabel?: string;
  /** Création directe dans une liste du coach. */
  listId?: string;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [load, setLoad] = useState<PlannerLoadChoice | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const trimmed = name.trim();
  const proposed = plannerQuickDefaults(trimmed, exercises, suggestion);
  // Ce que le coach a touché passe avant la proposition ; ce qui s'affiche est ce qui sera créé.
  const shownCategory = category ?? proposed.category;
  const shownLoad = load ?? (category && category !== proposed.category ? "none" : proposed.load);
  // Dans une liste, une fiche déjà existante y est rangée par le serveur : la création reste proposée.
  const existing = trimmed && !listId ? proposed.existing : null;
  const submit = async () => {
    if (!trimmed) return setError(t.quick.nameRequired);
    if (existing) return onDone(existing, false);
    setSending(true);
    setError("");
    try {
      const result = await api.quickCreateExercise(orgId, {
        ...plannerQuickInput({ name: trimmed, term, category: shownCategory, load: shownLoad }),
        ...(listId ? { listId } : {}),
      });
      AccessibilityInfo.announceForAccessibility(
        result.created ? t.finder.created(result.exercise.name) : t.finder.reused(result.exercise.name),
      );
      onDone(result.exercise, result.created);
    } catch (cause) {
      setError(errorMessage(cause) || t.quick.failed);
    } finally {
      setSending(false);
    }
  };
  return (
    <View style={{ gap: space.lg }}>
      <Field
        testID={`${testPrefix}-quick-name`}
        label={t.quick.name}
        value={name}
        maxLength={120}
        autoCorrect={false}
        returnKeyType="done"
        error={error || null}
        onChangeText={(value) => {
          setName(value);
          setError("");
        }}
      />
      {existing ? (
        <T accessibilityLiveRegion="polite">{t.quick.exists(existing.name)}</T>
      ) : (
        <>
          <View style={{ gap: space.xs }}>
            <T variant="smallStrong">{t.quick.family}</T>
            <PillRow>
              {exerciseCategory.options.map((value) => (
                <Pill
                  key={value}
                  label={m.exerciseCategory[value]}
                  accessibilityLabel={`${t.quick.family} : ${m.exerciseCategory[value]}`}
                  pressed={shownCategory === value}
                  onPress={() => setCategory(value)}
                />
              ))}
            </PillRow>
          </View>
          <View style={{ gap: space.xs }}>
            <T variant="smallStrong">{t.quick.load}</T>
            <PillRow>
              {loadChoices.map((value) => (
                <Pill
                  key={value}
                  label={t.quick.loadKinds[value]}
                  accessibilityLabel={`${t.quick.load} : ${t.quick.loadKinds[value]}`}
                  pressed={shownLoad === value}
                  onPress={() => setLoad(value)}
                />
              ))}
            </PillRow>
          </View>
          {proposed.basis && !category && !load ? (
            <T variant="small" tone="muted">
              {t.quick.basedOn(proposed.basis)}
            </T>
          ) : null}
        </>
      )}
      <View style={{ gap: space.sm }}>
        <Button
          testID={`${testPrefix}-quick-submit`}
          label={existing ? t.quick.useExisting : submitLabel}
          loading={sending}
          disabled={busy || sending}
          onPress={() => void submit()}
        />
        {existing ? null : (
          <T variant="small" tone="muted">
            {t.quick.later}
          </T>
        )}
        {onBack ? <Button compact variant="ghost" icon={Search} label={t.slot.backToSearch} onPress={onBack} /> : null}
      </View>
    </View>
  );
}

type View_ = { kind: "search" } | { kind: "create"; name: string } | { kind: "file"; exercise: Picked };

/**
 * Chercher une fiche dans toute la bibliothèque de l'espace, ou la créer sans quitter la séance. Sans recherche
 * saisie, les fiches proches du terme dit viennent d'abord ; dès qu'un terme est saisi, la dernière ligne propose
 * de créer la fiche. Avec les listes du coach (`library`), le sélecteur filtre aussi par favoris et par liste,
 * montre la bibliothèque sans recherche (`browse`) et range une fiche dans une liste sans fermer la feuille.
 */
export function ExerciseFinder({
  orgId,
  exercises,
  title,
  hint,
  said,
  suggestion,
  near,
  pickLabel,
  startInCreate = false,
  busy,
  onPick,
  onClose,
  testPrefix = "planner",
  library,
  browse = false,
}: {
  orgId: string;
  exercises: ExerciseSummary[];
  title: string;
  hint: string;
  /** Ce que le coach a dit : la recherche part de là, puis la création. */
  said?: string;
  suggestion?: Pick<PlannerSlotSuggestion, "name" | "category" | "loadKind"> | null;
  /** Les autres fiches possibles que le serveur a déjà trouvées. */
  near?: Picked[];
  pickLabel: (name: string) => string;
  startInCreate?: boolean;
  busy: boolean;
  /** La fiche choisie, trouvée ou créée ; `created` porte la fiche que l'écran ne connaissait pas encore. */
  onPick: (exercise: Picked, created?: ExerciseSummary) => void;
  onClose: () => void;
  /** Préfixe des identifiants de test : « planner » pour le planificateur, « exercise » pour le constructeur. */
  testPrefix?: string;
  library?: ExerciseListsState;
  browse?: boolean;
}) {
  const [query, setQuery] = useState(suggestion?.name ?? said ?? "");
  // Le nom que la création propose : celui du serveur pour un emplacement, ou ce que le coach vient de chercher.
  const [view, setView] = useState<View_>(
    startInCreate ? { kind: "create", name: suggestion?.name ?? said ?? "" } : { kind: "search" },
  );
  const [chosen, setChosen] = useState<LibraryFilter>({ kind: "all" });
  const filter = library ? validFilter(chosen, library.lists) : chosen;
  const term = query.trim();
  const pool = library ? exercisesInFilter(exercises, filter, library.lists) : exercises;
  const found = term
    ? plannerSearchLibrary(pool, term, LIMIT + 1)
    : browse || filter.kind !== "all"
      ? pool.slice(0, LIMIT + 1)
      : [];
  const proposals = [
    ...(near ?? []),
    ...(said ? plannerNearExercises(exercises, said, 5) : []).filter((e) => !near?.some((n) => n.id === e.id)),
  ].slice(0, 5);
  const listing = Boolean(term) || browse || filter.kind !== "all";
  return (
    <Sheet visible title={view.kind === "file" ? m.nativeExercises.lists.fileTitle(view.exercise.name) : title} onClose={onClose}>
      {view.kind === "create" ? (
        <QuickExerciseCreate
          orgId={orgId}
          exercises={exercises}
          initialName={view.name}
          term={said || term}
          suggestion={suggestion}
          busy={busy}
          testPrefix={testPrefix}
          onBack={() => setView({ kind: "search" })}
          onDone={(exercise, created) => onPick(exercise, created ? exercise : undefined)}
        />
      ) : view.kind === "file" && library ? (
        <>
          <FilePanel exercise={view.exercise} state={library} />
          <Button
            testID={`${testPrefix}-file-back`}
            compact
            variant="ghost"
            icon={ArrowLeft}
            label={m.nativeExercises.lists.back}
            onPress={() => setView({ kind: "search" })}
          />
        </>
      ) : (
        <>
          <T variant="small" tone="muted">
            {hint}
          </T>
          {proposals.length ? (
            <View style={{ gap: space.xs }}>
              <T variant="smallStrong">{t.slot.near}</T>
              {proposals.map((exercise) => (
                <Button
                  key={exercise.id}
                  compact
                  variant="secondary"
                  label={exercise.name}
                  accessibilityLabel={pickLabel(exercise.name)}
                  disabled={busy}
                  onPress={() => onPick(exercise)}
                />
              ))}
            </View>
          ) : null}
          <Field
            testID={`${testPrefix}-search`}
            label={t.finder.search}
            value={query}
            autoCorrect={false}
            returnKeyType="search"
            onChangeText={setQuery}
          />
          {library ? <LibraryFilters filter={filter} lists={library.lists} onChange={setChosen} withMine={false} /> : null}
          <T variant="small" tone="muted" accessibilityLiveRegion="polite">
            {!listing
              ? t.finder.typeToSearch
              : found.length
                ? t.finder.results(Math.min(found.length, LIMIT))
                : term
                  ? t.finder.noMatch
                  : t.finder.results(0)}
          </T>
          <View style={{ gap: space.xs }}>
            {found.slice(0, LIMIT).map((exercise) => (
              <View key={exercise.id} style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                <View style={{ flex: 1 }}>
                  <Button
                    compact
                    variant="secondary"
                    testID={`${testPrefix}-option-${exercise.id}`}
                    label={exercise.name}
                    accessibilityLabel={pickLabel(exercise.name)}
                    disabled={busy}
                    onPress={() => onPick(exercise)}
                  />
                </View>
                {library ? (
                  <IconButton
                    testID={`${testPrefix}-file-${exercise.id}`}
                    icon={ListPlus}
                    label={m.nativeExercises.lists.file(exercise.name)}
                    onPress={() => setView({ kind: "file", exercise })}
                  />
                ) : null}
              </View>
            ))}
            {found.length > LIMIT ? (
              <T variant="small" tone="muted">
                {term ? t.finder.more : m.nativeExercises.picker.more}
              </T>
            ) : null}
          </View>
          {term ? (
            <Button
              testID={`${testPrefix}-create`}
              variant="secondary"
              icon={Plus}
              label={t.finder.create(term)}
              accessibilityHint={t.finder.createHint}
              disabled={busy}
              onPress={() => setView({ kind: "create", name: term })}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}

/** Le même sélecteur, sous son nom d'origine : le planificateur l'appelle ainsi, sans rien changer. */
export const PlannerExerciseFinder = ExerciseFinder;
