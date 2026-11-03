import { formatHeight } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { cn } from "@/lib/cn";

type Row = { heightCm: number; notation: string };

// Feuille de barres (§ 9.8) : une pastille par hauteur, le résultat dessous, la hauteur courante en Piste.
export const BarSheet = ({
  rows,
  current,
  className,
}: {
  rows: Row[];
  current?: number | null;
  className?: string;
}) => (
  <ul aria-label={m.video.barSheet} className={cn("flex flex-wrap gap-1.5", className)}>
    {rows.map((r) => {
      const isCurrent = r.heightCm === current;
      return (
        <li
          key={r.heightCm}
          aria-current={isCurrent ? "true" : undefined}
          className={cn(
            "flex min-w-14 flex-col items-center rounded-thumb px-2 py-1",
            isCurrent ? "bg-accent text-on-accent" : "bg-card-raised text-fg",
          )}
        >
          <span className="t-num text-[17px]">{formatHeight(r.heightCm)}</span>
          <span className={cn("t-caption tracking-wide", isCurrent ? "text-on-accent" : "text-fg-muted")}>
            {r.notation}
          </span>
        </li>
      );
    })}
  </ul>
);

// Meilleure barre franchie, seulement quand elle découle de la feuille.
export const bestClearedCm = (rows: Row[]): number | null =>
  rows.reduce<number | null>(
    (best, r) => (r.notation.includes("O") && r.heightCm > (best ?? 0) ? r.heightCm : best),
    null,
  );

// Notation officielle d'un essai : la lettre porte le sens, la couleur le confirme.
export const JumpMark = ({ result }: { result: "O" | "X" | "pass" }) => {
  const label = result === "O" ? m.video.cleared : result === "X" ? m.video.failedJump : m.video.passed;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "t-num inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[15px] leading-none",
        result === "O" && "border-st-done text-st-done",
        result === "X" && "border-st-missed text-st-missed",
        result === "pass" && "border-st-upcoming text-fg-muted",
      )}
    >
      {result === "pass" ? "–" : result}
    </span>
  );
};
