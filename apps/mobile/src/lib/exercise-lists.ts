import type { ExerciseList } from "@tartan/contracts";

// Les listes du coach sur l'app native, comme sur le web : ses Favoris, ses listes, et celles que d'autres coachs de
// l'espace partagent en lecture seule. Module pur : l'écran applique ces changements tout de suite, le serveur
// confirme ensuite, un refus remet l'état d'avant.

export type LibraryFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "mine" }
  | { kind: "list"; listId: string };

// La liste Favoris n'existe qu'à la première étoile : avant la confirmation du serveur, elle porte cet identifiant.
export const PENDING_FAVORITES_ID = "favorites";

export const favoritesOf = (lists: readonly ExerciseList[]) => lists.find((list) => list.isFavorites && list.mine) ?? null;

export const isFavorite = (lists: readonly ExerciseList[], exerciseId: string) =>
  favoritesOf(lists)?.exerciseIds.includes(exerciseId) ?? false;

// Les listes où le coach range ses fiches : les siennes, hors Favoris.
export const ownLists = (lists: readonly ExerciseList[]) => lists.filter((list) => list.mine && !list.isFavorites);

// Les listes partagées par un autre coach, à lire seulement.
export const sharedLists = (lists: readonly ExerciseList[]) => lists.filter((list) => !list.mine);

export const withMembership = (
  lists: readonly ExerciseList[],
  listId: string,
  exerciseId: string,
  member: boolean,
): ExerciseList[] =>
  lists.map((list) =>
    list.id !== listId
      ? list
      : {
          ...list,
          exerciseIds: member
            ? [...list.exerciseIds.filter((id) => id !== exerciseId), exerciseId]
            : list.exerciseIds.filter((id) => id !== exerciseId),
        },
  );

export const withFavorite = (
  lists: readonly ExerciseList[],
  exerciseId: string,
  favorite: boolean,
  favoritesName: string,
): ExerciseList[] => {
  const favorites = favoritesOf(lists);
  if (favorites) return withMembership(lists, favorites.id, exerciseId, favorite);
  if (!favorite) return [...lists];
  return [
    {
      id: PENDING_FAVORITES_ID,
      name: favoritesName,
      position: 0,
      isFavorites: true,
      sharedWithCoaches: false,
      mine: true,
      ownerName: null,
      exerciseIds: [exerciseId],
    },
    ...lists,
  ];
};

export const withNewList = (lists: readonly ExerciseList[], created: { id: string; name: string }): ExerciseList[] => [
  ...lists,
  {
    id: created.id,
    name: created.name,
    position: lists.length,
    isFavorites: false,
    sharedWithCoaches: false,
    mine: true,
    ownerName: null,
    exerciseIds: [],
  },
];

// Le filtre ne vise qu'une liste encore visible : une liste supprimée ou plus partagée ramène à « Tout ».
export const validFilter = (filter: LibraryFilter, lists: readonly ExerciseList[]): LibraryFilter =>
  filter.kind === "list" && !lists.some((list) => list.id === filter.listId) ? { kind: "all" } : filter;

export const listOf = (filter: LibraryFilter, lists: readonly ExerciseList[]) =>
  filter.kind === "list"
    ? (lists.find((list) => list.id === filter.listId) ?? null)
    : filter.kind === "favorites"
      ? favoritesOf(lists)
      : null;

/**
 * Les fiches d'un filtre. Une liste, comme les Favoris, garde son ordre ; une fiche qui n'est plus dans la bibliothèque
 * n'y figure pas. « Mes fiches » : celles de l'espace, hors bibliothèque commune.
 */
export const exercisesInFilter = <T extends { id: string; shared?: boolean }>(
  exercises: readonly T[],
  filter: LibraryFilter,
  lists: readonly ExerciseList[],
): T[] => {
  if (filter.kind === "all") return [...exercises];
  if (filter.kind === "mine") return exercises.filter((exercise) => !exercise.shared);
  const list = listOf(filter, lists);
  if (!list) return [];
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return list.exerciseIds.flatMap((id) => {
    const exercise = byId.get(id);
    return exercise ? [exercise] : [];
  });
};

// Ce qu'un coach peut faire dans le filtre courant : créer une fiche directement dans une liste à lui.
export const canCreateIn = (filter: LibraryFilter, lists: readonly ExerciseList[]) => {
  const list = listOf(filter, lists);
  return filter.kind === "list" && list !== null && list.mine && !list.isFavorites ? list : null;
};
