import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExerciseList } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import {
  favoritesOf,
  isFavorite,
  ownLists,
  withFavorite,
  withMembership,
  withNewList,
  type LibraryFilter,
} from "../lib/exercise-lists";
import { Square, SquareCheck, Star } from "../ui/icons";
import { Button, Chip, Divider, Field, ListSurface, T } from "../ui/primitives";
import { radius, space, TOUCH, usePalette } from "../ui/theme";

const t = m.nativeExercises;
const key = (orgId: string) => ["exercise-lists", orgId] as const;

/**
 * Les listes vues par ce coach. L'étoile et la coche changent l'écran tout de suite ; le serveur confirme ensuite.
 * Un refus remet l'état d'avant et le dit, à l'écran comme au lecteur d'écran.
 */
export const useExerciseLists = (orgId: string, enabled = true) => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key(orgId),
    queryFn: () => api.exerciseLists(orgId),
    enabled: Boolean(orgId) && enabled,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const lists = query.data ?? [];

  const optimistic = async (next: (current: ExerciseList[]) => ExerciseList[], send: () => Promise<unknown>) => {
    const before = client.getQueryData<ExerciseList[]>(key(orgId)) ?? [];
    client.setQueryData(key(orgId), next(before));
    setProblem(null);
    try {
      await send();
      return true;
    } catch (cause) {
      client.setQueryData(key(orgId), before);
      const message = errorMessage(cause) || t.lists.failed;
      setProblem(message);
      AccessibilityInfo.announceForAccessibility(message);
      return false;
    }
  };

  const toggleFavorite = async (exercise: { id: string; name: string }) => {
    const next = !isFavorite(lists, exercise.id);
    const hadFavorites = Boolean(favoritesOf(lists));
    const ok = await optimistic(
      (current) => withFavorite(current, exercise.id, next, t.filters.favorites),
      () => api.setFavorite(orgId, exercise.id, next),
    );
    if (!ok) return;
    AccessibilityInfo.announceForAccessibility(next ? t.favorite.added : t.favorite.removed);
    // La première étoile a créé la liste : son identifiant vient du serveur.
    if (!hadFavorites) void client.invalidateQueries({ queryKey: key(orgId) });
  };

  const setMember = async (list: ExerciseList, exercise: { id: string }, member: boolean) => {
    const ok = await optimistic(
      (current) => withMembership(current, list.id, exercise.id, member),
      () => api.setListMembership(orgId, list.id, exercise.id, member),
    );
    if (ok) AccessibilityInfo.announceForAccessibility(member ? t.lists.added(list.name) : t.lists.removed(list.name));
    return ok;
  };

  const createList = async (name: string): Promise<ExerciseList | string> => {
    try {
      const created = await api.createExerciseList(orgId, name.trim());
      const next = withNewList(client.getQueryData<ExerciseList[]>(key(orgId)) ?? [], {
        id: created.id,
        name: name.trim(),
      });
      client.setQueryData(key(orgId), next);
      AccessibilityInfo.announceForAccessibility(t.lists.created(name.trim()));
      return next.at(-1)!;
    } catch (cause) {
      return errorMessage(cause) || t.lists.failed;
    }
  };

  return {
    query,
    lists,
    problem,
    isFavorite: (exerciseId: string) => isFavorite(lists, exerciseId),
    toggleFavorite,
    setMember,
    createList,
    refresh: () => client.invalidateQueries({ queryKey: key(orgId) }),
  };
};

export type ExerciseListsState = ReturnType<typeof useExerciseLists>;

