import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Jumper } from "@/components/jumper";
import { Marked } from "@/components/marked";
import { cn } from "@/lib/cn";

// Un vide invite à agir : du texte, une action, et la mascotte qui attend la suite.
export const EmptyState = ({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "relative flex min-h-36 flex-col items-start gap-3 overflow-hidden rounded-card on-card bg-card p-6 pr-28 tablet:pr-40",
      className,
    )}
  >
    <Jumper pose="run" className="pointer-events-none absolute -right-2 bottom-0 size-28 tablet:size-36" />
    <p className="relative max-w-prose">{children}</p>
    {action ? <div className="relative">{action}</div> : null}
  </div>
);

// Le titre d'écran, grand, posé sur le monde de la rubrique et sur sa ligne de couloir.
export const PageHeader = ({ title, detail, actions }: { title: string; detail?: ReactNode; actions?: ReactNode }) => (
  <header className="flex flex-col gap-4">
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="t-display text-balance">
          <Marked text={title} />
        </h1>
        {detail ? <p className="mt-1 text-[16px] font-medium">{detail}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div> : null}
    </div>
    <div aria-hidden className="lane" />
  </header>
);

const stepClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-on-page text-on-page hover:bg-raise";

// Reculer ou avancer d'une période : le libellé reste entre les deux flèches.
export const PeriodStepper = ({
  label,
  previous,
  next,
  previousLabel,
  nextLabel,
}: {
  label: string;
  previous: string;
  next: string;
  previousLabel: string;
  nextLabel: string;
}) => (
  <div className="flex items-center gap-2">
    <Link href={previous} aria-label={previousLabel} className={stepClass}>
      <ChevronLeft aria-hidden className="size-5" />
    </Link>
    <p className="min-w-0 px-1 text-center font-display text-[24px] font-bold leading-7 tabular-nums desktop:text-[30px] desktop:leading-8">
      {label}
    </p>
    <Link href={next} aria-label={nextLabel} className={stepClass}>
      <ChevronRight aria-hidden className="size-5" />
    </Link>
  </div>
);

export const Chip = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "dark" | "brand" | "warning" | "missed";
}) => (
  <span
    className={cn(
      "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 t-caption font-semibold",
      tone === "neutral" && "bg-card-raised text-fg-muted ring-1 ring-card-line",
      tone === "dark" && "bg-card text-fg",
      tone === "brand" && "bg-accent text-on-accent",
      tone === "warning" && "bg-st-partial text-on-status",
      tone === "missed" && "bg-st-missed text-on-status",
    )}
  >
    {children}
  </span>
);

export const Spinner = ({ label }: { label: string }) => (
  <p role="status" className="py-8 text-center text-soft">
    {label}
  </p>
);

// Le squelette reprend la forme d'une feuille : la page ne saute pas à l'arrivée des données.
export const SheetSkeleton = ({ label, rows = 7 }: { label: string; rows?: number }) => (
  <div role="status" aria-busy className="flex flex-col gap-5">
    <span className="sr-only">{label}</span>
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-[52px] w-64 max-w-full rounded-button bg-page-deep desktop:h-20 desktop:w-96" />
      <div className="lane" />
    </div>
    <div aria-hidden className="on-card divide-y divide-card-line overflow-hidden rounded-card bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-4">
          <div className="size-8 shrink-0 rounded-full bg-card-raised" />
          <div className="h-4 w-1/3 rounded-full bg-card-raised" />
          <div className="ml-auto h-4 w-16 rounded-full bg-card-raised" />
        </div>
      ))}
    </div>
  </div>
);
