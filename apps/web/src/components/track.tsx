import type { ReactNode } from "react";
import { LaneNumber } from "@/components/lane-number";
import { cn } from "@/lib/cn";

// Les motifs du stade (DESIGN.md) : des composants partagés, jamais redessinés à la main dans un écran.
// Ils prennent la couleur des lignes de couloir du fond où ils sont posés (`--color-lane`).

// La ligne droite : une double ligne de couloir. `trace` : elle se trace de gauche à droite à l'arrivée.
export const TrackLine = ({ trace, className }: { trace?: boolean; className?: string }) => (
  <span
    aria-hidden
    className={cn("block h-2.5 border-y-2 border-lane", trace && "track-trace origin-left", className)}
  />
);

const CORNERS = {
  "top-left": { cx: 0, cy: 0 },
  "top-right": { cx: 100, cy: 0 },
  "bottom-left": { cx: 0, cy: 100 },
  "bottom-right": { cx: 100, cy: 100 },
};

// Le virage : des couloirs concentriques, sur un quart de tour. `corner` : le coin autour duquel ils tournent.
export const TrackBend = ({
  lanes = 4,
  corner = "bottom-left",
  className,
}: {
  lanes?: number;
  corner?: keyof typeof CORNERS;
  className?: string;
}) => {
  const { cx, cy } = CORNERS[corner];
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={cn("block", className)}>
      {Array.from({ length: lanes }, (_, lane) => (
        <circle
          key={lane}
          cx={cx}
          cy={cy}
          r={98 - lane * 11}
          fill="none"
          stroke="var(--color-lane)"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
};

// L'ovale de la piste : deux lignes droites, deux virages. Le tracé part de la ligne d'arrivée et tourne
// dans le sens de la course, à main gauche.
const LAP = "M 140 110 A 50 50 0 0 0 140 10 H 60 A 50 50 0 0 0 60 110 Z";

// Le tour de piste : la part déjà courue d'un parcours. `value` va de 0 à 1 ; `label` le dit en toutes lettres.
export const TrackLap = ({
  value,
  label,
  className,
  children,
}: {
  value: number;
  label: string;
  className?: string;
  children?: ReactNode;
}) => {
  const done = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(done * 100)}
      className={cn("relative inline-grid place-items-center", className)}
    >
      <svg aria-hidden viewBox="0 0 200 120" className="block w-full">
        <path d={LAP} fill="none" stroke="var(--color-lane)" strokeWidth="10" strokeOpacity="0.28" />
        <path
          d={LAP}
          pathLength={1}
          fill="none"
          stroke="var(--color-link)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${done} 1`}
          className="track-lap-done"
          // Rien de couru : pas même le point que laisserait un trait à bouts ronds.
          visibility={done === 0 ? "hidden" : undefined}
        />
        <path d="M 140 101 V 119" stroke="var(--color-lane)" strokeWidth="3" />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center">{children}</div> : null}
    </div>
  );
};

const lanesOf = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

// La ligne de départ : la ligne, puis le numéro peint au pied de chaque couloir.
export const StartLine = ({ lanes = 8, className }: { lanes?: number; className?: string }) => (
  <div aria-hidden className={cn("text-lane", className)}>
    <span className="block h-1.5 bg-lane" />
    <span className="flex">
      {lanesOf(lanes).map((lane) => (
        <span key={lane} className="flex-1 border-l-2 border-lane py-1 text-center last:border-r-2">
          <LaneNumber n={lane} className="text-[20px]" />
        </span>
      ))}
    </span>
  </div>
);

// La ligne d'arrivée : plus épaisse, avec le repère sombre où chaque ligne de couloir la croise.
export const FinishLine = ({ lanes = 8, className }: { lanes?: number; className?: string }) => (
  <div aria-hidden className={cn("flex h-3 justify-evenly bg-lane", className)}>
    {lanesOf(lanes - 1).map((mark) => (
      <span key={mark} className="block h-full w-2 bg-(--track-mark,var(--color-ink))" />
    ))}
  </div>
);

// La planche d'appel : la zone de l'action principale. La planche, de la couleur du texte, puis la plasticine
// à ne pas mordre.
export const TakeoffBoard = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("flex flex-col gap-3", className)}>
    {children}
    <span aria-hidden className="flex h-2">
      <span className="flex-1 rounded-l-full bg-current" />
      <span className="w-4 rounded-r-full bg-link" />
    </span>
  </div>
);
