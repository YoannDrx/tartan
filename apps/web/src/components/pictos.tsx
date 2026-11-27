import type { ExerciseFamily } from "@tartan/contracts";
import { Flame } from "lucide-react";
import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

// Pictogrammes métier (§ 9.7) : même grille de 24 px et même trait de 2 px que Lucide.
const Svg = ({ className, children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={cn("size-6 shrink-0", className)}
    {...props}
  >
    {children}
  </svg>
);

const Barbell = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M2 12h20M6 7v10M9 5v14M15 5v14M18 7v10" />
  </Svg>
);
const Hurdle = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 6h12M6 10h12M6 6v14M18 6v14M3 20h6M15 20h6" />
  </Svg>
);
const Lanes = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 21 9 3M12 21V3M21 21 15 3" />
  </Svg>
);
const Stairs = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 20h5v-5h5v-5h5V5h3" />
  </Svg>
);
const Cone = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3 7.5 18h9L12 3ZM9.5 11h5M4 21h16" />
  </Svg>
);
const Loop = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5M20 3.5v5h-5" />
  </Svg>
);
const JumpBar = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M5 21V10M19 21V10M3 21h4M17 21h4M5 13h14M4 7c3.500-4.500 12.500-4.500 16 0" />
  </Svg>
);

// La barre au-dessus de la tête : l'haltérophilie.
const Overhead = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 5h18M6 3v4M18 3v4M9 5l2 6M15 5l-2 6M12 11v5M9 21l3-5 3 5" />
  </Svg>
);
// La planche, en appui sur les avant-bras : le gainage.
const Plank = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="4.5" cy="9.5" r="2" />
    <path d="M7 11.5 20 15.5M8 12v5h3M20 15.5V20M3 20h18" />
  </Svg>
);

const byKind = {
  strength: Barbell,
  plyo: Hurdle,
  running: Lanes,
  running_drill: Lanes,
  stairs: Stairs,
  cones: Cone,
  mobility: Loop,
  jump: JumpBar,
  warmup: Flame,
} as const;

export type ActivityKind = keyof typeof byKind;

// Le type d'une séance ou la catégorie d'un exercice, toujours accompagné de son nom quelque part.
export const ActivityPicto = ({ kind, className }: { kind: string; className?: string }) => {
  const Icon = byKind[kind as ActivityKind] ?? Barbell;
  return <Icon aria-hidden className={cn("size-6 shrink-0", className)} />;
};

const byFamily = {
  strength: Barbell,
  weightlifting: Overhead,
  mobility: Loop,
  plyometrics: Hurdle,
  running: Lanes,
  core: Plank,
  coordination: Cone,
  stairs: Stairs,
  warmup: Flame,
} as const satisfies Record<ExerciseFamily, unknown>;

// Le pictogramme d'une famille de la bibliothèque, toujours à côté de son nom.
export const FamilyPicto = ({ family, className }: { family: ExerciseFamily; className?: string }) => {
  const Icon = byFamily[family];
  return <Icon aria-hidden className={cn("size-6 shrink-0", className)} />;
};

// Lignes de couloir en virage : l'unique illustration de l'app (§ 9.7), toujours en filigrane.
export const LaneArcs = ({ className, weight = 2 }: { className?: string; weight?: number }) => (
  <svg
    viewBox="0 0 240 160"
    fill="none"
    stroke="currentColor"
    strokeWidth={weight}
    aria-hidden
    preserveAspectRatio="xMaxYMax slice"
    className={cn("overflow-visible", className)}
  >
    <path vectorEffect="non-scaling-stroke" d="M240 20C150 20 76 84 60 160" />
    <path vectorEffect="non-scaling-stroke" d="M240 56C170 56 112 102 96 160" />
    <path vectorEffect="non-scaling-stroke" d="M240 92C192 92 148 122 132 160" />
    <path vectorEffect="non-scaling-stroke" d="M240 128c-30 0-54 12-72 32" />
  </svg>
);
