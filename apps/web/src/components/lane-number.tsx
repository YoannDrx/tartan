import { cn } from "@/lib/cn";

// Le numéro peint au départ d'un couloir. Décoratif : l'ordre se lit dans la liste ou le titre qu'il accompagne.
export const LaneNumber = ({ n, className }: { n: number; className?: string }) => (
  <span aria-hidden className={cn("t-num inline-block w-[1ch] shrink-0 text-center leading-none", className)}>
    {n}
  </span>
);
