import { athletePaint, gearPaint, SURFACES } from "@tartan/design-tokens/athletes";
import { svgProp } from "@tartan/mascot/props";
import { svgShape } from "@tartan/mascot/svg";
import { drawClip, framing, staged, type Box, type ScenePaint } from "@tartan/mascot/v2/draw-svg";
import type { MotionClip } from "@tartan/mascot/v2/gesture";
import type { GestureView } from "@tartan/mascot/v2/project";
import { createElement, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Le geste d'un exercice : un corps en trois dimensions, vu de profil, de face ou de dessus.

// Les couleurs d'un geste sur l'encre : l'athlète, la barre et le matériel.
export const gesturePaint = (clip: MotionClip): ScenePaint => ({ ...gearPaint, ...athletePaint(clip.athlete, "ink") });

// Le cadre d'un geste dans une vue, au format de l'écran. Mesuré une fois par geste et par vue : le calcul parcourt
// la boucle entière.
const stages = new Map<string, Box>();
export const gestureStage = (clip: MotionClip, view: GestureView): Box => {
  const key = `${clip.key}/${view}`;
  let box = stages.get(key);
  if (!box) {
    box = staged(framing(clip, view, 14, 32), view);
    stages.set(key, box);
  }
  return box;
};

// La scène d'un geste du nouveau moteur : le cadre, l'encre, le sol. Son contenu est une image fixe (`GestureStill`)
// ou le groupe que le lecteur remplit lui-même, sans rendu React (guide-motion.tsx).
export const GestureStage = ({
  gesture: clip,
  view,
  className,
  children,
  ...svg
}: { gesture: MotionClip; view: GestureView } & Omit<ComponentProps<"svg">, "viewBox">) => {
  const box = gestureStage(clip, view);
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      data-view={view}
      className={cn("block", className)}
      style={{ backgroundColor: SURFACES.ink }}
      {...svg}
    >
      {view === "top" ? null : (
        <line x1={box.x} y1={2} x2={box.x + box.width} y2={2} stroke={gearPaint.floor} strokeWidth={4} />
      )}
      {children}
    </svg>
  );
};

// Une image fixe du geste, à l'instant `t` : une position de la frise.
export const GestureStill = ({ gesture: clip, t, view }: { gesture: MotionClip; t: number; view: GestureView }) => {
  const paint = gesturePaint(clip);
  return drawClip(clip, t, view).map((node) => {
    if (node.kind === "path") return <path key={node.id} d={node.d} fill={paint[node.paint]} />;
    if (node.kind === "prop") {
      const { tag, ...attributes } = svgProp(node.geometry, paint[node.paint]);
      return createElement(tag, { key: node.id, ...attributes });
    }
    return (
      <g key={node.id} transform={node.transform}>
        {node.shapes.map((shape, index) => {
          const { tag, ...attributes } = svgShape(shape, paint[shape.paint]);
          return createElement(tag, { key: index, ...attributes });
        })}
      </g>
    );
  });
};
