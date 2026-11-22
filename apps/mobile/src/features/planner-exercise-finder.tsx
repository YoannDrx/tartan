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
import {
  plannerNearExercises,
  plannerQuickDefaults,
  plannerQuickInput,
  plannerSearchLibrary,
  type PlannerLoadChoice,
} from "../lib/planner-flow";
import { Plus, Search } from "../ui/icons";
import { Button, Field, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { space } from "../ui/theme";
import { Pill, PillRow } from "./planner-ui";

const t = m.aiPlanner.screen;
const LIMIT = 40;
type Picked = { id: string; name: string };
const loadChoices: PlannerLoadChoice[] = [...exerciseLoadKind.options, "none"];

/**
 * Créer une fiche par son nom : un champ, deux choix déjà faits, un bouton. La famille et la charge viennent de la
 * suggestion du serveur pour un emplacement, sinon de la fiche la plus proche de la bibliothèque ; elles se
 * corrigent d'un geste. Une fiche qui porte déjà ce nom n'est pas recréée : elle est proposée à la place.
 */
function QuickCreate({
  orgId,
  exercises,
  initialName,
  term,
  suggestion,
  busy,
  onDone,
  onBack,
}: {
  orgId: string;
  exercises: ExerciseSummary[];
  initialName: string;
  /** Ce que le coach a dit ou cherché : un autre nom de la fiche s'il change le nom. */
  term: string;
  suggestion?: Pick<PlannerSlotSuggestion, "name" | "category" | "loadKind"> | null;
  busy: boolean;
  onDone: (exercise: ExerciseSummary, created: boolean) => void;
  onBack: () => void;
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
  const existing = trimmed ? proposed.existing : null;
  const submit = async () => {
    if (!trimmed) return setError(t.quick.nameRequired);
    if (existing) return onDone(existing, false);
    setSending(true);
    setError("");
    try {
      const result = await api.quickCreateExercise(
        orgId,
        plannerQuickInput({ name: trimmed, term, category: shownCategory, load: shownLoad }),
      );
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
        testID="planner-quick-name"
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
          testID="planner-quick-submit"
          label={existing ? t.quick.useExisting : t.quick.submit}
          loading={sending}
          disabled={busy || sending}
          onPress={() => void submit()}
        />
        {existing ? null : (
          <T variant="small" tone="muted">
            {t.quick.later}
          </T>
        )}
        <Button compact variant="ghost" icon={Search} label={t.slot.backToSearch} onPress={onBack} />
      </View>
    </View>
  );
}

/**
 * Chercher une fiche dans toute la bibliothèque de l'espace, ou la créer sans quitter la séance. Sans recherche
 * saisie, les fiches proches du terme dit viennent d'abord ; dès qu'un terme est saisi, la dernière ligne propose
 * de créer la fiche.
 */
export function PlannerExerciseFinder({
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
}) {
  const [query, setQuery] = useState(suggestion?.name ?? said ?? "");
  // Le nom que la création propose : celui du serveur pour un emplacement, ou ce que le coach vient de chercher.
  const [creating, setCreating] = useState<string | null>(startInCreate ? (suggestion?.name ?? said ?? "") : null);
  const term = query.trim();
  const found = plannerSearchLibrary(exercises, term, LIMIT + 1);
  const proposals = [
    ...(near ?? []),
    ...(said ? plannerNearExercises(exercises, said, 5) : []).filter((e) => !near?.some((n) => n.id === e.id)),
  ].slice(0, 5);
  return (
    <Sheet visible title={title} onClose={onClose}>
      {creating !== null ? (
        <QuickCreate
          orgId={orgId}
          exercises={exercises}
          initialName={creating}
          term={said || term}
          suggestion={suggestion}
          busy={busy}
          onBack={() => setCreating(null)}
          onDone={(exercise, created) => onPick(exercise, created ? exercise : undefined)}
        />
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
            testID="planner-exercise-search"
            label={t.finder.search}
            value={query}
            autoCorrect={false}
            returnKeyType="search"
            onChangeText={setQuery}
          />
          <T variant="small" tone="muted" accessibilityLiveRegion="polite">
            {!term
              ? t.finder.typeToSearch
              : found.length
                ? t.finder.results(Math.min(found.length, LIMIT))
                : t.finder.noMatch}
          </T>
          <View style={{ gap: space.xs }}>
            {found.slice(0, LIMIT).map((exercise) => (
              <Button
                key={exercise.id}
                compact
                variant="secondary"
                testID={`planner-exercise-option-${exercise.id}`}
                label={exercise.name}
                accessibilityLabel={pickLabel(exercise.name)}
                disabled={busy}
                onPress={() => onPick(exercise)}
              />
            ))}
            {found.length > LIMIT ? (
              <T variant="small" tone="muted">
                {t.finder.more}
              </T>
            ) : null}
          </View>
          {term ? (
            <Button
              testID="planner-exercise-create"
              variant="secondary"
              icon={Plus}
              label={t.finder.create(term)}
              accessibilityHint={t.finder.createHint}
              disabled={busy}
              onPress={() => setCreating(term)}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}
