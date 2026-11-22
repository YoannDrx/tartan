"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { w } from "@tartan/i18n/web";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

// Un grand groupe (120 athlètes et plus) : la liste se lit par tranches, et on retrouve quelqu'un par son nom.
// La page n'envoie que les données ; seules les lignes affichées deviennent du HTML.
export const ROSTER_STEP = 30;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const useRoster = <T,>(items: T[], nameOf: (item: T) => string, step = ROSTER_STEP) => {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(step);
  const deferred = useDeferredValue(query);
  const words = fold(deferred).split(/\s+/).filter(Boolean);
  const matches = words.length
    ? items.filter((item) => {
        const name = fold(nameOf(item));
        return words.every((word) => name.includes(word));
      })
    : items;
  return {
    query,
    search: (next: string) => {
      setQuery(next);
      setLimit(step);
    },
    matches,
    visible: matches.slice(0, limit),
    remaining: Math.max(0, matches.length - limit),
    more: () => setLimit((current) => current + step),
    // Montre la ligne de rang `index` (dans la liste entière, sans recherche) : la tranche s'allonge jusqu'à elle.
    reveal: (index: number) => setLimit((current) => Math.max(current, Math.ceil((index + 1) / step) * step)),
    step,
  };
};

type Roster = ReturnType<typeof useRoster<unknown>>;

// Un lien vers une ligne précise (`…#identifiant`) la montre, même au-delà de la première tranche, puis la fait
// venir à l'écran. Le navigateur ne la trouve pas seul : la page n'arrive qu'avec la première tranche.
export const useLinkedRow = <T,>(roster: Roster, items: T[], idOf: (item: T) => string) => {
  const [target, setTarget] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const index = id ? items.findIndex((item) => idOf(item) === id) : -1;
    if (index < roster.step) return;
    roster.reveal(index);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'adresse ne se lit qu'une fois la page montée
    setTarget(id);
  }, [roster, items, idOf]);
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [target]);
};

// La recherche, au-dessus de la liste : sur une carte, comme celle de la bibliothèque d'exercices.
export const RosterSearch = ({
  roster,
  total,
  label = w.tracking.search,
  className,
}: {
  roster: Roster;
  total: number;
  label?: string;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1.5 tablet:flex-row tablet:items-center tablet:gap-4", className)}>
    <div className="on-card relative w-full rounded-[10px] tablet:w-80 tablet:shrink-0">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-5 text-fg-muted" />
      <Field label={label} labelHidden>
        {(a) => (
          <Input
            {...a}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            className="border-card bg-card pl-10"
            placeholder={w.tracking.searchPlaceholder}
            value={roster.query}
            onChange={(event) => roster.search(event.target.value)}
          />
        )}
      </Field>
    </div>
    <p role="status" className="t-caption font-medium">
      {roster.query.trim() && roster.matches.length === 0
        ? w.tracking.noMatch(roster.query.trim())
        : w.tracking.shown(roster.visible.length, total)}
    </p>
  </div>
);

// La tranche suivante, sous la liste : le coach voit combien il en reste.
export const RosterMore = ({ roster }: { roster: Roster }) =>
  roster.remaining > 0 ? (
    <div className="flex justify-center border-t border-card-line p-3">
      <Button type="button" variant="secondary" size="sm" onClick={roster.more}>
        {w.tracking.showMore(Math.min(roster.step, roster.remaining))}
      </Button>
    </div>
  ) : null;
