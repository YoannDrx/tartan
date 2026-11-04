import type { CellStatus } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { cn } from "@/lib/cn";

// Pictogramme distinct par statut, jamais la couleur seule (§ 9.4). Les valeurs suivent le fond (globals.css).
export const StatusIcon = ({
  status,
  size = 26,
  className,
}: {
  status: CellStatus;
  size?: number;
  className?: string;
}) => {
  const label = m.status[status];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      role="img"
      aria-label={label}
      className={cn("shrink-0", className)}
    >
      <title>{label}</title>
      {status === "done" ? (
        <>
          <circle cx="13" cy="13" r="12" fill="var(--st-done)" />
          <path
            d="M8 13.5l3.2 3.2L18 10"
            fill="none"
            stroke="var(--st-on)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {status === "partial" ? (
        <>
          <circle cx="13" cy="13" r="11" fill="none" stroke="var(--st-partial)" strokeWidth="2" />
          <path d="M13 2 A 11 11 0 0 1 13 24 Z" fill="var(--st-partial)" />
        </>
      ) : null}
      {status === "missed" ? (
        <>
          <circle cx="13" cy="13" r="12" fill="var(--st-missed)" />
          <path d="M9 9l8 8M17 9l-8 8" stroke="var(--st-on)" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : null}
      {status === "upcoming" ? (
        <circle cx="13" cy="13" r="11" fill="none" stroke="var(--st-upcoming)" strokeWidth="2" strokeDasharray="3 3" />
      ) : null}
      {status === "no_return" ? (
        <>
          <circle cx="13" cy="13" r="11" fill="none" stroke="var(--st-upcoming)" strokeWidth="2" />
          <path d="M9 13h8" stroke="var(--st-upcoming)" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
};

export const StatusLegend = () => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 t-caption font-normal text-soft">
    {(["done", "partial", "missed", "upcoming", "no_return"] as const).map((status) => (
      <li key={status} className="flex items-center gap-1.5">
        <StatusIcon status={status} size={18} />
        {m.status[status]}
      </li>
    ))}
  </ul>
);
