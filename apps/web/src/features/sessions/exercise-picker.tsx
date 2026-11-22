"use client";

import type { ExerciseList, ExerciseSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { createContext, useContext } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ExerciseFinder, type ExercisePickOrigin } from "@/features/exercises/exercise-finder";

const labels = m.builder.sequence;

/**
 * Le constructeur ne reçoit plus la bibliothèque : les fiches arrivent à la demande. Chaque fiche chargée ou créée
 * est confiée au constructeur (`remember`), qui en a besoin pour nommer et prescrire ce qu'on ajoute.
 */
export const ExerciseSource = createContext<{
  lists: ExerciseList[];
  remember: (exercises: ExerciseSummary[]) => void;
}>({ lists: [], remember: () => undefined });

/**
 * La bibliothèque dans le constructeur : la même recherche dans son panneau et dans sa feuille. Une fiche qui
 * manque se crée ici, sans quitter la séance ; elle se complète plus tard, dans un autre onglet.
 */
export const LibraryBrowser = ({
  active = true,
  draggable = false,
  autoFocus = false,
  addLabel,
  onPick,
}: {
  active?: boolean;
  draggable?: boolean;
  autoFocus?: boolean;
  addLabel: (name: string) => string;
  onPick: (exercise: ExerciseSummary, origin: ExercisePickOrigin) => void;
}) => {
  const { lists, remember } = useContext(ExerciseSource);
  return (
    <ExerciseFinder
      lists={lists}
      active={active}
      draggable={draggable}
      autoFocus={autoFocus}
      pickLabel={addLabel}
      onPick={onPick}
      onLoaded={remember}
      completeInNewTab
    />
  );
};

/** Le même sélecteur à chaque emplacement : recherche, Favoris, listes et familles, ajout à l'endroit choisi. */
export function ExercisePicker({
  open,
  onOpenChange,
  destination,
  title,
  inGroup,
  onPick,
  addLabel = labels.add,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  /** Un autre titre que « Ajouter dans … », pour un remplacement. */
  title?: string;
  inGroup: boolean;
  onPick: (exercise: ExerciseSummary, origin: ExercisePickOrigin) => void;
  addLabel?: (name: string) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title ?? labels.pickerTitle(destination)} wide>
      <div className="flex flex-col gap-3">
        {inGroup ? <p className="t-caption text-soft">{labels.pickerGroupHint}</p> : null}
        {/* Chaque ouverture repart d'une recherche vide : la précédente visait un autre emplacement. */}
        {open ? <LibraryBrowser autoFocus addLabel={addLabel} onPick={onPick} /> : null}
      </div>
    </Dialog>
  );
}
