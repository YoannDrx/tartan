"use client";

import type { ExerciseFilter, ExerciseList, ExerciseSheet, ExerciseSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ArrowLeft, GripVertical, Plus, Search } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { exerciseSheetAction, searchExercisesAction } from "@/features/exercises/exercise.action";
import { FilterChips } from "@/features/exercises/exercise-filters";
import { FavoriteButton, FileButton, FileDialog, useExerciseLists } from "@/features/exercises/exercise-lists-ui";
import { ExerciseDetail } from "@/features/exercises/exercise-sheet";
import { GestureThumb } from "@/features/exercises/gesture-thumb";
import { cn } from "@/lib/cn";

const labels = m.builder.sequence;
const t = w.exercises;
const PAGE = 40;
// Le temps de finir un mot avant de chercher.
const TYPING_MS = 200;

/**
 * Le constructeur ne reçoit plus la bibliothèque : les fiches arrivent à la demande. Chaque fiche chargée est
 * confiée au constructeur (`remember`), qui en a besoin pour nommer et prescrire ce qu'on ajoute.
 */
export const ExerciseSource = createContext<{
  lists: ExerciseList[];
  remember: (exercises: ExerciseSummary[]) => void;
}>({ lists: [], remember: () => undefined });

/** Une recherche dans la bibliothèque, côté serveur, par tranches. */
const useExerciseSearch = (active: boolean, filter: ExerciseFilter, q: string) => {
  const { remember } = useContext(ExerciseSource);
  const [items, setItems] = useState<ExerciseSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const search = useAction(searchExercisesAction);
  const latest = useRef(0);
  const run = async (offset: number) => {
    const ticket = ++latest.current;
    setFailed(false);
    const result = await search.executeAsync({ q, filter, offset, limit: PAGE });
    if (ticket !== latest.current) return;
    if (!result?.data) return setFailed(true);
    remember(result.data.items);
    setItems((current) => (offset === 0 ? result.data!.items : [...current, ...result.data!.items]));
    setTotal(result.data.total);
  };
  const key = JSON.stringify({ filter, q, attempt });
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => void run(0), q ? TYPING_MS : 0);
    return () => clearTimeout(timer);
    // `run` lit le filtre et la recherche du rendu courant : la clé suffit à relancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
  return {
    items,
    total,
    failed,
    loading: search.isPending,
    more: () => run(items.length),
    retry: () => setAttempt((n) => n + 1),
  };
};

// L'aperçu d'une fiche dans le constructeur : la même fiche que dans la bibliothèque, chargée à la demande.
const Preview = ({
  id,
  onBack,
  action,
}: {
  id: string;
  onBack: () => void;
  action: (exercise: ExerciseSummary) => ReactNode;
}) => {
  const { lists } = useContext(ExerciseSource);
  const state = useExerciseLists(lists);
  const [sheet, setSheet] = useState<ExerciseSheet | null>(null);
  const [filing, setFiling] = useState(false);
  const load = useAction(exerciseSheetAction, { onSuccess: ({ data }) => data && setSheet(data) });
  useEffect(() => {
    load.execute({ id });
    // Une fiche par ouverture de l'aperçu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Button size="sm" variant="quiet" className="self-start" onClick={onBack}>
        <ArrowLeft aria-hidden className="size-4" />
        {t.picker.back}
      </Button>
      {sheet ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="t-h2 min-w-0 flex-1 break-words">{sheet.name}</h3>
            <FavoriteButton
              name={sheet.name}
              active={state.favorites ? state.isFavorite(sheet.id) : sheet.favorite}
              onToggle={() => void state.toggleFavorite(sheet.id)}
            />
            <FileButton name={sheet.name} onClick={() => setFiling(true)} />
            {action(sheet)}
          </div>
          <ExerciseDetail exercise={sheet} variants={sheet.variants} />
          <FileDialog exercise={filing ? sheet : null} state={state} onClose={() => setFiling(false)} />
        </>
      ) : load.hasErrored ? (
        <p role="alert">{t.loadFailed}</p>
      ) : (
        <p className="text-soft">{t.loading}</p>
      )}
    </div>
  );
};

/**
 * Chercher et filtrer la bibliothèque : la même recherche dans le panneau du constructeur et dans sa feuille.
 * Favoris, listes et familles partagent un seul système de pastilles ; chaque fiche a sa vignette.
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
  onPick: (exercise: ExerciseSummary) => void;
}) => {
  const { lists } = useContext(ExerciseSource);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ExerciseFilter>({ kind: "all" });
  const [previewing, setPreviewing] = useState<string | null>(null);
  const found = useExerciseSearch(active, filter, q);
  const add = (exercise: ExerciseSummary) => (
    <IconButton label={addLabel(exercise.name)} tone="brand" onClick={() => onPick(exercise)}>
      <Plus aria-hidden className="size-5" />
    </IconButton>
  );
  if (previewing) return <Preview id={previewing} onBack={() => setPreviewing(null)} action={add} />;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">{labels.searchExercise}</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-soft" />
        <Input
          type="search"
          autoFocus={autoFocus}
          className="pl-10"
          placeholder={labels.searchExercise}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <FilterChips scroll filter={filter} lists={lists} onChange={setFilter} />
      <p className="t-caption text-soft" aria-live="polite">
        {found.total === null ? t.loading : t.results(found.total)}
      </p>
      {found.failed ? (
        <p role="alert" className="flex flex-wrap items-center gap-2">
          {t.loadFailed}
          <Button size="sm" variant="secondary" onClick={found.retry}>
            {t.retry}
          </Button>
        </p>
      ) : null}
      <ul className="-mx-1 flex flex-col divide-y divide-card-line">
        {found.items.map((exercise) => (
          <li
            key={exercise.id}
            draggable={draggable}
            onDragStart={draggable ? (ev) => ev.dataTransfer.setData("text/exercise-id", exercise.id) : undefined}
            className={cn("flex items-center gap-2 px-1 py-1", draggable && "cursor-grab active:cursor-grabbing")}
          >
            {draggable ? <GripVertical aria-hidden className="size-4 shrink-0 text-st-upcoming" /> : null}
            <button
              type="button"
              onClick={() => setPreviewing(exercise.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-thumb text-left hover:bg-raise"
            >
              <GestureThumb motionKey={exercise.motionKey} category={exercise.category} className="size-12" />
              <span className="flex min-w-0 flex-col leading-snug">
                <span className="break-words font-semibold">{exercise.name}</span>
                <span className="t-caption font-normal text-soft">
                  {exercise.family ? m.exerciseGuide.families[exercise.family] : null}
                  {/* Le nom accessible commence par ce qui se voit (WCAG 2.5.3), puis dit ce que fait le bouton. */}
                  <span className="sr-only">, {t.picker.previewAction}</span>
                </span>
              </span>
            </button>
            {add(exercise)}
          </li>
        ))}
      </ul>
      {found.total !== null && found.items.length < found.total ? (
        <Button size="sm" variant="secondary" className="self-center" disabled={found.loading} onClick={found.more}>
          {t.showMore(Math.min(PAGE, found.total - found.items.length))}
        </Button>
      ) : null}
      {found.total === 0 ? (
        <p className="text-soft">
          {labels.noResult}{" "}
          <Link href="/exercices?nouveau=1" className="font-semibold underline">
            {labels.createInLibrary}
          </Link>
        </p>
      ) : null}
    </div>
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
  onPick: (exercise: ExerciseSummary) => void;
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
