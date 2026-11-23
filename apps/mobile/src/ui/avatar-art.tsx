import type { AvatarAnimalId, AvatarGroupId, AvatarPreset } from "@tartan/contracts";
import { athletePaint } from "@tartan/design-tokens/athletes";
import { ANIMAL_PAINT, ATHLETE_AVATAR_SURFACE, AVATAR_GROUNDS } from "@tartan/design-tokens/avatars";
import { m } from "@tartan/i18n";
import { ANIMAL_SHAPES, shapeTransform } from "@tartan/mascot/animals";
import { POSES } from "@tartan/mascot/poses";
import type { SvgShape } from "@tartan/mascot/svg";
import { svgPoseFigure } from "@tartan/mascot/v2/pose-figure";
import { memo } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from "react-native-svg";

// Les avatars prédéfinis, dessinés comme sur le web : les animaux de `@tartan/mascot/animals`, et la tête des six
// athlètes du groupe, joyeux, sur le fond où leur tenue est réglée. Décoratifs : l'`Avatar` porte le sens.

export const animalOf = (preset: AvatarPreset): AvatarAnimalId | null =>
  preset.startsWith("animal:") ? (preset.slice(7) as AvatarAnimalId) : null;
export const athleteOf = (preset: AvatarPreset): AvatarGroupId | null =>
  preset.startsWith("athlete:") ? (preset.slice(8) as AvatarGroupId) : null;

// Le nom d'un avatar, pour le lecteur d'écran et la galerie.
export const presetLabel = (preset: AvatarPreset): string => {
  const animal = animalOf(preset);
  if (animal) return m.account.avatar.animal[animal];
  const athlete = athleteOf(preset)!;
  return m.account.avatar.athlete(m.group.athletes[athlete], m.group.events[athlete]);
};

// Le cadrage de la tête, le même que le web (`ATHLETE_VIEW.head`).
const HEAD_VIEW = "-34 -142 76 76";

const FigureShape = ({ shape }: { shape: SvgShape }) => {
  switch (shape.tag) {
    case "line": {
      const { tag: _tag, ...line } = shape;
      return <Line {...line} />;
    }
    case "rect": {
      const { tag: _tag, ...rect } = shape;
      return <Rect {...rect} />;
    }
    case "circle": {
      const { tag: _tag, ...circle } = shape;
      return <Circle {...circle} />;
    }
    case "path": {
      const { tag: _tag, ...path } = shape;
      return <Path {...path} />;
    }
  }
};

const AthleteHead = ({ id, size }: { id: AvatarGroupId; size: number }) => {
  const surface = ATHLETE_AVATAR_SURFACE[id];
  const figure = svgPoseFigure(id, "joy", POSES.stand, athletePaint(id, surface));
  const side = size * 0.9;
  return (
    <View style={{ width: size, height: size, backgroundColor: AVATAR_GROUNDS[surface] }}>
      <View style={{ position: "absolute", left: size * 0.05, top: size * 0.1 }}>
        <Svg width={side} height={side} viewBox={HEAD_VIEW}>
          <G transform={figure.root}>
            {figure.bones.map((bone) => (
              <G key={bone.id} transform={bone.transform}>
                {bone.shapes.map((shape, index) => (
                  <FigureShape key={index} shape={shape} />
                ))}
              </G>
            ))}
          </G>
        </Svg>
      </View>
    </View>
  );
};

const Animal = ({ id, size }: { id: AvatarAnimalId; size: number }) => {
  const paint = ANIMAL_PAINT[id];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width={100} height={100} fill={paint.ground} />
      {ANIMAL_SHAPES[id].map((shape, index) => {
        const fill = paint[shape.tone];
        const transform = shapeTransform(shape);
        switch (shape.tag) {
          case "path":
            return shape.stroke ? (
              <Path
                key={index}
                d={shape.d}
                fill="none"
                stroke={fill}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
              />
            ) : (
              <Path key={index} d={shape.d} fill={fill} />
            );
          case "circle":
            return <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} />;
          case "ellipse":
            return (
              <Ellipse
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
              <Rect
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
            return <Polygon key={index} points={shape.points} fill={fill} />;
        }
      })}
    </Svg>
  );
};

// Le dessin d'un avatar prédéfini, qui remplit un carré de `size` ; l'`Avatar` le découpe en disque.
export const PresetArt = memo(function PresetArt({ preset, size }: { preset: AvatarPreset; size: number }) {
  const animal = animalOf(preset);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {animal ? <Animal id={animal} size={size} /> : <AthleteHead id={athleteOf(preset)!} size={size} />}
    </View>
  );
});
