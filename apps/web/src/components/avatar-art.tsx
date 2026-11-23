import type { AvatarAnimalId, AvatarGroupId, AvatarPreset } from "@tartan/contracts";
import { ANIMAL_PAINT, ATHLETE_AVATAR_SURFACE, AVATAR_GROUNDS, type AnimalPaint } from "@tartan/design-tokens/avatars";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ANIMAL_SHAPES, shapeTransform } from "@tartan/mascot/animals";
import { Athlete } from "@/components/athlete";
import { cn } from "@/lib/cn";

// Les animaux de Tartan, dessinés pour le produit : la source unique est `@tartan/mascot/animals`, que l'app native
// rend aussi. Chaque aplat prend la couleur de son rôle dans `ANIMAL_PAINT`.
const AnimalShapes = ({ id, paint }: { id: AvatarAnimalId; paint: AnimalPaint }) =>
  ANIMAL_SHAPES[id].map((shape, index) => {
    const fill = paint[shape.tone];
    const transform = shapeTransform(shape);
    switch (shape.tag) {
      case "path":
        return shape.stroke ? (
          <path
            key={index}
            d={shape.d}
            fill="none"
            stroke={fill}
            strokeWidth={shape.strokeWidth}
            strokeLinecap="round"
          />
        ) : (
          <path key={index} d={shape.d} fill={fill} />
        );
      case "circle":
        return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} />;
      case "ellipse":
        return (
          <ellipse
            key={index}
            cx={shape.cx}
            cy={shape.cy}
            rx={shape.rx}
            ry={shape.ry}
            fill={fill}
            transform={transform}
          />
        );
      case "rect":
        return (
          <rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.rx}
            fill={fill}
            transform={transform}
          />
        );
      case "polygon":
        return <polygon key={index} points={shape.points} fill={fill} />;
    }
  });

export const animalOf = (preset: AvatarPreset): AvatarAnimalId | null =>
  preset.startsWith("animal:") ? (preset.slice(7) as AvatarAnimalId) : null;
export const athleteOf = (preset: AvatarPreset): AvatarGroupId | null =>
  preset.startsWith("athlete:") ? (preset.slice(8) as AvatarGroupId) : null;

// Le nom d'un avatar prédéfini, pour le texte alternatif et la galerie.
export const presetLabel = (preset: AvatarPreset): string => {
  const animal = animalOf(preset);
  if (animal) return w.profile.gallery.animal[animal];
  const athlete = athleteOf(preset)!;
  return w.profile.gallery.athlete(m.group.athletes[athlete], m.group.events[athlete]);
};

// Le dessin d'un avatar prédéfini, qui remplit son disque. Décoratif : l'`Avatar` qui l'entoure porte le sens.
export const PresetArt = ({ preset, className }: { preset: AvatarPreset; className?: string }) => {
  const animal = animalOf(preset);
  if (animal) {
    const paint = ANIMAL_PAINT[animal];
    return (
      <svg aria-hidden viewBox="0 0 100 100" className={cn("block size-full", className)}>
        <rect width="100" height="100" fill={paint.ground} />
        <AnimalShapes id={animal} paint={paint} />
      </svg>
    );
  }
  const athlete = athleteOf(preset)!;
  const surface = ATHLETE_AVATAR_SURFACE[athlete];
  return (
    <span
      aria-hidden
      className={cn("relative block size-full", className)}
      style={{ background: AVATAR_GROUNDS[surface] }}
    >
      <Athlete id={athlete} view="head" face="joy" on={surface} className="absolute inset-x-[5%] top-[10%] w-[90%]" />
    </span>
  );
};
