import { stagePaint, SURFACES } from "@tartan/design-tokens/athletes";
import { clamp } from "@tartan/mascot/clip";
import type { EventId } from "@tartan/mascot/event";
import { CLIPS } from "@tartan/mascot/events";
import { svgProp, type PropShape } from "@tartan/mascot/props";
import { createElement, type ComponentProps } from "react";
import { AthleteFigure } from "@/components/athlete";
import { cn } from "@/lib/cn";

type Scene = "ink" | "piste";

const Props = ({ shapes, on }: { shapes: PropShape[]; on: Scene }) => {
  const paint = stagePaint(on);
  return shapes.map((shape, index) => {
    const { tag, ...attributes } = svgProp(shape, paint[shape.paint]);
    return createElement(tag, { key: index, ...attributes });
  });
};

// Une image d'un geste : la scène de l'épreuve, ses accessoires, et l'athlète à l'instant `t`, de 0 à 1.
// `focus` cadre sur l'athlète (demi-côté du cadre, dans les unités de la scène). Sans lui, toute la scène.
export const EventScene = ({
  id,
  t,
  on = "ink",
  focus,
  className,
  ...svg
}: {
  id: EventId;
  t: number;
  on?: Scene;
  focus?: number;
} & Omit<ComponentProps<"svg">, "viewBox">) => {
  const clip = CLIPS[id];
  const at = clamp(t);
  const { pose, root } = clip.frame(at);
  const shapes = clip.props(at);
  const { width, height } = clip.stage;
  const viewBox = focus
    ? `${Math.round(root.x - focus)} ${Math.round(root.y - focus * 1.15)} ${focus * 2} ${focus * 2}`
    : `0 0 ${width} ${height}`;
  return (
    <svg viewBox={viewBox} className={cn("block", className)} style={{ backgroundColor: SURFACES[on] }} {...svg}>
      <Props shapes={shapes.filter((shape) => !shape.front)} on={on} />
      <AthleteFigure id={id} pose={pose} face={clip.face(at)} on={on} at={root} />
      <Props shapes={shapes.filter((shape) => shape.front)} on={on} />
    </svg>
  );
};
