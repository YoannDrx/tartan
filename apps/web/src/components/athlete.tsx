import { athletePaint, type Surface } from "@tartan/design-tokens/athletes";
import type { AthleteId } from "@tartan/mascot/athletes";
import { POSES, type PoseName } from "@tartan/mascot/poses";
import type { Face } from "@tartan/mascot/rig";
import type { Point, Pose, View } from "@tartan/mascot/skeleton";
import { svgPoseFigure } from "@tartan/mascot/v2/pose-figure";
import type { ComponentProps } from "react";
import { FigureGroup } from "@/components/jumper";
import { cn } from "@/lib/cn";

// Un athlète du groupe dans un SVG : le corps du moteur des gestes, dans l'ancienne pose, avec son visage du
// moment et sa tenue réglée sur le fond.
export const AthleteFigure = ({
  id,
  pose,
  face = "neutral",
  on,
  at,
  facing = "side",
  ...group
}: {
  id: AthleteId;
  pose: Pose;
  face?: Face;
  on: Surface;
  at?: Point;
  // De profil par défaut ; de face ou de dos pour un geste qui se lit ainsi.
  facing?: View;
} & Omit<ComponentProps<"g">, "transform" | "children">) => (
  <FigureGroup figure={svgPoseFigure(id, face, pose, athletePaint(id, on), at, facing)} {...group} />
);

// Le cadre, le bassin à l'origine et le sol 146 plus bas : le corps entier quelle que soit la pose (le sol à la même
// hauteur du cadre qu'avant), le corps debout au plus près, la course posée au sol (même échelle que debout, pieds
// sur le bord bas), debout bras levés, ou la tête seule.
export const ATHLETE_VIEW = {
  body: "-200 -187 400 400",
  standing: "-85 -142 170 302",
  stride: "-128 -140 256 300",
  // Debout, bras levés compris.
  raised: "-108 -165 216 325",
  head: "-34 -142 76 76",
};

// Un athlète du groupe, en aplats. Décoratif par défaut : le texte voisin porte le sens.
export const Athlete = ({
  id,
  pose = "stand",
  face,
  on,
  view = "body",
  className,
  ...svg
}: {
  id: AthleteId;
  pose?: PoseName;
  face?: Face;
  on: Surface;
  view?: keyof typeof ATHLETE_VIEW;
} & Omit<ComponentProps<"svg">, "viewBox">) => (
  <svg aria-hidden viewBox={ATHLETE_VIEW[view]} className={cn("athlete", className)} {...svg}>
    <AthleteFigure id={id} pose={POSES[pose]} face={face} on={on} />
  </svg>
);