/** L'étoile d'une fiche : 44 points, pleine quand la fiche est en favori. */
export const FavoriteToggle = ({
  name,
  active,
  onToggle,
  testID,
}: {
  name: string;
  active: boolean;
  onToggle: () => void;
  testID?: string;
}) => {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={active ? t.favorite.remove(name) : t.favorite.add(name)}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        width: TOUCH,
        height: TOUCH,
        borderRadius: TOUCH / 2,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Star
        size={22}
        color={active ? p.accent : p.text}
        fill={active ? p.accent : "none"}
        strokeWidth={2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
};

/** Les filtres de la bibliothèque et du sélecteur : tout, les favoris, chaque liste, puis les fiches de l'espace. */
export const LibraryFilters = ({
  filter,
  lists,
  onChange,
  withMine = true,
}: {
  filter: LibraryFilter;
  lists: readonly ExerciseList[];
  onChange: (filter: LibraryFilter) => void;
  withMine?: boolean;
}) => {
  const listed = lists.filter((list) => !list.isFavorites || !list.mine);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t.filters.label}
      contentContainerStyle={{ gap: space.sm }}
    >
      <Chip
        testID="library-filter-all"
        tall
        label={t.filters.all}
        active={filter.kind === "all"}
        onPress={() => onChange({ kind: "all" })}
      />
      <Chip
        testID="library-filter-favorites"
        tall
        label={t.filters.favorites}
        active={filter.kind === "favorites"}
        onPress={() => onChange({ kind: "favorites" })}
      />
      {listed.map((list) => (
        <Chip
          key={list.id}
          testID={`library-filter-list-${list.id}`}
          tall
          label={list.mine || !list.ownerName ? list.name : t.filters.sharedBy(list.name, list.ownerName)}
          active={filter.kind === "list" && filter.listId === list.id}
          onPress={() => onChange({ kind: "list", listId: list.id })}
        />
      ))}
      {withMine ? (
        <Chip
          testID="library-filter-mine"
          tall
          label={t.filters.mine}
          active={filter.kind === "mine"}
          onPress={() => onChange({ kind: "mine" })}
        />
      ) : null}
    </ScrollView>
  );
};

/** Créer une liste : un nom, un bouton. L'erreur du serveur reste sous le champ, la saisie aussi. */
export const NewListForm = ({
  state,
  onCreated,
}: {
  state: ExerciseListsState;
  onCreated: (list: ExerciseList) => void;
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!name.trim()) return setError(t.lists.nameRequired);
    setSending(true);
    const result = await state.createList(name);
    setSending(false);
    if (typeof result === "string") return setError(result);
    setName("");
    setError(null);
    onCreated(result);
  };
  return (
    <View style={{ gap: space.sm }}>
      <Field
        testID="exercise-list-name"
        label={t.lists.name}
        value={name}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        error={error}
      />
      <Button
        testID="exercise-list-create"
        variant="secondary"
        label={t.lists.create}
        loading={sending}
        disabled={sending}
        onPress={() => void submit()}
      />
    </View>
  );
};

/** Une case par liste du coach, et la création d'une liste sans quitter la feuille. */
export const FilePanel = ({
  exercise,
  state,
}: {
  exercise: { id: string; name: string };
  state: ExerciseListsState;
}) => {
  const p = usePalette();
  const own = ownLists(state.lists);
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <FavoriteToggle
          testID="exercise-favorite-toggle"
          name={exercise.name}
          active={state.isFavorite(exercise.id)}
          onToggle={() => void state.toggleFavorite(exercise)}
        />
        <T variant="smallStrong">{t.favorite.on}</T>
      </View>
      <T variant="small" tone="muted">
        {own.length === 0 ? t.lists.none : t.lists.fileHint}
      </T>
      {own.length > 0 ? (
        <ListSurface>
          {own.map((list, index) => {
            const member = list.exerciseIds.includes(exercise.id);
            const Box = member ? SquareCheck : Square;
            return (
              <View key={list.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  testID={`exercise-list-toggle-${list.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: member }}
                  accessibilityLabel={`${list.name}, ${t.lists.count(list.exerciseIds.length)}`}
                  onPress={() => void state.setMember(list, exercise, !member)}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    paddingHorizontal: space.lg,
                    borderRadius: radius.thumb,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Box
                    size={22}
                    color={member ? p.accent : p.text}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <T variant="bodyStrong" style={{ flex: 1 }}>
                    {list.name}
                  </T>
                  <T variant="small" tone="muted">
                    {t.lists.count(list.exerciseIds.length)}
                  </T>
                </Pressable>
              </View>
            );
          })}
        </ListSurface>
      ) : null}
      {state.problem ? (
        <T tone="danger" accessibilityLiveRegion="assertive">
          {state.problem}
        </T>
      ) : null}
      <NewListForm state={state} onCreated={(list) => void state.setMember(list, exercise, true)} />
    </View>
  );
};
