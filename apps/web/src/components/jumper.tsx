import { POSES, type PoseName } from "@tartan/mascot/poses";
import type { BoneId, Paint, Point, Pose } from "@tartan/mascot/skeleton";
import { svgFigure } from "@tartan/mascot/svg";
import { createElement, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

// La mascotte prend les couleurs qui ressortent sur le fond où elle est posée (globals.css).
const PAINT: Paint = {
  skin: "var(--color-film-skin)",
  tee: "var(--j-tee)",
  shorts: "var(--j-shorts)",
  shoe: "var(--j-shoe)",
  hair: "var(--j-hair)",
  eye: "var(--color-ink)",
};

// Le personnage dans un SVG : un groupe par os, du fond vers le devant, tous à plat sous le groupe du corps.
// `at` le place dans une scène. `classes` habille les formes d'un os : son groupe porte déjà la transformation.
export const JumperFigure = ({
  pose,
  paint,
  at,
  classes,
  ...group
}: {
  pose: Pose;
  paint: Paint;
  at?: Point;
  classes?: Partial<Record<BoneId, string>>;
} & Omit<ComponentProps<"g">, "transform" | "children">) => {
  const figure = svgFigure(pose, paint, at);
  return (
    <g transform={figure.root} {...group}>
      {figure.bones.map((bone) => {
        const shapes = bone.shapes.map(({ tag, ...attributes }, index) =>
          createElement(tag, { key: index, ...attributes }),
        );
        return (
          <g key={bone.id} data-bone={bone.id} transform={bone.transform}>
            {classes?.[bone.id] ? <g className={classes[bone.id]}>{shapes}</g> : shapes}
          </g>
        );
      })}
    </g>
  );
};

// La mascotte, en aplats. Décorative : le texte voisin porte le sens.
export const Jumper = ({
  pose = "stand",
  className,
  ...svg
}: { pose?: PoseName } & Omit<ComponentProps<"svg">, "viewBox">) => (
  <svg aria-hidden viewBox="-250 -270 500 500" className={cn("jumper", className)} {...svg}>
    <JumperFigure pose={POSES[pose]} paint={PAINT} />
  </svg>
);
