import { athletePaint, type Surface } from "@tartan/design-tokens/athletes";
import { athleteRig, type AthleteId } from "@tartan/mascot/athletes";
import { POSES, type PoseName } from "@tartan/mascot/poses";
import type { Face } from "@tartan/mascot/rig";
import type { Point, Pose } from "@tartan/mascot/skeleton";
import { svgAthlete } from "@tartan/mascot/svg";
import type { ComponentProps } from "react";
import { FigureGroup } from "@/components/jumper";
import { cn } from "@/lib/cn";

// Un athlète du groupe dans un SVG : son corps, son visage du moment, et sa tenue réglée sur le fond.
export const AthleteFigure = ({
  id,
  pose,
  face = "neutral",
  on,
  at,
  ...group
}: {
  id: AthleteId;
  pose: Pose;
  face?: Face;
  on: Surface;
  at?: Point;
} & Omit<ComponentProps<"g">, "transform" | "children">) => (
  <FigureGroup figure={svgAthlete(athleteRig(id, face), pose, athletePaint(id, on), at)} {...group} />
);

// Le cadre : le corps entier quelle que soit la pose, le corps debout au plus près, la course posée au sol (même
// échelle que debout, pieds sur le bord bas), debout bras levés, ou la tête seule.
const VIEW = {
  body: "-250 -270 500 500",
  standing: "-105 -212 210 372",
  stride: "-160 -212 320 380",
  // Debout, bras levés compris.
  raised: "-140 -262 280 422",
  head: "-78 -212 156 156",
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
  view?: keyof typeof VIEW;
} & Omit<ComponentProps<"svg">, "viewBox">) => (
  <svg aria-hidden viewBox={VIEW[view]} className={cn("athlete", className)} {...svg}>
    <AthleteFigure id={id} pose={POSES[pose]} face={face} on={on} />
  </svg>
);
