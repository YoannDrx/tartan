"use client";

import {
  exerciseCategory,
  exerciseLoadKind,
  type ExerciseCategory,
  type ExerciseDefaultsResult,
  type ExerciseFamily,
  type ExerciseFilter,
  type ExerciseList,
  type ExerciseLoadKind,
  type ExerciseSheet,
  type ExerciseSummary,
  type QuickExerciseResult,
} from "@tartan/contracts";
import { exerciseCategoryOfFamily, normalizeExerciseTerm } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ArrowLeft, GripVertical, Plus, Search } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  exerciseDefaultsAction,
  exerciseSheetAction,
  quickCreateExerciseAction,
  searchExercisesAction,
} from "./exercise.action";
import { chipClass, FilterChips } from "./exercise-filters";
import { FavoriteButton, FileButton, FileDialog, useExerciseLists } from "./exercise-lists-ui";
import { ExerciseDetail } from "./exercise-sheet";
import { GestureThumb } from "./gesture-thumb";

const t = w.exercises;
const f = t.finder;
const PAGE = 40;
// Le temps de finir un mot avant de chercher.
const TYPING_MS = 200;

/** Ce qu'un autre écran sait déjà de l'exercice voulu : le planificateur, par exemple, l'a entendu dicter. */
export type ExerciseSuggestion = {
  /** Le nom cherché : il ouvre la recherche, puis préremplit la création. */
  name?: string;
  category?: ExerciseCategory;
  /** Une famille du catalogue, quand la catégorie n'est pas connue. */
  family?: ExerciseFamily;
  /** `null` : sans charge. */
  loadKind?: ExerciseLoadKind | null;
};

/** D'où vient la fiche choisie : de la bibliothèque, ou créée à l'instant. */
export type ExercisePickOrigin = "library" | "created";

/** Une recherche dans la bibliothèque, côté serveur, par tranches. */
const useExerciseSearch = (
  active: boolean,
  filter: ExerciseFilter,
  q: string,
  onLoaded?: (exercises: ExerciseSummary[]) => void,
) => {
  const [items, setItems] = useState<ExerciseSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // La recherche à laquelle les résultats affichés répondent : tant qu'elle diffère de la saisie, ils datent.
  const [answered, setAnswered] = useState<string | null>(null);
  const search = useAction(searchExercisesAction);
  const latest = useRef(0);
  const key = JSON.stringify({ filter, q, attempt });
  const run = async (offset: number) => {
    const ticket = ++latest.current;
    setFailed(false);
    const result = await search.executeAsync({ q, filter, offset, limit: PAGE, ownFirst: true });
    if (ticket !== latest.current) return;
    if (!result?.data) return setFailed(true);
    onLoaded?.(result.data.items);
    setItems((current) => (offset === 0 ? result.data!.items : [...current, ...result.data!.items]));
    setTotal(result.data.total);
    setAnswered(key);
  };
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
    settled: answered === key,
    loading: search.isPending,
    more: () => run(items.length),
    retry: () => setAttempt((n) => n + 1),
  };
};

