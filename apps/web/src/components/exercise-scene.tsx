import { gearPaint, SURFACES } from "@tartan/design-tokens/athletes";
import type { ExerciseClip, GearShape } from "@tartan/mascot/exercise";
import { svgProp } from "@tartan/mascot/props";
import { createElement, type ComponentProps } from "react";
import { AthleteFigure } from "@/components/athlete";
import { cn } from "@/lib/cn";

const Gear = ({ shapes }: { shapes: GearShape[] }) =>
  shapes.map((shape, index) => {
    const { tag, ...attributes } = svgProp(shape, gearPaint[shape.paint]);
    return createElement(tag, { key: index, ...attributes });
  });

// Une image du geste d'un exercice, à l'instant `t` de sa boucle : le matériel, l'athlète, puis ce qui passe devant lui.
export const ExerciseScene = ({
  gesture: clip,
  t,
  className,
  ...svg
}: { gesture: ExerciseClip; t: number } & Omit<ComponentProps<"svg">, "viewBox">) => {
  const { pose, root } = clip.frame(t);
  const gear = clip.gear(t);
  return (
    <svg viewBox={clip.view} className={cn("block", className)} style={{ backgroundColor: SURFACES.ink }} {...svg}>
      <Gear shapes={gear.filter((shape) => !shape.front)} />
      <AthleteFigure id={clip.athlete} pose={pose} face={clip.face(t)} on="ink" at={root} />
      <Gear shapes={gear.filter((shape) => shape.front)} />
    </svg>
  );
};
