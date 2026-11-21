"use client";

import type { ExerciseList } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ListPlus, Star } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { createListAction, setFavoriteAction, setListMembershipAction } from "./exercise.action";

const t = w.exercises;

/**
 * Les listes vues par ce coach, avec ses changements appliqués tout de suite : l'étoile et la coche répondent sans
 * attendre le serveur, qui confirme ensuite. Un refus remet l'état d'avant et le dit.
 */
export const useExerciseLists = (initial: ExerciseList[]) => {
  const [source, setSource] = useState(initial);
  const [lists, setLists] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setLists(initial);
  }
  const favorites = lists.find((list) => list.isFavorites && list.mine) ?? null;
  const favorite = useAction(setFavoriteAction);
  const membership = useAction(setListMembershipAction);

  const patch = (listId: string, exerciseId: string, member: boolean) =>
    setLists((current) =>
      current.map((list) =>
        list.id !== listId
          ? list
          : {
              ...list,
              exerciseIds: member
                ? [...list.exerciseIds.filter((id) => id !== exerciseId), exerciseId]
                : list.exerciseIds.filter((id) => id !== exerciseId),
            },
      ),
    );

  const isFavorite = (exerciseId: string) => favorites?.exerciseIds.includes(exerciseId) ?? false;

  const toggleFavorite = async (exerciseId: string) => {
    const next = !isFavorite(exerciseId);
    const before = lists;
    if (favorites) patch(favorites.id, exerciseId, next);
    else
      // La première étoile crée la liste : elle s'affiche aussitôt, son identifiant arrive avec la confirmation.
      setLists((current) => [
        {
          id: "favorites",
          name: t.filters.favorites,
          position: 0,
          isFavorites: true,
          sharedWithCoaches: false,
          mine: true,
          ownerName: null,
          exerciseIds: [exerciseId],
        },
        ...current,
      ]);
    const result = await favorite.executeAsync({ exerciseId, favorite: next });
    if (result?.serverError || result?.validationErrors) {
      setLists(before);
      toast.error(result.serverError ?? m.errors.invalid);
      return;
    }
    toast.ok(next ? t.favorite.added : t.favorite.removed);
  };

  const setMember = async (listId: string, exerciseId: string, member: boolean) => {
    const before = lists;
    patch(listId, exerciseId, member);
    const result = await membership.executeAsync({ listId, exerciseId, member });
    if (result?.serverError || result?.validationErrors) {
      setLists(before);
      toast.error(result.serverError ?? m.errors.invalid);
      return false;
    }
    return true;
  };

  return { lists, setLists, favorites, isFavorite, toggleFavorite, setMember };
};

export type ExerciseListsState = ReturnType<typeof useExerciseLists>;

export const FavoriteButton = ({ name, active, onToggle }: { name: string; active: boolean; onToggle: () => void }) => (
  <IconButton label={active ? t.favorite.remove(name) : t.favorite.add(name)} aria-pressed={active} onClick={onToggle}>
    <Star aria-hidden className={cn("size-5", active && "fill-current")} />
  </IconButton>
);

export const FileButton = ({ name, onClick }: { name: string; onClick: () => void }) => (
  <IconButton label={t.lists.file(name)} onClick={onClick}>
    <ListPlus aria-hidden className="size-5" />
  </IconButton>
);

/** Créer une liste : depuis la bibliothèque, ou en rangeant une fiche. */
export const NewListForm = ({ onCreated }: { onCreated: (list: { id: string; name: string }) => void }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useAction(createListAction, {
    onSuccess: ({ data, input }) => {
      if (!data) return;
      toast.ok(t.lists.created(input.name));
      setName("");
      onCreated({ id: data.id, name: input.name.trim() });
    },
    onError: ({ error: e }) =>
      setError(
        e.serverError ??
          (e.validationErrors as { name?: { _errors?: string[] } } | undefined)?.name?._errors?.[0] ??
          m.errors.invalid,
      ),
  });
  return (
    <form
      noValidate
      className="flex flex-col gap-3 tablet:flex-row tablet:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        create.execute({ name });
      }}
    >
      <Field label={t.lists.name} error={error ?? undefined} className="flex-1">
        {(a) => <Input {...a} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={create.isPending}>
        {t.lists.create}
      </Button>
    </form>
  );
};

/** Ranger une fiche : une case par liste du coach, et la création d'une liste sans quitter la feuille. */
export const FileDialog = ({
  exercise,
  state,
  onClose,
}: {
  exercise: { id: string; name: string } | null;
  state: ExerciseListsState;
  onClose: () => void;
}) => {
  const own = state.lists.filter((list) => list.mine && !list.isFavorites);
  return (
    <Dialog
      open={exercise !== null}
      onOpenChange={(open) => !open && onClose()}
      title={exercise ? t.lists.fileTitle(exercise.name) : t.lists.new}
      description={t.lists.fileHint}
    >
      {exercise ? (
        <div className="flex flex-col gap-4">
          {own.length === 0 ? <p className="text-soft">{t.lists.none}</p> : null}
          <ul className="flex flex-col divide-y divide-card-line">
            {own.map((list) => (
              <li key={list.id}>
                <label className="flex min-h-12 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={list.exerciseIds.includes(exercise.id)}
                    onChange={(event) => void state.setMember(list.id, exercise.id, event.target.checked)}
                  />
                  <span className="font-semibold">{list.name}</span>
                  <span className="t-caption ml-auto text-soft">{t.results(list.exerciseIds.length)}</span>
                </label>
              </li>
            ))}
          </ul>
          <NewListForm
            onCreated={async (created) => {
              state.setLists((current) => [
                ...current,
                {
                  ...created,
                  position: current.length,
                  isFavorites: false,
                  sharedWithCoaches: false,
                  mine: true,
                  ownerName: null,
                  exerciseIds: [],
                },
              ]);
              await state.setMember(created.id, exercise.id, true);
            }}
          />
        </div>
      ) : null}
    </Dialog>
  );
};
