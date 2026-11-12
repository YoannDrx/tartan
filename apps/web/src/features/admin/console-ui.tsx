import { m } from "@tartan/i18n";
import Link from "next/link";
import type { ReactNode } from "react";
import { FilterPill } from "@/components/filter-pill";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const euros = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? "–"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export const day = (date: Date | string | null | undefined) =>
  date
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" }).format(new Date(date))
    : "–";

const sections = [
  { href: "/admin", label: () => m.admin.nav.operations },
  { href: "/admin/revenus", label: () => m.admin.nav.revenue },
  { href: "/admin/utilisateurs", label: () => m.admin.nav.users },
  { href: "/admin/espaces", label: () => m.admin.nav.spaces },
  { href: "/admin/abonnements", label: () => m.admin.nav.subscriptions },
  { href: "/admin/factures", label: () => m.admin.nav.invoices },
  { href: "/admin/litiges", label: () => m.admin.nav.disputes },
  { href: "/admin/usage", label: () => m.admin.nav.usage },
  { href: "/admin/versions", label: () => m.admin.nav.versions },
  { href: "/admin/journal", label: () => m.admin.nav.audit },
  { href: "/admin/configuration", label: () => m.admin.nav.configuration },
  { href: "/admin/mascotte", label: () => m.admin.nav.mascot },
  { href: "/admin/jeu", label: () => m.admin.nav.game },
];

export const AdminNav = ({ current }: { current: string }) => (
  <nav aria-label={m.admin.title} className="flex max-w-full gap-2 overflow-x-auto py-1 desktop:flex-wrap">
    {sections.map((section) => (
      <FilterPill key={section.href} href={section.href} active={current === section.href}>
        {section.label()}
      </FilterPill>
    ))}
  </nav>
);

export const Metrics = ({ items }: { items: { label: string; value: ReactNode }[] }) => (
  <Sheet>
    <dl className="flex flex-wrap gap-px bg-card-line">
      {items.map((item) => (
        <div key={item.label} className="min-w-[calc(50%-1px)] flex-1 bg-card px-4 py-2 tablet:min-w-[calc(25%-1px)]">
          <dt className="t-caption font-normal text-soft">{item.label}</dt>
          <dd className="t-num text-[22px]">{item.value}</dd>
        </div>
      ))}
    </dl>
  </Sheet>
);

// Sur ordinateur et tablette, une table qui défile dans son propre cadre. Sur téléphone, une carte par ligne :
// la première cellule en titre, les autres en paires libellé et valeur, sans défilement de côté.
type DataProps = {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
  empty?: string;
  // Largeur minimale de la table, pour les tables de plus de six colonnes.
  wide?: boolean;
  // Colonnes de chiffres, en chiffres tabulaires.
  numeric?: number[];
};

// Le contenu seul, pour une feuille qui porte déjà son titre.
export const DataRows = ({ caption, columns, rows, empty, wide, numeric = [] }: DataProps) =>
  rows.length === 0 ? (
    <p className="p-4 text-soft">{empty ?? m.admin.empty}</p>
  ) : (
    <>
      <ul aria-label={caption} className="divide-y divide-card-line tablet:hidden">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-col gap-2 px-4 py-3">
            <div className="font-semibold break-words">{row[0]}</div>
            {row.length > 1 ? (
              <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1">
                {row.slice(1).map((cell, cellIndex) => (
                  <div key={cellIndex} className="contents">
                    <dt className="t-caption self-baseline text-soft">{columns[cellIndex + 1]}</dt>
                    <dd className={cn("min-w-0 self-baseline break-words", numeric.includes(cellIndex + 1) && "t-num")}>
                      {cell}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto max-tablet:hidden" tabIndex={0} role="region" aria-label={caption}>
        <table className={`w-full border-collapse text-left ${wide ? "min-w-[840px]" : "min-w-[640px]"}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-card-line">
              {columns.map((column) => (
                <th key={column} scope="col" className="t-col px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-line">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn("px-3 py-2 align-top", numeric.includes(cellIndex) && "t-num")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

export const DataTable = (props: DataProps) => (
  <Sheet>
    <DataRows {...props} />
  </Sheet>
);

export const NextPage = ({ href }: { href: string | null }) =>
  href ? (
    <div>
      <Button asChild size="sm" variant="secondary">
        <Link href={href}>{m.admin.more}</Link>
      </Button>
    </div>
  ) : null;

export const SearchBox = ({ action, value, label }: { action: string; value?: string; label: string }) => (
  <form action={action} className="flex gap-2">
    <label className="min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        name="q"
        defaultValue={value}
        placeholder={label}
        className="min-h-11 w-full rounded-button border border-control-line bg-card px-3 text-fg"
      />
    </label>
    <Button type="submit" size="sm" variant="secondary">
      {m.admin.search}
    </Button>
  </form>
);
