"use client";

import { exerciseFamily, type ExerciseFamily, type ExerciseFilter, type ExerciseList } from "@tartan/contracts";
import { moveInOrder } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ArrowDown, ArrowUp, ListOrdered, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/sheet";
import { EmptyState, PageHeader } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { deleteListAction, reorderListsAction, updateListAction } from "./exercise.action";
import { chipClass, FilterChips, filterRows } from "./exercise-filters";
import { CreatedNotice, ExerciseQuickCreate } from "./exercise-finder";
import {
  FavoriteButton,
  FileButton,
  FileDialog,
  NewListForm,
  useExerciseLists,
  type ExerciseListsState,
} from "./exercise-lists-ui";
import { FamilyBand, familySections } from "./family-band";
import { GestureThumb } from "./gesture-thumb";

const t = w.exercises;
// Une tranche à la fois : la page reste courte, la suite se demande.
const PAGE = 40;

/** Une ligne de la bibliothèque : ce qu'il faut pour filtrer et afficher, sans guide ni vidéo. */
export type LibraryRow = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  family: ExerciseFamily;
  filmed?: boolean;
  hasFilmedVideo?: boolean;
  motionKey: string | null;
  shared: boolean;
  prescription: string;
};

// La liste choisie : son nom, son partage, ses actions. Une liste d'un autre coach se lit seulement.
const ListBar = ({
  list,
  onCreate,
  onDeleted,
}: {
  list: ExerciseList;
  onCreate: () => void;
  onDeleted: () => void;
}) => {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const update = useAction(updateListAction, {
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const remove = useAction(deleteListAction, {
    onSuccess: () => {
      toast.ok(t.lists.deleted);
      onDeleted();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  if (!list.mine)
    return (
      <p className="on-card rounded-card bg-card px-4 py-3 text-[15px]">{t.lists.readOnly(list.ownerName ?? "")}</p>
    );
  return (
    <section aria-label={list.name} className="on-card flex flex-col gap-3 rounded-card bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="t-h2 min-w-0 flex-1 break-words">{list.name}</h2>
        {list.isFavorites ? null : (
          <>
            <IconButton label={t.lists.rename} onClick={() => setRenaming(true)}>
              <Pencil aria-hidden className="size-4" />
            </IconButton>
            <ConfirmDialog
              title={t.lists.deleteTitle(list.name)}
              description={t.lists.deleteNotice}
              onConfirm={() => remove.execute({ listId: list.id })}
              trigger={
                <IconButton label={t.lists.delete}>
                  <Trash2 aria-hidden className="size-4" />
                </IconButton>
              }
            />
          </>
        )}
      </div>
      {list.isFavorites ? null : (
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="check mt-0.5 shrink-0"
            defaultChecked={list.sharedWithCoaches}
            onChange={(event) => {
              const shared = event.target.checked;
              update.execute({ listId: list.id, sharedWithCoaches: shared });
              toast.ok(shared ? t.lists.shared : t.lists.private);
            }}
          />
          <span className="flex flex-col">
            <span className="font-semibold">{t.lists.share}</span>
            <span className="t-caption font-normal text-soft">{t.lists.shareHint}</span>
          </span>
        </label>
      )}
      <Button size="sm" variant="secondary" className="self-start" onClick={onCreate}>
        <Plus aria-hidden className="size-4" />
        {t.lists.createInList}
      </Button>
      <Dialog open={renaming} onOpenChange={setRenaming} title={t.lists.renameTitle(list.name)}>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            update.execute({ listId: list.id, name });
            setRenaming(false);
          }}
        >
          <Field label={t.lists.name}>
            {(a) => <Input {...a} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Button type="submit">{t.lists.save}</Button>
        </form>
      </Dialog>
    </section>
  );
};

// L'ordre des listes du coach : monter ou descendre, sans glisser.
const ListOrder = ({ state }: { state: ExerciseListsState }) => {
  const reorder = useAction(reorderListsAction, {
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const own = state.lists.filter((list) => list.mine);
  const move = (index: number, direction: -1 | 1) => {
    const next = moveInOrder(own, index, direction);
    state.setLists([...next, ...state.lists.filter((list) => !list.mine)]);
    reorder.execute({ listIds: next.map((list) => list.id) });
  };
  return (
    <ol className="flex flex-col divide-y divide-card-line">
      {own.map((list, index) => (
        <li key={list.id} className="flex min-h-12 items-center gap-2">
          <span className="min-w-0 flex-1 break-words font-semibold">{list.name}</span>
          <IconButton label={t.lists.moveUp(list.name)} disabled={index === 0} onClick={() => move(index, -1)}>
            <ArrowUp aria-hidden className="size-4" />
          </IconButton>
          <IconButton
            label={t.lists.moveDown(list.name)}
            disabled={index === own.length - 1}
            onClick={() => move(index, 1)}
          >
            <ArrowDown aria-hidden className="size-4" />
          </IconButton>
        </li>
      ))}
    </ol>
  );
};

export const ExerciseLibrary = ({
  rows,
  lists: initialLists,
  initialFilter,
  openNew,
  basePath = "/exercices",
  editable = true,
  progressionEnabled = false,
}: {
  rows: LibraryRow[];
  lists: ExerciseList[];
  initialFilter: ExerciseFilter;
  openNew: boolean;
  basePath?: string;
  editable?: boolean;
  progressionEnabled?: boolean;
}) => {
  const router = useRouter();
  const state = useExerciseLists(initialLists);
  const { lists } = state;
  const [filter, setFilter] = useState<ExerciseFilter>(initialFilter);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [creating, setCreating] = useState<{
    listId?: string;
    made?: { id: string; name: string; created: boolean; editable: boolean };
  } | null>(openNew ? {} : null);
  const [newList, setNewList] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [filing, setFiling] = useState<{ id: string; name: string } | null>(null);

  const list = filter.kind === "list" ? (lists.find((item) => item.id === filter.listId) ?? null) : null;
  const favorites = filter.kind === "favorites" ? state.favorites : null;
  const found = useMemo(() => {
    const filtered = filterRows(rows, filter, search, lists);
    return filter.kind === "all"
      ? filtered.sort((a, b) => exerciseFamily.options.indexOf(a.family) - exerciseFamily.options.indexOf(b.family))
      : filtered;
  }, [rows, filter, search, lists]);
  const visible = found.slice(0, shown);
  // Changer de filtre ou de recherche repart du début, sans changer de page.
  const choose = (next: ExerciseFilter) => {
    setFilter(next);
    setShown(PAGE);
  };
  const ownList = list?.mine ? list : favorites;
  // Tout, ou une seule famille : la liste se range par famille, chacune sous son bandeau coloré.
  const sections = filter.kind === "all" || filter.kind === "family" ? familySections(visible) : null;
  const counts = useMemo(() => {
    const total = new Map<ExerciseFamily, number>();
    for (const row of found) total.set(row.family, (total.get(row.family) ?? 0) + 1);
    return total;
  }, [found]);

  // Sous le nom : la famille quand aucun bandeau ne la dit déjà, le tournage, et « ma fiche ».
  const detail = (row: LibraryRow) => {
    const known = [
      sections ? null : m.exerciseGuide.families[row.family],
      row.filmed === undefined ? null : row.filmed ? m.filming.filmed : m.filming.pending,
    ]
      .filter(Boolean)
      .join(" · ");
    if (row.shared) return known;
    return known ? `${known}, ${t.sheet.source.mine.toLowerCase()}` : t.sheet.source.mine;
  };

  const renderRow = (row: LibraryRow, index: number) => (
    <li key={row.id} className="flex items-center gap-1 py-1.5 pl-3 pr-1 tablet:pl-4">
      <Link
        href={`${basePath}/${row.id}`}
        className="-my-1 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-thumb py-1 text-inherit no-underline hover:bg-raise"
      >
        <span aria-hidden className="t-caption tabular-nums text-soft">
          {index + 1}
        </span>
        <GestureThumb
          motionKey={row.motionKey}
          category={row.category}
          video={row.hasFilmedVideo}
          family={row.family}
        />
        <span className="min-w-0 leading-snug">
          <span className="block break-words font-semibold">{row.name}</span>
          {detail(row) ? <span className="t-caption block font-normal text-soft">{detail(row)}</span> : null}
        </span>
      </Link>
      <span className="t-num w-40 shrink-0 text-[17px] max-desktop:hidden">{row.prescription}</span>
      {editable && (
        <>
          <FavoriteButton
            name={row.name}
            active={state.isFavorite(row.id)}
            onToggle={() => void state.toggleFavorite(row.id)}
          />
          {ownList ? (
            <IconButton
              label={t.lists.remove(row.name)}
              onClick={async () => {
                if (await state.setMember(ownList.id, row.id, false)) toast.ok(t.lists.removed);
              }}
            >
              <X aria-hidden className="size-5" />
            </IconButton>
          ) : (
            <FileButton name={row.name} onClick={() => setFiling({ id: row.id, name: row.name })} />
          )}
        </>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.exercises.title}
        actions={
          editable && (
            <>
              <Button size="sm" onClick={() => setCreating(list?.mine ? { listId: list.id } : {})}>
                <Plus aria-hidden className="size-5" />
                {m.exercises.new}
              </Button>
              {progressionEnabled ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href="/outils/charges">{m.calculator.title}</Link>
                </Button>
              ) : null}
            </>
          )
        }
      />
      <div className="relative w-full desktop:max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-5 text-fg-muted" />
        <Field label={m.exercises.search} labelHidden>
          {(a) => (
            <Input
              {...a}
              type="search"
              className="border-card bg-card pl-10"
              placeholder={m.exercises.search}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShown(PAGE);
              }}
            />
          )}
        </Field>
      </div>
      <FilterChips
        filter={filter}
        lists={lists}
        onChange={choose}
        showLists={editable}
        after={
          editable && (
            <>
              <button type="button" className={chipClass(false)} onClick={() => setNewList(true)}>
                <Plus aria-hidden className="size-4" />
                {t.lists.new}
              </button>
              {lists.filter((item) => item.mine).length > 1 ? (
                <IconButton label={t.lists.manage} onClick={() => setOrdering(true)}>
                  <ListOrdered aria-hidden className="size-5" />
                </IconButton>
              ) : null}
            </>
          )
        }
      />
      {list ? (
        <ListBar
          key={list.id}
          list={list}
          onCreate={() => setCreating({ listId: list.id })}
          onDeleted={() => choose({ kind: "all" })}
        />
      ) : null}
      <p className="t-caption text-inherit" aria-live="polite">
        <span>{t.results(found.length)}</span>
        {rows.some((row) => row.filmed !== undefined) &&
          ` · ${m.filming.progress(found.filter((row) => row.filmed).length, found.length)}`}
      </p>
      {found.length === 0 ? (
        <EmptyState
          rubric="exercices"
          action={
            editable && search.trim() ? (
              <Button size="sm" onClick={() => setCreating(list?.mine ? { listId: list.id } : {})}>
                <Plus aria-hidden className="size-5" />
                {t.finder.create(search.trim())}
              </Button>
            ) : undefined
          }
        >
          {filter.kind === "favorites" ? t.lists.favoritesEmpty : list && !search ? t.lists.empty : m.exercises.noMatch}
        </EmptyState>
      ) : (
        <Sheet className="overflow-clip">
          {sections ? (
            sections.map((section) => (
              <section key={section.family} aria-labelledby={`famille-${section.family}`}>
                <FamilyBand
                  id={`famille-${section.family}`}
                  family={section.family}
                  count={counts.get(section.family) ?? 0}
                />
                {/* Une fiche atteinte au clavier s'arrête sous le bandeau collant, jamais derrière. */}
                <ul className="divide-y divide-card-line [&_a]:scroll-mt-[calc(var(--offline-bar-height,0px)+var(--app-header-height,58px)+56px)] [&_button]:scroll-mt-[calc(var(--offline-bar-height,0px)+var(--app-header-height,58px)+56px)]">
                  {section.rows.map(({ row, index }) => renderRow(row, index))}
                </ul>
              </section>
            ))
          ) : (
            <ul className="divide-y divide-card-line">{visible.map((row, index) => renderRow(row, index))}</ul>
          )}
        </Sheet>
      )}
      {found.length > shown ? (
        <Button variant="secondary" className="self-center" onClick={() => setShown(shown + PAGE)}>
          {t.showMore(Math.min(PAGE, found.length - shown))}
        </Button>
      ) : null}
      <FileDialog exercise={filing} state={state} onClose={() => setFiling(null)} />
      <Dialog open={newList} onOpenChange={setNewList} title={t.lists.new}>
        <NewListForm
          onCreated={(created) => {
            setNewList(false);
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
            choose({ kind: "list", listId: created.id });
          }}
        />
      </Dialog>
      <Dialog open={ordering} onOpenChange={setOrdering} title={t.lists.manageTitle}>
        <ListOrder state={state} />
      </Dialog>
      {/* Créer une fiche par son nom ; le formulaire complet l'attend sur sa page, derrière « Compléter la fiche ». */}
      <Dialog open={creating !== null} onOpenChange={(open) => !open && setCreating(null)} title={m.exercises.new}>
        {creating?.made ? (
          <div className="flex flex-col gap-4">
            <CreatedNotice {...creating.made} />
            <Button className="w-full tablet:w-auto tablet:self-start" onClick={() => setCreating(null)}>
              {t.finder.quick.done}
            </Button>
          </div>
        ) : creating ? (
          <ExerciseQuickCreate
            // Ce que le coach cherchait sans le trouver devient le nom proposé ; un filtre en cours, non.
            term={found.length === 0 ? search.trim() : ""}
            listId={creating.listId}
            submitLabel={t.finder.quick.submitInLibrary}
            existingLabel={creating.listId ? t.finder.quick.useExisting : t.finder.quick.openExisting}
            onDone={(result) => {
              // Une fiche qui existait déjà s'ouvre à son adresse ; rangée dans une liste, elle y apparaît.
              if (!result.created && !creating.listId) return router.push(`/exercices/${result.id}`);
              setCreating({
                ...creating,
                made: {
                  id: result.id,
                  name: result.exercise.name,
                  created: result.created,
                  editable: !result.exercise.shared,
                },
              });
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
};
