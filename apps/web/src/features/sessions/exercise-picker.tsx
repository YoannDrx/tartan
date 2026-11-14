"use client";

import type { ExerciseSummary } from "@tartan/contracts";
import { normalizeExerciseTerm } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ActivityPicto } from "@/components/pictos";
import { IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { categoryColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";

const labels = m.builder.sequence;
type Category = keyof typeof m.exerciseCategory;

/** Le même sélecteur à chaque emplacement : recherche, familles nommées, ajout à l'endroit choisi. */
export function ExercisePicker({
  open,
  onOpenChange,
  destination,
  inGroup,
  exercises,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  inGroup: boolean;
  exercises: ExerciseSummary[];
  onPick: (exercise: ExerciseSummary) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const present = useMemo(
    () => (Object.keys(m.exerciseCategory) as Category[]).filter((c) => exercises.some((e) => e.category === c)),
    [exercises],
  );
  const term = normalizeExerciseTerm(search);
  const found = exercises.filter(
    (e) =>
      (!category || e.category === category) &&
      [e.name, ...(e.aliases ?? [])].some((name) => normalizeExerciseTerm(name).includes(term)),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={labels.pickerTitle(destination)} wide>
      <div className="flex flex-col gap-3">
        {inGroup ? <p className="t-caption text-soft">{labels.pickerGroupHint}</p> : null}
        <label className="relative block">
          <span className="sr-only">{labels.searchExercise}</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-soft" />
          <Input
            type="search"
            autoFocus
            className="pl-10"
            placeholder={labels.searchExercise}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={labels.families}>
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
            className={cn(
              "min-h-9 rounded-pill px-3 text-sm font-semibold",
              category === null ? "bg-accent text-on-accent" : "bg-card-raised",
            )}
          >
            {m.builder.sequence.all}
          </button>
          {present.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-sm",
                category === c ? "outline outline-2 outline-offset-1 outline-accent" : "",
              )}
              style={{ backgroundColor: categoryColors(c).background, color: categoryColors(c).text }}
            >
              <ActivityPicto kind={c} className="size-4" />
              {m.exerciseCategory[c]}
            </button>
          ))}
        </div>
        <p className="t-caption text-soft" aria-live="polite">
          {labels.results(found.length)}
        </p>
        <ul className="flex flex-col gap-1.5">
          {found.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center gap-3 rounded-button bg-card-raised py-1.5 pl-3 pr-1.5"
              style={{ borderLeft: `6px solid ${categoryColors(exercise.category).text}` }}
            >
              <span style={{ color: categoryColors(exercise.category).text }}>
                <ActivityPicto kind={exercise.category} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-snug">
                <span className="break-words font-semibold">{exercise.name}</span>
                <span className="t-caption font-normal text-soft">
                  {m.exerciseCategory[exercise.category as Category]}
                </span>
              </span>
              <IconButton label={labels.add(exercise.name)} onClick={() => onPick(exercise)}>
                <Plus aria-hidden className="size-5" />
              </IconButton>
            </li>
          ))}
        </ul>
        {found.length === 0 ? (
          <p className="text-soft">
            {labels.noResult}{" "}
            <Link href="/exercices?nouveau=1" className="font-semibold underline">
              {labels.createInLibrary}
            </Link>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