// L'aperçu d'une fiche : la même fiche que dans la bibliothèque, chargée à la demande.
const Preview = ({
  id,
  lists,
  onBack,
  action,
}: {
  id: string;
  lists: ExerciseList[];
  onBack: () => void;
  action: (exercise: ExerciseSummary) => ReactNode;
}) => {
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

// Un choix unique en pastilles : de vrais boutons radio, donc les flèches passent de l'un à l'autre.
const ChipChoice = <V extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: V; label: string }[];
  value: V | null;
  onChange: (value: V) => void;
}) => {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="t-caption mb-1.5 text-inherit">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              chipClass(value === option.value),
              "relative cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--ctx-focus)",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

const categoryOptions = exerciseCategory.options.map((value) => ({ value, label: m.exerciseCategory[value] }));
type LoadChoice = ExerciseLoadKind | "none";
const loadOptions: { value: LoadChoice; label: string }[] = [
  ...exerciseLoadKind.options.map((value) => ({ value, label: f.quick.loadKinds[value] })),
  { value: "none", label: f.quick.loadKinds.none },
];

/**
 * Créer une fiche par son nom : un champ, deux choix déjà faits, un bouton. La famille et la charge sont
 * proposées par le serveur d'après la bibliothèque de l'espace ; elles se corrigent d'un geste. Une fiche qui porte
 * déjà ce nom n'est pas recréée : elle est proposée à la place.
 */
export const ExerciseQuickCreate = ({
  term = "",
  suggested,
  listId,
  submitLabel = f.quick.submit,
  existingLabel = f.quick.useExisting,
  onDone,
}: {
  /** Ce que le coach cherchait : le nom proposé, puis un autre nom de la fiche s'il le change. */
  term?: string;
  suggested?: ExerciseSuggestion;
  /** La liste du coach où ranger la fiche. */
  listId?: string;
  submitLabel?: string;
  /** Le bouton, quand une fiche porte déjà ce nom. */
  existingLabel?: string;
  onDone: (result: QuickExerciseResult) => void;
}) => {
  const [name, setName] = useState(term || (suggested?.name ?? ""));
  // Ce que le coach, ou l'écran qui l'amène ici, a choisi : cela passe avant toute proposition.
  const [category, setCategory] = useState<ExerciseCategory | null>(
    suggested?.category ?? (suggested?.family ? exerciseCategoryOfFamily(suggested.family) : null),
  );
  const [load, setLoad] = useState<LoadChoice | null>(
    suggested?.loadKind === undefined ? null : (suggested.loadKind ?? "none"),
  );
  const [proposal, setProposal] = useState<(ExerciseDefaultsResult & { forName: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const defaults = useAction(exerciseDefaultsAction);
  const create = useAction(quickCreateExerciseAction, {
    onSuccess: ({ data }) => data && onDone(data),
    onError: ({ error: e }) =>
      setError(
        e.serverError ??
          (e.validationErrors as { name?: { _errors?: string[] } } | undefined)?.name?._errors?.[0] ??
          f.quick.failed,
      ),
  });
  const trimmed = name.trim();
  const latest = useRef(0);
  const asked = useRef(false);
  useEffect(() => {
    const ticket = ++latest.current;
    if (!trimmed) return;
    const timer = setTimeout(
      async () => {
        const result = await defaults.executeAsync({ name: trimmed });
        if (ticket === latest.current && result?.data) setProposal({ ...result.data, forName: trimmed });
      },
      asked.current ? TYPING_MS : 0,
    );
    asked.current = true;
    return () => clearTimeout(timer);
    // Une proposition par nom saisi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  // Rien n'est coché tant que la proposition n'est pas arrivée : ce qui s'affiche est ce qui sera créé.
  const shownCategory = category ?? proposal?.category ?? null;
  const shownLoad: LoadChoice | null =
    load ??
    (proposal
      ? shownCategory === proposal.category
        ? (proposal.strengthLoadKind ?? "none")
        : "none"
      : category
        ? "none"
        : null);
  const existing = proposal?.forName === trimmed ? proposal.existing : null;
  const basis =
    !existing && proposal?.forName === trimmed && proposal.basis.kind === "exercise" && !category && !load
      ? proposal.basis.name
      : null;

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        create.execute({
          name,
          ...(term.trim() ? { searchTerm: term } : {}),
          ...(shownCategory ? { category: shownCategory } : {}),
          ...(shownLoad ? { strengthLoadKind: shownLoad === "none" ? null : shownLoad } : {}),
          ...(listId ? { listId } : {}),
        });
      }}
    >
      <Field label={m.exercises.name} error={error ?? undefined}>
        {(a) => (
          <Input
            {...a}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        )}
      </Field>
      {existing ? (
        <p role="status" className="rounded-thumb bg-raise px-3 py-2.5">
          {f.quick.exists(existing.name)}
        </p>
      ) : (
        <>
          <ChipChoice legend={f.quick.family} options={categoryOptions} value={shownCategory} onChange={setCategory} />
          <ChipChoice legend={f.quick.load} options={loadOptions} value={shownLoad} onChange={setLoad} />
          {basis ? <p className="t-caption font-normal text-soft">{f.quick.basedOn(basis)}</p> : null}
        </>
      )}
      <div className="flex flex-col gap-2">
        <Button type="submit" className="w-full tablet:w-auto tablet:self-start" disabled={create.isPending}>
          {existing ? existingLabel : submitLabel}
        </Button>
        {existing ? null : <p className="t-caption font-normal text-soft">{f.quick.later}</p>}
      </div>
    </form>
  );
};

/** La fiche créée à l'instant, et le chemin pour la compléter plus tard. */
export const CreatedNotice = ({
  id,
  name,
  created,
  editable,
  newTab = false,
}: {
  id: string;
  name: string;
  created: boolean;
  /** Une fiche commune ne se complète pas : elle se personnalise depuis sa page. */
  editable: boolean;
  newTab?: boolean;
}) => (
  <p role="status" className="flex flex-wrap items-center gap-x-3 rounded-thumb bg-raise px-3 py-1 text-[15px]">
    <span className="min-w-0 break-words py-1">{created ? f.created(name) : f.reused(name)}</span>
    {editable ? (
      <Link
        href={`/exercices/${id}?modifier=1`}
        {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
        className="inline-flex min-h-11 items-center font-semibold underline"
      >
        {f.complete}
        {newTab ? <span className="sr-only"> {f.newTab}</span> : null}
      </Link>
    ) : null}
  </p>
);

type Option = { kind: "exercise"; exercise: ExerciseSummary } | { kind: "more" } | { kind: "create" };

/**
 * Chercher une fiche dans toute la bibliothèque de l'espace, ou la créer sans quitter l'écran. La recherche part
 * au serveur, par tranches : la page n'embarque jamais la bibliothèque. Favoris, listes et familles partagent un
 * seul système de pastilles ; sans recherche, ce que le coach a rangé lui-même vient d'abord. Les flèches
 * parcourent les fiches depuis le champ, Entrée choisit. Dès qu'un terme est saisi, la dernière ligne propose de
 * créer la fiche.
 */
export const ExerciseFinder = ({
  lists,
  onPick,
  pickLabel,
  active = true,
  autoFocus = false,
  draggable = false,
  canCreate = true,
  suggested,
  listId,
  onLoaded,
  completeInNewTab = false,
}: {
  /** Les listes que ce coach lit, pour filtrer et marquer ses favoris. */
  lists: ExerciseList[];
  /** La fiche choisie, trouvée ou créée : l'écran en fait ce qu'il veut, sans attendre. */
  onPick: (exercise: ExerciseSummary, origin: ExercisePickOrigin) => void;
  /** Le nom accessible du bouton d'une ligne, par exemple « Ajouter Squat à la séance ». */
  pickLabel: (name: string) => string;
  /** Faux : aucune requête ne part (panneau replié). */
  active?: boolean;
  autoFocus?: boolean;
  /** Chaque ligne se glisse (`text/exercise-id`). */
  draggable?: boolean;
  /** Faux pour un membre sans le droit `editExercises` : la ligne de création n'est pas montrée. */
  canCreate?: boolean;
  suggested?: ExerciseSuggestion;
  /** La liste du coach où ranger une fiche créée ici. */
  listId?: string;
  /** Chaque fiche chargée ou créée, pour l'écran qui doit la connaître avant qu'elle soit choisie. */
  onLoaded?: (exercises: ExerciseSummary[]) => void;
  /** « Compléter la fiche » ouvre un autre onglet : l'écran en cours garde son travail. */
  completeInNewTab?: boolean;
}) => {
  const [q, setQ] = useState(suggested?.name ?? "");
  const [filter, setFilter] = useState<ExerciseFilter>({ kind: "all" });
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [made, setMade] = useState<{ id: string; name: string; created: boolean; editable: boolean } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  // Au retour de la création ou d'un aperçu, la saisie reprend là où elle était.
  const refocus = useRef(false);
  const base = useId();
  const found = useExerciseSearch(active && !creating, filter, q, onLoaded);
  const term = q.trim();
  const favorites = new Set(lists.find((list) => list.isFavorites && list.mine)?.exerciseIds ?? []);
  const hasMore = found.total !== null && found.items.length < found.total;
  const offersCreate = canCreate && term !== "";
  const options: Option[] = [
    ...found.items.map((exercise): Option => ({ kind: "exercise", exercise })),
    ...(hasMore ? [{ kind: "more" } as const] : []),
    ...(offersCreate ? [{ kind: "create" } as const] : []),
  ];
  // Une recherche sans résultat n'a qu'une ligne, celle qui crée : Entrée la prend sans flèche.
  const onlyCreate = found.settled && options.length === 1 && options[0]!.kind === "create";
  const at = cursor !== null && cursor < options.length ? cursor : onlyCreate ? 0 : null;
  const optionId = (index: number) => `${base}-option-${index}`;

  useEffect(() => {
    if (cursor === null) return;
    document.getElementById(optionId(cursor))?.scrollIntoView({ block: "nearest" });
    // La ligne choisie aux flèches reste visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);
  useEffect(() => {
    if (creating || previewing || !refocus.current) return;
    refocus.current = false;
    field.current?.focus();
  }, [creating, previewing]);

  const add = (exercise: ExerciseSummary) => (
    <IconButton label={pickLabel(exercise.name)} tone="brand" onClick={() => onPick(exercise, "library")}>
      <Plus aria-hidden className="size-5" />
    </IconButton>
  );
  const back = () => {
    refocus.current = true;
    setCreating(false);
    setPreviewing(null);
  };
  const choose = (option: Option) => {
    if (option.kind === "exercise") onPick(option.exercise, "library");
    else if (option.kind === "more") void found.more();
    else setCreating(true);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length > 0) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setCursor(at === null ? (step === 1 ? 0 : options.length - 1) : (at + step + options.length) % options.length);
    } else if (event.key === "Enter" && at !== null) {
      event.preventDefault();
      choose(options[at]!);
    }
  };
  const announced = (option: Option | undefined) =>
    !option
      ? ""
      : option.kind === "exercise"
        ? f.onExercise(option.exercise.name, found.items.indexOf(option.exercise) + 1, found.items.length)
        : option.kind === "more"
          ? f.onMore
          : f.onCreate(term);
  const lit = "bg-raise outline-2 -outline-offset-2 outline-(--ctx-focus)";

  if (previewing) return <Preview id={previewing} lists={lists} onBack={back} action={add} />;
  if (creating)
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <Button size="sm" variant="quiet" className="self-start" onClick={back}>
          <ArrowLeft aria-hidden className="size-4" />
          {t.picker.back}
        </Button>
        <h3 className="t-h2">{f.quick.title}</h3>
        <ExerciseQuickCreate
          term={term}
          // Une suggestion vaut pour le nom qu'elle accompagne : un autre terme cherché repart des propositions.
          suggested={
            suggested && (!suggested.name || normalizeExerciseTerm(suggested.name) === normalizeExerciseTerm(term))
              ? suggested
              : undefined
          }
          listId={listId}
          onDone={(result) => {
            onLoaded?.([result.exercise]);
            setMade({
              id: result.id,
              name: result.exercise.name,
              created: result.created,
              editable: !result.exercise.shared,
            });
            setQ("");
            setCursor(null);
            back();
            onPick(result.exercise, "created");
          }}
        />
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {made ? <CreatedNotice {...made} newTab={completeInNewTab} /> : null}
      <label className="relative block">
        <span className="sr-only">{m.exercises.search}</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-soft" />
        <Input
          ref={field}
          type="search"
          autoFocus={autoFocus}
          autoComplete="off"
          className="pl-10"
          placeholder={m.exercises.search}
          aria-describedby={`${base}-keys`}
          aria-controls={`${base}-results`}
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setCursor(null);
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      <p id={`${base}-keys`} className="sr-only">
        {f.keyboard}
      </p>
      <FilterChips
        scroll
        filter={filter}
        lists={lists}
        onChange={(next) => {
          setFilter(next);
          setCursor(null);
        }}
      />
      <p className="t-caption text-soft" aria-live="polite">
        {found.total === null ? t.loading : t.results(found.total)}
      </p>
      <p className="sr-only" aria-live="polite">
        {cursor === null ? "" : announced(options[cursor])}
      </p>
      {found.failed ? (
        <p role="alert" className="flex flex-wrap items-center gap-2">
          {t.loadFailed}
          <Button size="sm" variant="secondary" onClick={found.retry}>
            {t.retry}
          </Button>
        </p>
      ) : null}
      <div id={`${base}-results`} className="flex min-w-0 flex-col gap-3">
        <ul className="-mx-1 flex flex-col divide-y divide-card-line">
          {found.items.map((exercise, index) => (
            <li
              key={exercise.id}
              id={optionId(index)}
              draggable={draggable}
              onDragStart={draggable ? (ev) => ev.dataTransfer.setData("text/exercise-id", exercise.id) : undefined}
              className={cn(
                "flex items-center gap-2 px-1 py-1",
                draggable && "cursor-grab active:cursor-grabbing",
                // Le coin arrondi ne vaut que pour la ligne désignée : les séparations des autres restent droites.
                at === index && cn(lit, "rounded-thumb"),
              )}
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
                    {[
                      exercise.family ? m.exerciseGuide.families[exercise.family] : null,
                      favorites.has(exercise.id) ? f.favorite : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    {/* Le nom accessible commence par ce qui se voit (WCAG 2.5.3), puis dit ce que fait le bouton. */}
                    <span className="sr-only">, {t.picker.previewAction}</span>
                  </span>
                </span>
              </button>
              {add(exercise)}
            </li>
          ))}
        </ul>
        {hasMore ? (
          <Button
            id={optionId(found.items.length)}
            size="sm"
            variant="secondary"
            className={cn("self-center", at === found.items.length && lit)}
            disabled={found.loading}
            onClick={found.more}
          >
            {t.showMore(Math.min(PAGE, found.total! - found.items.length))}
          </Button>
        ) : null}
        {found.settled && found.total === 0 ? (
          <p className="text-soft">{term ? f.noMatch : m.builder.sequence.noResult}</p>
        ) : null}
        {offersCreate ? (
          <button
            type="button"
            id={optionId(options.length - 1)}
            onClick={() => setCreating(true)}
            className={cn(
              "-mx-1 flex min-h-14 items-center gap-3 rounded-thumb px-1 py-1 text-left hover:bg-raise",
              at === options.length - 1 && lit,
            )}
          >
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-thumb border border-dashed border-control-line"
            >
              <Plus className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col leading-snug">
              <span className="break-words font-semibold">{f.create(term)}</span>
              <span className="t-caption font-normal text-soft">{f.createHint}</span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
