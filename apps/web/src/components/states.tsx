import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AthleteId } from "@tartan/mascot/athletes";
import type { PoseName } from "@tartan/mascot/poses";
import { Athlete } from "@/components/athlete";
import { Marked } from "@/components/marked";
import { Stay } from "@/components/ui/view-transition";
import { cn } from "@/lib/cn";
import { RUBRIC_ATHLETE, type Rubric } from "@/lib/rubric-athlete";

// L'athlète d'une rubrique sur son bout de piste : le rouge et la ligne blanche ne changent pas avec le thème,
// donc sa tenue reste lisible sur une carte claire comme sur une carte encre. Décoratif.
export const TrackTile = ({ athlete, pose, className }: { athlete: AthleteId; pose: PoseName; className?: string }) => (
  <span aria-hidden data-athlete={athlete} className={cn("block overflow-hidden rounded-button bg-page", className)}>
    <span className="relative block size-full">
      <span className="absolute inset-x-0 bottom-[14%] h-0.5 bg-on-page" />
      {/* Le cadre de l'athlète laisse de la place à toutes les poses : dans la tuile, on le rapproche. */}
      <Athlete
        id={athlete}
        pose={pose}
        on="piste"
        className="absolute left-1/2 top-1/2 size-[170%] max-w-none -translate-x-1/2 -translate-y-[47%]"
      />
    </span>
  </span>
);

// Un vide invite à agir : du texte, une action, et l'athlète de la rubrique qui attend la suite.
export const EmptyState = ({
  children,
  action,
  rubric,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  rubric: Rubric;
  className?: string;
}) => (
  <div
    className={cn(
      "relative flex min-h-36 flex-col items-start gap-3 overflow-hidden rounded-card on-card bg-card p-6 pr-32 tablet:pr-44",
      className,
    )}
  >
    <TrackTile
      athlete={RUBRIC_ATHLETE[rubric]}
      pose="run"
      className="pointer-events-none absolute inset-y-3 right-3 w-24 tablet:w-36"
    />
    <p className="relative max-w-prose">{children}</p>
    {action ? <div className="relative">{action}</div> : null}
  </div>
);

// Le titre d'écran, grand, posé sur le monde de la rubrique et sur sa ligne de couloir.
export const PageHeader = ({
  title,
  detail,
  actions,
  before,
}: {
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
  before?: ReactNode;
}) => (
  <Stay name="page-band">
    <header className="page-band tartan-band flex flex-col gap-4 bg-transparent">
      {before}
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
  </Stay>
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
// Son bandeau est celui d'un titre d'écran, au même endroit et de la même hauteur : d'une page à l'autre,
// le bandeau piste ne quitte pas l'écran pendant le chargement.
export const BandSkeleton = () => (
  <Stay name="page-band">
    <div aria-hidden className="page-band tartan-band flex flex-col gap-4 bg-transparent">
      <p className="t-display">
        <span className="inline-block h-[0.72em] w-64 max-w-full rounded-button bg-page-deep desktop:w-96" />
      </p>
      <div className="lane" />
    </div>
  </Stay>
);

export const SheetSkeleton = ({ label, rows = 7 }: { label: string; rows?: number }) => (
  <div role="status" aria-busy className="flex flex-col gap-4">
    <BandSkeleton />
    <span className="sr-only">{label}</span>
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
