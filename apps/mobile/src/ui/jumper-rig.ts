import { POSES, type PoseName } from "@tartan/mascot/poses";
import type { Paint } from "@tartan/mascot/skeleton";
import { svgFigure } from "@tartan/mascot/svg";

// Le même squelette que le site : la table d'os de @tartan/mascot, du fond vers le devant.
// Assez large pour toutes les poses, y compris le corps renversé au-dessus de la barre.
export const JUMPER_VIEW = "-190 -190 380 380";

export const jumperFigure = (pose: PoseName, paint: Paint) => svgFigure(POSES[pose], paint);
