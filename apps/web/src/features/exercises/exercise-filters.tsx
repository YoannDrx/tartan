"use client";

import { exerciseFamily, type ExerciseFilter, type ExerciseList } from "@tartan/contracts";
import { matchesExerciseSearch, sortExercises } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const t = w.exercises;

// Une pastille de filtre : 44 px de haut, pleine quand elle est choisie.
export const chipClass = (active: boolean) =>
  cn(
    "inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[15px]",
    active
      ? "bg-accent font-semibold text-on-accent"
      : "border border-pill-line bg-pill-off font-medium text-inherit hover:bg-raise",
  );

// Sur téléphone, chaque rangée défile de côté : les listes, puis les familles, sur deux lignes en tout.
// Plus large, les pastilles passent à la ligne.
// Dans une colonne étroite (le constructeur), elles défilent toujours.
const row = (scroll: boolean) =>
  scroll
    ? "-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 py-0.5"
    : "flex items-center gap-1.5 max-tablet:-mx-4 max-tablet:overflow-x-auto max-tablet:px-4 max-tablet:py-0.5 tablet:flex-wrap";

const sameFilter = (a: ExerciseFilter, b: ExerciseFilter) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Un seul système de filtres, choix unique : tout, Favoris, chaque liste, les fiches de l'espace, puis chaque
 * famille. La bibliothèque et le sélecteur du constructeur l'affichent de la même façon.
 */
export const FilterChips = ({
  filter,
  lists,
  onChange,
  after,
  scroll = false,
}: {
  scroll?: boolean;
  filter: ExerciseFilter;
  lists: ExerciseList[];
  onChange: (filter: ExerciseFilter) => void;
  after?: ReactNode;
}) => {
  const chip = (value: ExerciseFilter, label: string, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={sameFilter(filter, value)}
      className={chipClass(sameFilter(filter, value))}
      onClick={() => onChange(value)}
    >
      <span className="truncate">{label}</span>
    </button>
  );
  return (
    <div role="group" aria-label={t.filters.label} className="flex flex-col gap-2">
      <div className={row(scroll)}>
        {chip({ kind: "all" }, t.filters.all, "all")}
        {chip({ kind: "favorites" }, t.filters.favorites, "favorites")}
        {lists
          .filter((list) => !list.isFavorites)
          .map((list) =>
            chip(
              { kind: "list", listId: list.id },
              list.mine ? list.name : t.filters.sharedBy(list.name, list.ownerName ?? ""),
              list.id,
            ),
          )}
        {chip({ kind: "mine" }, t.filters.mine, "mine")}
        {after}
      </div>
      <div className={row(scroll)}>
        {exerciseFamily.options.map((family) =>
          chip({ kind: "family", family }, m.exerciseGuide.families[family], family),
        )}
      </div>
    </div>
  );
};

/** Les fiches qu'un filtre et une recherche retiennent, dans l'ordre d'affichage. */
export const filterRows = <
  R extends { id: string; name: string; aliases?: string[]; family?: string | null; shared: boolean },
>(
  rows: readonly R[],
  filter: ExerciseFilter,
  search: string,
  lists: ExerciseList[],
) => {
  const order =
    filter.kind === "favorites"
      ? (lists.find((list) => list.isFavorites && list.mine)?.exerciseIds ?? [])
      : filter.kind === "list"
        ? (lists.find((list) => list.id === filter.listId)?.exerciseIds ?? [])
        : undefined;
  const inOrder = order ? new Set(order) : null;
  const kept = rows.filter(
    (row) =>
      (!inOrder || inOrder.has(row.id)) &&
      (filter.kind !== "mine" || !row.shared) &&
      (filter.kind !== "family" || row.family === filter.family) &&
      matchesExerciseSearch(row, search),
  );
  return sortExercises(kept, search, order);
};
