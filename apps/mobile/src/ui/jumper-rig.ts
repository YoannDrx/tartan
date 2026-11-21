import { POSES, type PoseName } from "@tartan/mascot/poses";
import type { Paint } from "@tartan/mascot/skeleton";
import { svgJumperFigure } from "@tartan/mascot/v2/pose-figure";

// Le même corps que le site : celui du moteur des gestes, dans les poses nommées de @tartan/mascot.
// Assez large pour toutes les poses, y compris le corps renversé au-dessus de la barre ; le sol est à 146 sous le
// bassin.
export const JUMPER_VIEW = "-160 -165 320 320";

export const jumperFigure = (pose: PoseName, paint: Paint) => svgJumperFigure(POSES[pose], paint);
