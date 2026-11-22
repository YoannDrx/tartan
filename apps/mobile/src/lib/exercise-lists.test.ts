import type { ExerciseList } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import {
  canCreateIn,
  exercisesInFilter,
  favoritesOf,
  isFavorite,
  ownLists,
  PENDING_FAVORITES_ID,
  sharedLists,
  validFilter,
  withFavorite,
  withMembership,
  withNewList,
} from "./exercise-lists";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const list = (over: Partial<ExerciseList>): ExerciseList => ({
  id: id(100),
  name: "Liste",
  position: 1,
  isFavorites: false,
  sharedWithCoaches: false,
  mine: true,
  ownerName: null,
  exerciseIds: [],
  ...over,
});
const favorites = list({ id: id(90), name: "Favoris", position: 0, isFavorites: true, exerciseIds: [id(1)] });
const sprints = list({ id: id(91), name: "Sprints", exerciseIds: [id(3), id(1)] });
const shared = list({ id: id(92), name: "Pliométrie", mine: false, ownerName: "Camille", exerciseIds: [id(2)] });
const exercises = [
  { id: id(1), name: "Squat", shared: true },
  { id: id(2), name: "Bonds", shared: true },
  { id: id(3), name: "Départs", shared: false },
];

describe("listes du coach", () => {
  it("lit les favoris et distingue les listes du coach de celles qu'on lui partage", () => {
    const lists = [favorites, sprints, shared];
    expect(favoritesOf(lists)?.id).toBe(id(90));
    expect(isFavorite(lists, id(1))).toBe(true);
    expect(isFavorite(lists, id(2))).toBe(false);
    expect(ownLists(lists).map((l) => l.name)).toEqual(["Sprints"]);
    expect(sharedLists(lists).map((l) => l.name)).toEqual(["Pliométrie"]);
  });

  it("une liste partagée par un autre coach ne compte jamais comme Favoris du lecteur", () => {
    const theirs = list({ id: id(93), isFavorites: true, mine: false, exerciseIds: [id(2)] });
    expect(favoritesOf([theirs])).toBeNull();
    expect(isFavorite([theirs], id(2))).toBe(false);
  });

  it("la première étoile crée les Favoris tout de suite, en tête des listes", () => {
    const next = withFavorite([sprints], id(2), true, "Favoris");
    expect(next[0]).toMatchObject({ id: PENDING_FAVORITES_ID, isFavorites: true, mine: true, exerciseIds: [id(2)] });
    expect(next).toHaveLength(2);
    // Retirer une étoile sans Favoris ne crée rien.
    expect(withFavorite([sprints], id(2), false, "Favoris")).toEqual([sprints]);
  });

  it("ajoute et retire une fiche d'une liste sans la doubler", () => {
    const added = withMembership([sprints], sprints.id, id(1), true);
    expect(added[0]!.exerciseIds).toEqual([id(3), id(1)]);
    const removed = withMembership(added, sprints.id, id(3), false);
    expect(removed[0]!.exerciseIds).toEqual([id(1)]);
    expect(withFavorite([favorites], id(1), false, "Favoris")[0]!.exerciseIds).toEqual([]);
  });

  it("une liste créée arrive vide, à la fin, privée", () => {
    const next = withNewList([favorites], { id: id(94), name: "Haies" });
    expect(next.at(-1)).toMatchObject({ name: "Haies", mine: true, sharedWithCoaches: false, exerciseIds: [] });
  });
});

describe("filtres de la bibliothèque", () => {
  const lists = [favorites, sprints, shared];

  it("garde l'ordre de la liste et ignore une fiche sortie de la bibliothèque", () => {
    const withGone = withMembership(lists, sprints.id, id(99), true);
    expect(exercisesInFilter(exercises, { kind: "list", listId: sprints.id }, withGone).map((e) => e.name)).toEqual([
      "Départs",
      "Squat",
    ]);
  });

  it("filtre les favoris, les fiches de l'espace et une liste partagée", () => {
    expect(exercisesInFilter(exercises, { kind: "favorites" }, lists).map((e) => e.name)).toEqual(["Squat"]);
    expect(exercisesInFilter(exercises, { kind: "mine" }, lists).map((e) => e.name)).toEqual(["Départs"]);
    expect(exercisesInFilter(exercises, { kind: "list", listId: shared.id }, lists).map((e) => e.name)).toEqual([
      "Bonds",
    ]);
    expect(exercisesInFilter(exercises, { kind: "all" }, lists)).toHaveLength(3);
    expect(exercisesInFilter(exercises, { kind: "favorites" }, [sprints])).toEqual([]);
  });

  it("revient à « Tout » quand la liste filtrée a disparu", () => {
    expect(validFilter({ kind: "list", listId: id(55) }, lists)).toEqual({ kind: "all" });
    expect(validFilter({ kind: "list", listId: sprints.id }, lists)).toEqual({ kind: "list", listId: sprints.id });
  });

  it("ne propose la création que dans une liste du coach", () => {
    expect(canCreateIn({ kind: "list", listId: sprints.id }, lists)?.name).toBe("Sprints");
    expect(canCreateIn({ kind: "list", listId: shared.id }, lists)).toBeNull();
    expect(canCreateIn({ kind: "favorites" }, lists)).toBeNull();
    expect(canCreateIn({ kind: "all" }, lists)).toBeNull();
  });
});
